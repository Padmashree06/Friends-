package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang-service/config"
	"golang-service/models"
	"golang-service/services"
)

// WhatsAppTriggerQuiz is called by n8n when schedule time arrives
func WhatsAppTriggerQuiz(c *gin.Context) {
	var body struct {
		ScheduleID int `json:"schedule_id" binding:"required"`
		Duration   int `json:"duration"`
	}
	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var schedule models.Schedule
	if err := config.DB.Get(&schedule, "SELECT * FROM schedules WHERE id=$1 AND active=true", body.ScheduleID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Schedule not found"})
		return
	}

	var user models.User
	if err := config.DB.Get(&user, "SELECT id, username, email, phone FROM users WHERE id=$1", schedule.UserID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	if user.Phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User has no phone number"})
		return
	}

	duration := body.Duration
	if duration == 0 {
		duration = 10
	}
	numQuestions := duration / 3
	if numQuestions < 3 {
		numQuestions = 3
	}
	if numQuestions > 20 {
		numQuestions = 20
	}

	warningMsg := fmt.Sprintf(
		"📚 Hey! Your quiz on *%s* starts in 5 mins!\n\n%d questions coming. Reply *SKIP* to skip.",
		schedule.Topic, numQuestions,
	)
	services.SendWhatsAppMessage(user.Phone, warningMsg)

	apiKey := services.ResolveGroqAPIKeyFromRequest(c)
	ctx := context.Background()

	questions, err := generateMCQQuestions(ctx, apiKey, schedule.Topic, numQuestions)
	if err != nil {
		questions = generateSimpleMCQQuestions(schedule.Topic, numQuestions)
	}
	if len(questions) < numQuestions {
		fallback := generateSimpleMCQQuestions(schedule.Topic, numQuestions-len(questions))
		questions = append(questions, fallback...)
	}
	if len(questions) > numQuestions {
		questions = questions[:numQuestions]
	}

	config.DB.Exec(`DELETE FROM quizzes WHERE chat_id=$1 AND status != 'completed'`, schedule.ChatID)

	var quizID int
	err = config.DB.QueryRow(`
		INSERT INTO quizzes (user_id, chat_id, topic, status, total_questions, created_at)
		VALUES ($1, $2, $3, 'pending', $4, $5)
		RETURNING id
	`, schedule.UserID, schedule.ChatID, schedule.Topic, len(questions), time.Now()).Scan(&quizID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create quiz"})
		return
	}

	for i, q := range questions {
		optionsJSON, _ := json.Marshal(q.Options)
		config.DB.Exec(`
			INSERT INTO quiz_questions (quiz_id, question, answer, options, order_num)
			VALUES ($1, $2, $3, $4, $5)
		`, quizID, q.Question, q.Answer, string(optionsJSON), i+1)
	}

	config.DB.Exec("UPDATE quizzes SET status='in_progress' WHERE id=$1", quizID)

	// Create quiz session for tracking
	config.DB.Exec(`
		INSERT INTO whatsapp_quiz_sessions (phone, quiz_id, current_question, score, active, started_at)
		VALUES ($1, $2, 1, 0, true, $3)
	`, user.Phone, quizID, time.Now())

	// Call n8n webhook to start the quiz flow
	n8nURL := "https://n8n-3-los0.onrender.com/webhook-test/quiz-start"

	firstQuestion, _ := getQuestionByOrder(quizID, 1)
	firstQuestionMsg := formatQuestionMessage(firstQuestion, 1, len(questions))

	payload := map[string]interface{}{
		"phone":           strings.TrimPrefix(user.Phone, "whatsapp:"),
		"user_id":         schedule.UserID,
		"quiz_id":         quizID,
		"chat_id":         schedule.ChatID,
		"topic":           schedule.Topic,
		"total_questions": len(questions),
		"current_order":   1,
		"question":        firstQuestion.Question,
		"options":         strings.Split(firstQuestion.Options, "|"),
		"answer":          firstQuestion.Answer,
		"formatted_msg":   firstQuestionMsg,
	}
	bodyBytes, _ := json.Marshal(payload)
	fmt.Printf("=== N8N PAYLOAD: %s ===\n", string(bodyBytes))

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Post(n8nURL, "application/json", bytes.NewBuffer(bodyBytes))
	if err != nil {
		fmt.Printf("=== N8N ERROR: %v ===\n", err)
	} else {
		fmt.Printf("=== N8N RESP: %d ===\n", resp.StatusCode)
	}

	if err := advanceSchedule(schedule); err != nil {
		fmt.Printf("Warning: Failed to advance schedule: %v\n", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":            "Quiz triggered",
		"quiz_id":            quizID,
		"phone":              user.Phone,
		"topic":              schedule.Topic,
		"total_questions":    len(questions),
		"first_question_msg": firstQuestionMsg,
	})
}

