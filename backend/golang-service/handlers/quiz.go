package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang-service/config"
	"golang-service/models"
	"golang-service/services"
)



func GetQuizStateByPhone(c *gin.Context) {
    phone := c.Query("phone")
    if phone == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "phone is required"})
        return
    }

    var result struct {
        QuizID         int    `db:"quiz_id" json:"quiz_id"`
        CurrentOrder   int    `db:"current_order" json:"current_order"`
        TotalQuestions int    `db:"total_questions" json:"total_questions"`
        ChatID         string `db:"chat_id" json:"chat_id"`
    }

    err := config.DB.Get(&result, `
        SELECT 
            q.id as quiz_id,
            COALESCE((
                SELECT order_num FROM quiz_questions 
                WHERE quiz_id = q.id 
                AND (user_answer IS NULL OR user_answer = '')
                ORDER BY order_num ASC LIMIT 1
            ), q.total_questions) as current_order,
            q.total_questions,
            q.chat_id
        FROM quizzes q
        JOIN users u ON u.id = q.user_id
        WHERE u.phone = $1
        AND q.status = 'in_progress'
        ORDER BY q.created_at DESC LIMIT 1
    `, phone)

    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "No active quiz found for this phone"})
        return
    }

    c.JSON(http.StatusOK, result)
}


