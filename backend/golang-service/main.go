package main

import (
	"fmt"
	"golang-service/config"
	"golang-service/handlers"
	"golang-service/middleware"
	"golang-service/models"
	"golang-service/services"
	"net/http"
	"os"

	//"golang-service/middleware"

	"golang-service/routes"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	config.ConnectDatabase()

	// Start the scheduler
	go services.StartScheduler()

	r := gin.Default()

	// Enable CORS for local frontend
	r.Use(cors.New(cors.Config{
		// Keep explicit list for documentation, but allow via function below
		AllowOrigins:    []string{"http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"},
		AllowOriginFunc: func(origin string) bool { return true },
		AllowMethods:    []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"},
		// Accept any headers requested by the browser during preflight
		AllowHeaders:     []string{"*"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// API key check message (can be removed in production)
	key := "GROQ_API_KEY"
	seen := ""
	if v := os.Getenv(key); v != "" {
		masked := v
		if len(v) > 6 {
			masked = v[:6] + "***"
		}
		seen = fmt.Sprintf("%s=%s", key, masked)
	}

	if seen == "" {
		fmt.Println("⚠️  Groq API key not set (tried: GROQ_API_KEY, GROQ_API_TOKEN, API_KEY)")
	} else {
		fmt.Println("✅ Groq API key detected:", seen)
	}

	// Register API routes
	routes.RegisterRoutes(r)

	// Test endpoint to verify server is running
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "hello guys",
		})
	})

	// Test endpoint for chat routes debugging
	r.GET("/test-chat-routes", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Chat routes are registered",
			"routes": []string{
				"POST /api/chat/start",
				"POST /api/chat/send",
				"GET /api/chat/user/:user_id",
				"DELETE /api/chat/:id",
				"GET /api/chat/:id",
			},
		})
	})

	r.GET("/quiz/question", handlers.GetQuizQuestion)
	r.POST("/quiz/answer", handlers.SubmitWhatsAppAnswer)

	// Get latest quiz by user_id
	r.GET("/api/quiz/latest", func(c *gin.Context) {
		userID := c.Query("user_id")
		if userID == "" {
			c.JSON(400, gin.H{"error": "user_id required"})
			return
		}
		var quiz models.Quiz
		err := config.DB.Get(&quiz, `
			SELECT * FROM quizzes 
			WHERE user_id=$1 AND status='in_progress' 
			ORDER BY created_at DESC LIMIT 1
		`, userID)
		if err != nil {
			c.JSON(404, gin.H{"error": "No active quiz found"})
			return
		}
		c.JSON(200, quiz)
	})

	r.POST("/signup", handlers.SignUp)
	r.POST("/login", handlers.Login)
	r.POST("/userinterest", middleware.SaveUserAnswers)
	r.GET("/profile", func(c *gin.Context) {
		userID, _ := c.Get("user_id")
		c.JSON(http.StatusOK, gin.H{

			"message": "Welcome",
			"user_id": userID,
		})
	})
	r.Run()
}