// WhatsAppWebhook receives WhatsApp replies
func WhatsAppWebhook(c *gin.Context) {
	from := c.PostForm("From")
	body := c.PostForm("Body")

	phone := strings.TrimPrefix(from, "whatsapp:")
	userMessage := strings.TrimSpace(body)

	if phone == "" || userMessage == "" {
		c.String(http.StatusOK, "<Response></Response>")
		return
	}

	if strings.EqualFold(userMessage, "SKIP") {
		endQuiz(phone, true)
		c.String(http.StatusOK, twimlMessage("Quiz ended. Thanks! 👋"))
		return
	}

	var session models.WhatsAppQuizSession
	err := config.DB.Get(&session, `
		SELECT * FROM whatsapp_quiz_sessions 
		WHERE phone=$1 AND active=true
	`, phone)
	if err != nil {
		c.String(http.StatusOK, twimlMessage("No active quiz. Schedule one! 📅"))
		return
	}

	currentQ, err := getQuestionByOrder(session.QuizID, session.CurrentQuestion)
	if err != nil {
		c.String(http.StatusOK, twimlMessage("Error loading question."))
		return
	}

	var totalQuestions int
	config.DB.Get(&totalQuestions, "SELECT total_questions FROM quizzes WHERE id=$1", session.QuizID)

	isCorrect := strings.EqualFold(strings.TrimSpace(currentQ.Answer), strings.TrimSpace(userMessage))

	config.DB.Exec(`UPDATE quiz_questions SET user_answer=$1, is_correct=$2 WHERE id=$3`, userMessage, isCorrect, currentQ.ID)

	newScore := session.Score
	if isCorrect {
		newScore++
	}

	var replyMsg string
	if isCorrect {
		replyMsg = "✅ Correct!\n\n"
	} else {
		replyMsg = fmt.Sprintf("❌ Wrong! Answer: *%s*\n\n", currentQ.Answer)
	}

	nextQuestionNum := session.CurrentQuestion + 1

	if nextQuestionNum > totalQuestions {
		config.DB.Exec(`UPDATE whatsapp_quiz_sessions SET active=false, score=$1 WHERE phone=$2`, newScore, phone)
		config.DB.Exec(`UPDATE quizzes SET status='completed', score=$1, completed_at=$2 WHERE id=$3`, newScore, time.Now(), session.QuizID)

		var topic string
		config.DB.Get(&topic, "SELECT topic FROM quizzes WHERE id=$1", session.QuizID)

		replyMsg = fmt.Sprintf(
			"%s🎉 *Quiz Completed!*\n\nTopic: *%s*\nScore: *%d/%d*\nPercentage: *%.0f%%*\n\nGreat job! 💪",
			replyMsg, topic, newScore, totalQuestions,
			float64(newScore)/float64(totalQuestions)*100,
		)
	} else {
		config.DB.Exec(`UPDATE whatsapp_quiz_sessions SET current_question=$1, score=$2 WHERE phone=$3`, nextQuestionNum, newScore, phone)

		nextQ, _ := getQuestionByOrder(session.QuizID, nextQuestionNum)
		if err == nil {
			replyMsg += formatQuestionMessage(nextQ, nextQuestionNum, totalQuestions)
		}
	}

	var chatID string
	config.DB.Get(&chatID, "SELECT chat_id FROM quizzes WHERE id=$1", session.QuizID)
	if chatID != "" {
		config.DB.Exec(`INSERT INTO messages (id, chat_id, role, content, created_at) VALUES ($1,$2,'user',$3,$4)`, uuid.New().String(), chatID, userMessage, time.Now())
		config.DB.Exec(`INSERT INTO messages (id, chat_id, role, content, created_at) VALUES ($1,$2,'bot',$3,$4)`, uuid.New().String(), chatID, replyMsg, time.Now())
	}

	c.String(http.StatusOK, twimlMessage(replyMsg))
}

func getQuestionByOrder(quizID, orderNum int) (models.QuizQuestion, error) {
	var q models.QuizQuestion
	err := config.DB.Get(&q, `
		SELECT id, quiz_id, question, answer,
			COALESCE(options, '[]') as options,
			COALESCE(user_answer, '') as user_answer,
			COALESCE(is_correct, false) as is_correct,
			order_num
		FROM quiz_questions
		WHERE quiz_id=$1 AND order_num=$2
	`, quizID, orderNum)
	return q, err
}

func endQuiz(phone string, skipped bool) {
	var session models.WhatsAppQuizSession
	if err := config.DB.Get(&session, "SELECT * FROM whatsapp_quiz_sessions WHERE phone=$1 AND active=true", phone); err != nil {
		return
	}
	config.DB.Exec("UPDATE whatsapp_quiz_sessions SET active=false WHERE phone=$1", phone)
	status := "completed"
	if skipped {
		status = "skipped"
	}
	config.DB.Exec("UPDATE quizzes SET status=$1, completed_at=$2, score=$3 WHERE id=$4", status, time.Now(), session.Score, session.QuizID)
}