func MarkQuizInProgress(c *gin.Context) {
    var body struct {
        QuizID int `json:"quiz_id" binding:"required"`
    }
    if err := c.BindJSON(&body); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

    _, err := config.DB.Exec(`
        UPDATE quizzes SET status='in_progress' WHERE id=$1
    `, body.QuizID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Quiz marked in_progress"})
}

func TriggerQuizReminder(c *gin.Context) {
	var body struct {
		ScheduleID int `json:"schedule_id" binding:"required"`
		Duration   int `json:"duration"` // optional, default 10 min
	}

	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// 1. Get schedule details
	var schedule models.Schedule
	err := config.DB.Get(&schedule, "SELECT * FROM schedules WHERE id=$1 AND active=true", body.ScheduleID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Schedule not found"})
		return
	}

	// 2. Determine quiz size
	duration := body.Duration
	if duration == 0 {
		duration = 10 // default 10 min quiz
	}
	numQuestions := duration / 3
	if numQuestions < 3 {
		numQuestions = 3
	}
	if numQuestions > 20 {
		numQuestions = 20
	}

	// 3. Delete any existing incomplete quiz for this chat (fresh start on schedule trigger)
	config.DB.Exec(`DELETE FROM quizzes WHERE chat_id=$1 AND status != 'completed'`, schedule.ChatID)

	// 4. Generate MCQ questions for the scheduled topic
	apiKey := services.ResolveGroqAPIKeyFromRequest(c)
	ctx := context.Background()

	questions, err := generateMCQQuestions(ctx, apiKey, schedule.Topic, numQuestions)
	if err != nil {
		fmt.Printf("Warning: Groq failed, using fallback questions: %v\n", err)
		questions = generateSimpleMCQQuestions(schedule.Topic, numQuestions)
	}

	// Supplement if Groq returned fewer than requested
	if len(questions) < numQuestions {
		fallback := generateSimpleMCQQuestions(schedule.Topic, numQuestions-len(questions))
		questions = append(questions, fallback...)
	}
	if len(questions) > numQuestions {
		questions = questions[:numQuestions]
	}

	// 5. Create the quiz record
	var quizID int
	err = config.DB.QueryRow(`
		INSERT INTO quizzes (user_id, chat_id, topic, status, total_questions, created_at)
		VALUES ($1, $2, $3, 'pending', $4, $5)
		RETURNING id
	`, schedule.UserID, schedule.ChatID, schedule.Topic, len(questions), time.Now()).Scan(&quizID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create quiz: " + err.Error()})
		return
	}

	// 6. Insert all questions
	for i, q := range questions {
		optionsJSON, _ := json.Marshal(q.Options)
		_, err = config.DB.Exec(`
			INSERT INTO quiz_questions (quiz_id, question, answer, options, order_num)
			VALUES ($1, $2, $3, $4, $5)
		`, quizID, q.Question, q.Answer, string(optionsJSON), i+1)
		if err != nil {
			fmt.Printf("Error inserting question %d: %v\n", i+1, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert questions: " + err.Error()})
			return
		}
	}

	// 7. Advance the schedule's next_scheduled_time for recurring reminders
	if err := advanceSchedule(schedule); err != nil {
		fmt.Printf("Warning: Failed to advance schedule %d: %v\n", schedule.ID, err)
	}

	// 8. Send a chat message notifying the user (with quiz_id so frontend can deep-link)
	reminderMsg := fmt.Sprintf(
		"📅 Time for your scheduled quiz on **%s**!\n\nYour quiz is ready with %d questions (~%d min).\n\nQuiz ID: %d — head to the dashboard to start! 🚀",
		schedule.Topic, len(questions), duration, quizID,
	)
	botMsgID := uuid.New().String()
	_, err = config.DB.Exec(`
		INSERT INTO messages (id, chat_id, role, content, created_at)
		VALUES ($1, $2, 'bot', $3, $4)
	`, botMsgID, schedule.ChatID, reminderMsg, time.Now())
	if err != nil {
		fmt.Printf("Warning: Failed to send reminder message: %v\n", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":         "Quiz reminder sent and quiz generated",
		"chat_id":         schedule.ChatID,
		"topic":           schedule.Topic,
		"quiz_id":         quizID,
		"total_questions": len(questions),
	})
} // StartQuiz generates a new MCQ quiz based on duration
func StartQuiz(c *gin.Context) {
	var body struct {
		UserID   int    `json:"user_id" binding:"required"`
		ChatID   string `json:"chat_id" binding:"required"`
		Topic    string `json:"topic" binding:"required"`
		Duration int    `json:"duration" binding:"required"` // Duration in minutes (5, 10, 15, 30)
	}

	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Verify chat exists and belongs to user
	var chat models.Chat
	err := config.DB.Get(&chat, "SELECT * FROM chats WHERE id=$1 AND user_id=$2", body.ChatID, body.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found"})
		return
	}

	// Check if quiz already exists for this chat (not completed)
	var existingQuiz models.Quiz
	err = config.DB.Get(&existingQuiz, `
		SELECT * FROM quizzes 
		WHERE chat_id=$1 AND status != 'completed' 
		ORDER BY created_at DESC LIMIT 1
	`, body.ChatID)
	if err == nil {
		// Check if the existing quiz has questions
		var questionCount int
		config.DB.Get(&questionCount, `SELECT COUNT(*) FROM quiz_questions WHERE quiz_id=$1`, existingQuiz.ID)

		if questionCount > 0 {
			// Quiz exists with questions - return it so user can continue
			c.JSON(http.StatusOK, gin.H{
				"message":         "Resuming existing quiz",
				"quiz_id":         existingQuiz.ID,
				"topic":           existingQuiz.Topic,
				"total_questions": existingQuiz.TotalQues,
				"existing":        true,
			})
			return
		} else {
			// Quiz exists but has no questions (likely failed generation) - delete it and create new one
			fmt.Printf("Existing quiz %d has no questions, deleting and creating new one\n", existingQuiz.ID)
			config.DB.Exec(`DELETE FROM quizzes WHERE id=$1`, existingQuiz.ID)
		}
	}

	// Calculate number of questions based on duration (approx 2-3 min per question)
	numQuestions := body.Duration / 3
	if numQuestions < 3 {
		numQuestions = 3
	}
	if numQuestions > 20 {
		numQuestions = 20
	}

	// Generate MCQ questions using Groq
	apiKey := services.ResolveGroqAPIKeyFromRequest(c)
	ctx := context.Background()

	questions, err := generateMCQQuestions(ctx, apiKey, body.Topic, numQuestions)
	if err != nil {
		// Fallback to simple questions if Groq fails
		fmt.Printf("Warning: Failed to generate MCQ questions with Groq: %v\n", err)
		questions = generateSimpleMCQQuestions(body.Topic, numQuestions)
	}

	// If Groq returned fewer questions than requested, supplement with fallback
	if len(questions) < numQuestions {
		fmt.Printf("Warning: Groq returned %d questions but %d requested. Supplementing with fallback questions.\n", len(questions), numQuestions)
		fallbackQuestions := generateSimpleMCQQuestions(body.Topic, numQuestions-len(questions))
		// Combine the questions
		allQuestions := make([]struct {
			Question string
			Answer   string
			Options  []string
		}, len(questions)+len(fallbackQuestions))
		copy(allQuestions, questions)
		for i, q := range fallbackQuestions {
			allQuestions[len(questions)+i] = q
		}
		questions = allQuestions[:numQuestions] // Ensure we don't exceed requested number
	}

	// Validate questions were generated
	if len(questions) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate quiz questions"})
		return
	}

	// Ensure we have exactly the requested number (or trim if somehow more)
	if len(questions) > numQuestions {
		questions = questions[:numQuestions]
	}

	// Validate each question has options
	for i, q := range questions {
		if len(q.Options) == 0 {
			fmt.Printf("Warning: Question %d has no options, adding defaults\n", i+1)
			q.Options = []string{"Option A", "Option B", "Option C", "Option D"}
		}
		if q.Options == nil {
			q.Options = []string{}
		}
		questions[i] = q
	}

	// Create quiz
	var quizID int
	err = config.DB.QueryRow(`
		INSERT INTO quizzes (user_id, chat_id, topic, status, total_questions, created_at)
		VALUES ($1, $2, $3, 'pending', $4, $5)
		RETURNING id
	`, body.UserID, body.ChatID, body.Topic, len(questions), time.Now()).Scan(&quizID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create quiz: " + err.Error()})
		return
	}

	// Insert questions
	for i, q := range questions {
		optionsJSON, marshalErr := json.Marshal(q.Options)
		if marshalErr != nil {
			fmt.Printf("Warning: Failed to marshal options for question %d: %v\n", i+1, marshalErr)
			optionsJSON = []byte("[]")
		}
		_, err = config.DB.Exec(`
			INSERT INTO quiz_questions (quiz_id, question, answer, options, order_num)
			VALUES ($1, $2, $3, $4, $5)
		`, quizID, q.Question, q.Answer, string(optionsJSON), i+1)
		if err != nil {
			fmt.Printf("Error inserting question %d: %v\n", i+1, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create questions: " + err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":         "Quiz generated successfully",
		"quiz_id":         quizID,
		"topic":           body.Topic,
		"total_questions": len(questions),
		"duration":        body.Duration,
	})
}

// SubmitQuizAnswer handles user's answer to current question
func SubmitQuizAnswer(c *gin.Context) {
	var body struct {
		UserID int    `json:"user_id" binding:"required"`
		ChatID string `json:"chat_id" binding:"required"`
		Answer string `json:"answer" binding:"required"`
	}

	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Get active quiz
	var quiz models.Quiz
	err := config.DB.Get(&quiz, `
		SELECT * FROM quizzes 
		WHERE chat_id=$1 AND user_id=$2 AND status='in_progress' 
		ORDER BY created_at DESC LIMIT 1
	`, body.ChatID, body.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active quiz found"})
		return
	}

	// Find current unanswered question
	var currentQ models.QuizQuestion
	err = config.DB.Get(&currentQ, `
		SELECT 
			id, 
			quiz_id, 
			question, 
			answer, 
			COALESCE(options, '[]') as options, 
			COALESCE(user_answer, '') as user_answer, 
			COALESCE(is_correct, false) as is_correct, 
			order_num 
		FROM quiz_questions 
		WHERE quiz_id=$1 AND (user_answer IS NULL OR user_answer = '') 
		ORDER BY order_num ASC LIMIT 1
	`, quiz.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "All questions answered"})
		return
	}

	// Check answer (simple string match, can enhance later)
	isCorrect := strings.Contains(strings.ToLower(currentQ.Answer), strings.ToLower(body.Answer)) ||
		strings.Contains(strings.ToLower(body.Answer), strings.ToLower(currentQ.Answer))

	// Update question
	_, err = config.DB.Exec(`
		UPDATE quiz_questions 
		SET user_answer=$1, is_correct=$2 
		WHERE id=$3
	`, body.Answer, isCorrect, currentQ.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update quiz score
	if isCorrect {
		quiz.Score++
		config.DB.Exec("UPDATE quizzes SET score=$1 WHERE id=$2", quiz.Score, quiz.ID)
	}

	// Save user's answer message
	userMsgID := uuid.New().String()
	config.DB.Exec(`
		INSERT INTO messages (id, chat_id, role, content, created_at)
		VALUES ($1, $2, 'user', $3, $4)
	`, userMsgID, body.ChatID, body.Answer, time.Now())

	responseText := ""
	if isCorrect {
		responseText = "✅ Correct! "
	} else {
		responseText = fmt.Sprintf("❌ Not quite. The answer is: %s. ", currentQ.Answer)
	}

	// Get next question
	var nextQ models.QuizQuestion
	nextErr := config.DB.Get(&nextQ, `
		SELECT 
			id, 
			quiz_id, 
			question, 
			answer, 
			COALESCE(options, '[]') as options, 
			COALESCE(user_answer, '') as user_answer, 
			COALESCE(is_correct, false) as is_correct, 
			order_num 
		FROM quiz_questions 
		WHERE quiz_id=$1 AND (user_answer IS NULL OR user_answer = '') 
		ORDER BY order_num ASC LIMIT 1
	`, quiz.ID)

	if nextErr != nil { // No more questions - quiz complete
		now := time.Now()
		finalScore := quiz.Score
		config.DB.Exec(`
			UPDATE quizzes 
			SET status='completed', completed_at=$1, score=$2
			WHERE id=$3
		`, now, finalScore, quiz.ID)

		responseText += fmt.Sprintf("\n🎉 Quiz completed! Your score: %d/%d", finalScore, quiz.TotalQues)
	} else {
		// Next question
		responseText += fmt.Sprintf("\n📝 Question %d/%d:\n%s", nextQ.OrderNum, quiz.TotalQues, nextQ.Question)
	}

	// Send bot response
	botMsgID := uuid.New().String()
	config.DB.Exec(`
		INSERT INTO messages (id, chat_id, role, content, created_at)
		VALUES ($1, $2, 'bot', $3, $4)
	`, botMsgID, body.ChatID, responseText, time.Now())

	c.JSON(http.StatusOK, gin.H{
		"correct":   isCorrect,
		"score":     quiz.Score,
		"response":  responseText,
		"completed": nextErr != nil,
	})
}

// GetQuiz returns all questions for a quiz
func GetQuiz(c *gin.Context) {
	quizIDStr := c.Param("id")
	var quizID int
	_, err := fmt.Sscanf(quizIDStr, "%d", &quizID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid quiz_id"})
		return
	}

	// Get quiz info
	var quiz models.Quiz
	err = config.DB.Get(&quiz, "SELECT * FROM quizzes WHERE id=$1", quizID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Quiz not found"})
		return
	}

	// Get all questions - handle NULL values for user_answer and is_correct
	var questions []models.QuizQuestion
	err = config.DB.Select(&questions, `
		SELECT 
			id, 
			quiz_id, 
			question, 
			answer, 
			COALESCE(options, '[]') as options, 
			COALESCE(user_answer, '') as user_answer, 
			COALESCE(is_correct, false) as is_correct, 
			order_num 
		FROM quiz_questions 
		WHERE quiz_id=$1 
		ORDER BY order_num ASC
	`, quizID)
	if err != nil {
		fmt.Printf("Error fetching questions for quiz %d: %v\n", quizID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch questions: " + err.Error()})
		return
	}

	if len(questions) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No questions found for this quiz"})
		return
	}

	// Parse options JSON for each question
	type QuestionWithOptions struct {
		ID       int      `json:"id"`
		QuizID   int      `json:"quiz_id"`
		Question string   `json:"question"`
		Options  []string `json:"options"`
		OrderNum int      `json:"order_num"`
		Answer   string   `json:"-"` // Hide answer from client
	}

	questionsWithOptions := make([]QuestionWithOptions, len(questions))
	for i, q := range questions {
		var options []string
		if q.Options != "" && q.Options != "null" {
			if err := json.Unmarshal([]byte(q.Options), &options); err != nil {
				fmt.Printf("Warning: Failed to parse options for question %d: %v\n", q.ID, err)
				options = []string{} // Default to empty array
			}
		}
		// Ensure we always have at least an empty array
		if options == nil {
			options = []string{}
		}
		questionsWithOptions[i] = QuestionWithOptions{
			ID:       q.ID,
			QuizID:   q.QuizID,
			Question: q.Question,
			Options:  options,
			OrderNum: q.OrderNum,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"quiz":      quiz,
		"questions": questionsWithOptions,
	})
}

// SubmitCompleteQuiz evaluates all answers at once
func SubmitCompleteQuiz(c *gin.Context) {
	var body struct {
		QuizID  int            `json:"quiz_id" binding:"required"`
		Answers map[int]string `json:"answers" binding:"required"` // question_id -> selected_option (A, B, C, D)
	}

	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Get quiz
	var quiz models.Quiz
	err := config.DB.Get(&quiz, "SELECT * FROM quizzes WHERE id=$1", body.QuizID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Quiz not found"})
		return
	}

	if quiz.Status == "completed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Quiz already completed"})
		return
	}

	// Get all questions - handle NULL values
	var questions []models.QuizQuestion
	err = config.DB.Select(&questions, `
		SELECT 
			id, 
			quiz_id, 
			question, 
			answer, 
			COALESCE(options, '[]') as options, 
			COALESCE(user_answer, '') as user_answer, 
			COALESCE(is_correct, false) as is_correct, 
			order_num 
		FROM quiz_questions 
		WHERE quiz_id=$1 
		ORDER BY order_num ASC
	`, body.QuizID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch questions"})
		return
	}

	// Evaluate answers
	score := 0
	results := make([]map[string]interface{}, len(questions))
	apiKey := services.ResolveGroqAPIKeyFromRequest(c)
	ctx := context.Background()

	for i, q := range questions {
		userAnswer := body.Answers[q.ID]
		var isCorrect bool

		// Check if this is an MCQ question (has options) or text-based
		var options []string
		if q.Options != "" && q.Options != "[]" {
			json.Unmarshal([]byte(q.Options), &options)
		}

		if len(options) > 0 {
			// MCQ: Simple string comparison with answer option (A, B, C, D)
			isCorrect = strings.EqualFold(strings.TrimSpace(q.Answer), strings.TrimSpace(userAnswer))
		} else {
			// Text-based answer: Use AI to check correctness
			isCorrect = checkAnswerWithAI(ctx, apiKey, q.Question, q.Answer, userAnswer)
		}

		if isCorrect {
			score++
		}

		// Update question with user answer
		config.DB.Exec(`
			UPDATE quiz_questions 
			SET user_answer=$1, is_correct=$2 
			WHERE id=$3
		`, userAnswer, isCorrect, q.ID)

		results[i] = map[string]interface{}{
			"question_id":    q.ID,
			"question":       q.Question,
			"options":        options,
			"correct_answer": q.Answer,
			"user_answer":    userAnswer,
			"is_correct":     isCorrect,
		}
	}

	// Update quiz as completed
	now := time.Now()
	config.DB.Exec(`
		UPDATE quizzes 
		SET status='completed', completed_at=$1, score=$2
		WHERE id=$3
	`, now, score, body.QuizID)

	c.JSON(http.StatusOK, gin.H{
		"score":           score,
		"total_questions": len(questions),
		"percentage":      float64(score) / float64(len(questions)) * 100,
		"results":         results,
		"message":         "Quiz completed successfully",
	})
}

