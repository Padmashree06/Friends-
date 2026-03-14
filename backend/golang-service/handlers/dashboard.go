package handlers

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"golang-service/config"
	"golang-service/models"
)

type DashboardData struct {
	Timetable []models.Schedule     `json:"timetable"`
	Resources []models.ChatResource `json:"resources"`
	DailyQuiz *models.QuizQuestion  `json:"daily_quiz"`
	Progress  DashboardProgress     `json:"progress"`
	Activity  []int                 `json:"activity"`
}

type DashboardProgress struct {
	CoursesCompleted struct {
		Completed int `json:"completed"`
		Total     int `json:"total"`
	} `json:"courses_completed"` // mapped to quizzes
	QuizzesPassed struct {
		Passed int `json:"passed"`
		Total  int `json:"total"`
	} `json:"quizzes_passed"`
}

func GetDashboardData(c *gin.Context) {
	userIDStr := c.Param("user_id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var data DashboardData

	log.Printf("[Dashboard] Fetching data for user %d\n", userID)

	// 1. Fetch Timetable (Upcoming Schedules)
	data.Timetable = []models.Schedule{}
	err = config.DB.Select(&data.Timetable,
		`SELECT * FROM schedules 
		 WHERE user_id=$1 AND active=true AND scheduled_time >= NOW() 
		 ORDER BY scheduled_time ASC LIMIT 5`,
		userID,
	)
	if err != nil {
		log.Printf("[Dashboard] Error fetching schedules: %v\n", err)
	} else {
		log.Printf("[Dashboard] Successfully fetched %d schedules\n", len(data.Timetable))
	}

	// 2. Fetch Recent Resources
	data.Resources = []models.ChatResource{}
	err = config.DB.Select(&data.Resources,
		`SELECT cr.* FROM chat_resources cr
		 JOIN chats c ON cr.chat_id = c.id
		 WHERE c.user_id = $1
		 ORDER BY cr.created_at DESC LIMIT 5`,
		userID,
	)
	if err != nil {
		log.Printf("[Dashboard] Error fetching resources: %v\n", err)
	} else {
		log.Printf("[Dashboard] Successfully fetched %d resources\n", len(data.Resources))
	}

	// 3. Fetch Daily Quiz (one unanswered question from an active quiz)
	var question models.QuizQuestion
	err = config.DB.Get(&question,
		`SELECT qq.* FROM quiz_questions qq
		 JOIN quizzes q ON qq.quiz_id = q.id
		 WHERE q.user_id = $1 AND qq.user_answer = ''
		 ORDER BY RANDOM() LIMIT 1`,
		userID,
	)
	if err == nil {
		data.DailyQuiz = &question
		log.Printf("[Dashboard] Successfully fetched daily quiz\n")
	} else {
		log.Printf("[Dashboard] Error/No daily quiz found: %v\n", err)
		data.DailyQuiz = nil
	}

	// 4. Calculate Progress
	var totalQuizzes, completedQuizzes, passedQuizzes int

	err = config.DB.Get(&totalQuizzes, "SELECT COUNT(*) FROM quizzes WHERE user_id=$1", userID)
	if err != nil {
		log.Printf("[Dashboard] Error counting total quizzes: %v\n", err)
	}

	err = config.DB.Get(&completedQuizzes, "SELECT COUNT(*) FROM quizzes WHERE user_id=$1 AND status='completed'", userID)
	if err != nil {
		log.Printf("[Dashboard] Error counting completed quizzes: %v\n", err)
	}

	// Define "passed" as >= 80% score (score is out of total_questions * 10 or similar? Let's assume passed means score >= total_questions * 10 * 0.8)
	// Actually, the quiz scoring logic in standard quiz gives 10 pts per correct. So total possible is total_questions * 10.
	err = config.DB.Get(&passedQuizzes, 
		`SELECT COUNT(*) FROM quizzes 
		 WHERE user_id=$1 AND status='completed' AND score >= (total_questions * 10 * 0.8)`, 
		userID,
	)
	if err != nil {
		log.Printf("[Dashboard] Error counting passed quizzes: %v\n", err)
	}

	data.Progress.CoursesCompleted.Completed = completedQuizzes
	data.Progress.CoursesCompleted.Total = totalQuizzes // Or hardcoded target like 12
	data.Progress.QuizzesPassed.Passed = passedQuizzes
	data.Progress.QuizzesPassed.Total = completedQuizzes

	// 5. Activity (Messages over the last 52 weeks grouped by date)
	// For simplicity, we'll return a flat array representing the 7 (weekly), 30 (monthly) or 365 (yearly) days.
	// Since ActivityGrid calculates timeframe on the frontend, we'll just send daily counts for the last 365 days.
	
	type DailyActivity struct {
		Day   time.Time `db:"day"`
		Count int       `db:"count"`
	}
	var dailyCounts []DailyActivity
	err = config.DB.Select(&dailyCounts,
		`SELECT DATE(m.created_at) as day, COUNT(*) as count 
		 FROM messages m
		 JOIN chats c ON m.chat_id = c.id
		 WHERE c.user_id=$1 AND m.created_at >= NOW() - INTERVAL '365 days'
		 GROUP BY DATE(m.created_at)
		 ORDER BY day ASC`,
		userID,
	)
	if err != nil {
		log.Printf("[Dashboard] Error fetching activity: %v\n", err)
	}

	// Map to an array of 365 ints
	activityMap := make(map[string]int)
	for _, d := range dailyCounts {
		activityMap[d.Day.Format("2006-01-02")] = d.Count
	}

	data.Activity = make([]int, 365)
	now := time.Now()
	for i := 0; i < 365; i++ {
		date := now.AddDate(0, 0, -364+i).Format("2006-01-02")
		// Map count to an intensity level from 0 to 4
		count := activityMap[date]
		level := 0
		if count > 0 {
			level = 1
		}
		if count > 5 {
			level = 2
		}
		if count > 15 {
			level = 3
		}
		if count > 30 {
			level = 4
		}
		data.Activity[i] = level
	}

	c.JSON(http.StatusOK, data)
}