func twimlMessage(msg string) string {
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>%s</Message></Response>`, msg)
}

// handlers/whatsapp_quiz.go

// GET /quiz/question?quiz_id=X&order=1
// n8n calls this to get the next question text
func GetQuizQuestion(c *gin.Context) {
	quizID := parseInt(c.Query("quiz_id"))
	order := parseInt(c.Query("order"))

	var q models.QuizQuestion
	err := config.DB.Get(&q, `
		SELECT id, quiz_id, question, answer,
			COALESCE(options, '[]') as options,
			order_num
		FROM quiz_questions
		WHERE quiz_id=$1 AND order_num=$2
	`, quizID, order)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Question not found"})
		return
	}

	var options []string
	json.Unmarshal([]byte(q.Options), &options)

	// Format the WhatsApp message
	msg := fmt.Sprintf("📝 *Question %d*\n\n%s\n\n", order, q.Question)
	labels := []string{"A", "B", "C", "D"}
	for i, opt := range options {
		if i < len(labels) {
			msg += fmt.Sprintf("*%s.* %s\n", labels[i], opt)
		}
	}
	msg += "\n_Reply with A, B, C, or D_"

	c.JSON(http.StatusOK, gin.H{
		"question_id":   q.ID,
		"question":      q.Question,
		"options":       options,
		"order":         order,
		"formatted_msg": msg,
	})
}

// POST /quiz/answer
// n8n calls this after receiving user reply from Twilio webhook
func SubmitWhatsAppAnswer(c *gin.Context) {
	var body struct {
		QuizID int    `json:"quiz_id"   binding:"required"`
		Order  int    `json:"order"     binding:"required"` // current question order
		Answer string `json:"answer"    binding:"required"` // "A", "B", "C", "D"
	}
	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Load question
	var q models.QuizQuestion
	err := config.DB.Get(&q, `
		SELECT id, quiz_id, question, answer,
			COALESCE(options, '[]') as options,
			order_num
		FROM quiz_questions
		WHERE quiz_id=$1 AND order_num=$2
	`, body.QuizID, body.Order)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Question not found"})
		return
	}

	// Check answer
	isCorrect := strings.EqualFold(strings.TrimSpace(q.Answer), strings.TrimSpace(body.Answer))

	// Save answer
	config.DB.Exec(`
		UPDATE quiz_questions SET user_answer=$1, is_correct=$2 WHERE id=$3
	`, body.Answer, isCorrect, q.ID)

	// Update score
	if isCorrect {
		config.DB.Exec(`UPDATE quizzes SET score = score + 1 WHERE id=$1`, body.QuizID)
	}

	// Get current score + total
	var quiz models.Quiz
	config.DB.Get(&quiz, "SELECT * FROM quizzes WHERE id=$1", body.QuizID)

	nextOrder := body.Order + 1
	isLast := nextOrder > quiz.TotalQues

	// If last question, mark complete
	if isLast {
		config.DB.Exec(`
			UPDATE quizzes SET status='completed', completed_at=$1 WHERE id=$2
		`, time.Now(), body.QuizID)
	}

	// Build feedback message
	feedbackMsg := ""
	if isCorrect {
		feedbackMsg = "✅ Correct!\n"
	} else {
		feedbackMsg = fmt.Sprintf("❌ Wrong! Answer was: *%s*\n", q.Answer)
	}

	c.JSON(http.StatusOK, gin.H{
		"is_correct":   isCorrect,
		"score":        quiz.Score,
		"total":        quiz.TotalQues,
		"feedback_msg": feedbackMsg,
		"next_order":   nextOrder,
		"is_last":      isLast,
		// Final message n8n sends if quiz is done
		"final_msg": fmt.Sprintf(
			"🎉 *Quiz Complete!*\n\nTopic: *%s*\nScore: *%d/%d* (%.0f%%)\n\nSee you next time! 💪",
			quiz.Topic, quiz.Score, quiz.TotalQues,
			float64(quiz.Score)/float64(quiz.TotalQues)*100,
		),
	})
}

func formatQuestionMessage(q models.QuizQuestion, current, total int) string {
	var options []string
	json.Unmarshal([]byte(q.Options), &options)

	msg := fmt.Sprintf("📝 *Question %d/%d*\n\n%s\n\n", current, total, q.Question)
	if len(options) > 0 {
		labels := []string{"A", "B", "C", "D"}
		for i, opt := range options {
			if i < len(labels) {
				msg += fmt.Sprintf("*%s.* %s\n", labels[i], opt)
			}
		}
		msg += "\n_Reply with A, B, C, or D_"
	} else {
		msg += "_Type your answer_"
	}
	return msg
}