// GetQuestion returns a single question by quiz_id and order (for n8n)
func GetQuestion(c *gin.Context) {
	quizID, err := strconv.Atoi(c.Query("quiz_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid quiz_id"})
		return
	}
	order, err := strconv.Atoi(c.Query("order"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order"})
		return
	}

	var quiz models.Quiz
	if err := config.DB.Get(&quiz, "SELECT * FROM quizzes WHERE id=$1", quizID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Quiz not found"})
		return
	}

	var q models.QuizQuestion
	err = config.DB.Get(&q, `
		SELECT id, quiz_id, question, answer, 
		       COALESCE(options, '[]') as options,
		       COALESCE(user_answer, '') as user_answer,
		       COALESCE(is_correct, false) as is_correct,
		       order_num
		FROM quiz_questions 
		WHERE quiz_id=$1 AND order_num=$2
	`, quizID, order)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Question not found"})
		return
	}

	var options []string
	if q.Options != "" && q.Options != "null" {
		json.Unmarshal([]byte(q.Options), &options)
	}

	formattedMsg := formatQuestionMessage(q, order, quiz.TotalQues)

	c.JSON(http.StatusOK, gin.H{
		"quiz_id":       quizID,
		"order":         order,
		"question":      q.Question,
		"options":       options,
		"answer":        q.Answer,
		"formatted_msg": formattedMsg,
		"is_last":       order >= quiz.TotalQues,
	})
}

// SubmitAnswer processes an answer and returns feedback (for n8n)
func SubmitAnswer(c *gin.Context) {
	var body struct {
		QuizID int    `json:"quiz_id" binding:"required"`
		Order  int    `json:"order" binding:"required"`
		Answer string `json:"answer" binding:"required"`
	}
	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var quiz models.Quiz
	if err := config.DB.Get(&quiz, "SELECT * FROM quizzes WHERE id=$1", body.QuizID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Quiz not found"})
		return
	}

// Mark as in_progress if still pending
if quiz.Status == "pending" {
    config.DB.Exec("UPDATE quizzes SET status='in_progress' WHERE id=$1", body.QuizID)
}

	var q models.QuizQuestion
	err := config.DB.Get(&q, `
		SELECT id, quiz_id, question, answer, 
		       COALESCE(options, '[]') as options,
		       COALESCE(user_answer, '') as user_answer,
		       COALESCE(is_correct, false) as is_correct,
		       order_num
		FROM quiz_questions 
		WHERE quiz_id=$1 AND order_num=$2
	`, body.QuizID, body.Order)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Question not found"})
		return
	}

	isCorrect := strings.EqualFold(strings.TrimSpace(q.Answer), strings.TrimSpace(body.Answer))

	config.DB.Exec(`
		UPDATE quiz_questions SET user_answer=$1, is_correct=$2 WHERE id=$3
	`, body.Answer, isCorrect, q.ID)

	newScore := quiz.Score
	if isCorrect {
		newScore++
		config.DB.Exec("UPDATE quizzes SET score=$1 WHERE id=$2", newScore, body.QuizID)
	}

	var feedbackMsg string
	if isCorrect {
		feedbackMsg = "✅ Correct!\n\n"
	} else {
		feedbackMsg = fmt.Sprintf("❌ Wrong! The correct answer was: *%s*\n\n", q.Answer)
	}

	isLast := body.Order >= quiz.TotalQues
	var finalMsg string
	nextOrder := body.Order + 1

	if isLast {
		config.DB.Exec(`
			UPDATE quizzes SET status='completed', score=$1, completed_at=$2 WHERE id=$3
		`, newScore, time.Now(), body.QuizID)
		finalMsg = fmt.Sprintf(
			"🎉 *Quiz Completed!*\n\nYour Score: *%d/%d*\nPercentage: *%.0f%%*",
			newScore, quiz.TotalQues, float64(newScore)/float64(quiz.TotalQues)*100,
		)
	}

	c.JSON(http.StatusOK, gin.H{
		"is_correct":     isCorrect,
		"score":          newScore,
		"total":          quiz.TotalQues,
		"feedback_msg":   feedbackMsg,
		"final_msg":      finalMsg,
		"is_last":        isLast,
		"next_order":     nextOrder,
		"correct_answer": q.Answer,
	})
}

// generateMCQQuestions uses Groq to generate MCQ questions
func generateMCQQuestions(ctx context.Context, apiKey string, topic string, numQuestions int) ([]struct {
	Question string
	Answer   string // "A", "B", "C", or "D"
	Options  []string
}, error) {
	prompt := fmt.Sprintf(`Generate EXACTLY %d multiple choice questions (MCQ) about "%s". 
IMPORTANT: You MUST generate exactly %d questions, no more, no less.

For each question, provide exactly 4 options labeled A, B, C, and D. 
Return the response as a JSON array with this exact format:
[
  {
    "question": "Question text here?",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "answer": "A"
  },
  {
    "question": "Another question here?",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "answer": "B"
  }
  ... (continue for all %d questions)
]
Make sure the questions are relevant to the topic "%s" and test understanding, not just recall. 
Return ONLY the JSON array, no additional text. Count your questions to ensure you have exactly %d questions.`, numQuestions, topic, numQuestions, numQuestions, topic, numQuestions)

	response, err := services.GenerateGroqReply(ctx, apiKey, "", topic, prompt)
	if err != nil {
		return nil, err
	}

	// Parse JSON response
	response = strings.TrimSpace(response)
	// Remove markdown code blocks if present
	if strings.HasPrefix(response, "```json") {
		response = strings.TrimPrefix(response, "```json")
		response = strings.TrimSuffix(response, "```")
		response = strings.TrimSpace(response)
	} else if strings.HasPrefix(response, "```") {
		response = strings.TrimPrefix(response, "```")
		response = strings.TrimSuffix(response, "```")
		response = strings.TrimSpace(response)
	}

	var questionsJSON []struct {
		Question string   `json:"question"`
		Options  []string `json:"options"`
		Answer   string   `json:"answer"`
	}

	if err := json.Unmarshal([]byte(response), &questionsJSON); err != nil {
		return nil, fmt.Errorf("failed to parse Groq response: %w", err)
	}

	// Convert to return type
	questions := make([]struct {
		Question string
		Answer   string
		Options  []string
	}, len(questionsJSON))

	for i, q := range questionsJSON {
		questions[i] = struct {
			Question string
			Answer   string
			Options  []string
		}{
			Question: q.Question,
			Answer:   q.Answer,
			Options:  q.Options,
		}
	}

	// Log how many questions we got
	fmt.Printf("Generated %d questions (requested %d)\n", len(questions), numQuestions)

	// Ensure we have the right number of questions
	if len(questions) > numQuestions {
		questions = questions[:numQuestions]
		fmt.Printf("Trimmed to %d questions\n", len(questions))
	} else if len(questions) < numQuestions {
		fmt.Printf("Warning: Only got %d questions but requested %d\n", len(questions), numQuestions)
	}

	return questions, nil
}

// checkAnswerWithAI uses Groq to evaluate if a text answer is correct
func checkAnswerWithAI(ctx context.Context, apiKey string, question string, correctAnswer string, userAnswer string) bool {
	if strings.TrimSpace(apiKey) == "" {
		// Fallback to simple string comparison if no API key
		return strings.Contains(strings.ToLower(correctAnswer), strings.ToLower(userAnswer)) ||
			strings.Contains(strings.ToLower(userAnswer), strings.ToLower(correctAnswer))
	}

	prompt := fmt.Sprintf(`You are an educational evaluator. Determine if the student's answer is correct for the given question.

Question: %s
Correct Answer: %s
Student's Answer: %s

Evaluate if the student's answer demonstrates understanding of the concept, even if the wording is different. Consider:
- Is the core concept correct?
- Are key terms and ideas present?
- Is the answer factually accurate?

Respond with ONLY "YES" if correct or "NO" if incorrect. No explanations, just YES or NO.`, question, correctAnswer, userAnswer)

	response, err := services.GenerateGroqReply(ctx, apiKey, "", question, prompt)
	if err != nil {
		fmt.Printf("Warning: Failed to check answer with AI: %v\n", err)
		// Fallback to simple comparison
		return strings.Contains(strings.ToLower(correctAnswer), strings.ToLower(userAnswer)) ||
			strings.Contains(strings.ToLower(userAnswer), strings.ToLower(correctAnswer))
	}

	response = strings.TrimSpace(strings.ToUpper(response))
	return strings.Contains(response, "YES") || strings.HasPrefix(response, "YES")
}

// generateSimpleMCQQuestions creates basic MCQ questions as fallback
func generateSimpleMCQQuestions(topic string, numQuestions int) []struct {
	Question string
	Answer   string
	Options  []string
} {
	topic = strings.ToLower(topic)
	baseQuestions := []struct {
		Question string
		Answer   string
		Options  []string
	}{
		{
			Question: fmt.Sprintf("What is the main topic discussed about %s?", topic),
			Options:  []string{topic, "A different topic", "Unrelated subject", "Random topic"},
			Answer:   "A",
		},
		{
			Question: fmt.Sprintf("Which is most relevant to %s?", topic),
			Options:  []string{topic + " concepts", "Cooking recipes", "Sports news", "Weather forecast"},
			Answer:   "A",
		},
		{
			Question: fmt.Sprintf("What did you learn about %s?", topic),
			Options:  []string{"Key concepts", "Nothing", "Random facts", "Unrelated info"},
			Answer:   "A",
		},
	}

	// Repeat base questions to reach numQuestions
	questions := make([]struct {
		Question string
		Answer   string
		Options  []string
	}, numQuestions)
	for i := 0; i < numQuestions; i++ {
		questions[i] = baseQuestions[i%len(baseQuestions)]
	}

	return questions

}

// advanceSchedule moves the next_scheduled_time forward for recurring schedules.
// For "once" schedules, it deactivates them.
func advanceSchedule(schedule models.Schedule) error {
	if schedule.RecurrenceType == "once" {
		_, err := config.DB.Exec("UPDATE schedules SET active=false WHERE id=$1", schedule.ID)
		return err
	}

	var nextTime time.Time
	now := time.Now()

	// Parse reminder time from schedule
	t, err := time.Parse("15:04", schedule.ReminderTime)
	if err != nil {
		return fmt.Errorf("invalid reminder_time in schedule: %w", err)
	}
	hour := t.Hour()
	minute := t.Minute()

	switch schedule.RecurrenceType {
	case "daily":
		// Next occurrence = same time tomorrow
		tomorrow := now.AddDate(0, 0, 1)
		nextTime = time.Date(tomorrow.Year(), tomorrow.Month(), tomorrow.Day(), hour, minute, 0, 0, now.Location())

	case "weekly":
		// Use the same calculation as initial scheduling
		// Add a day to ensure we advance past current time
		nextDay := now.AddDate(0, 0, 1)
		nextTime = calculateNextWeeklyReminder(nextDay, schedule.DaysOfWeek, hour, minute)

	default:
		return fmt.Errorf("unknown recurrence_type: %s", schedule.RecurrenceType)
	}

	_, err = config.DB.Exec(
		"UPDATE schedules SET scheduled_time=$1 WHERE id=$2",
		nextTime, schedule.ID,
	)
	return err
}
