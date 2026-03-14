package routes

import (
	"golang-service/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		chat := api.Group("/chat")
		{
			chat.POST("/start", handlers.StartChat)
			chat.POST("/send", handlers.SendMessage)
			// More specific routes must come before the general one
			chat.GET("/user/:user_id", handlers.GetUserChats)
			chat.POST("/resources/:chat_id", handlers.FetchResourcesHandler)
			chat.GET("/resources/:chat_id", handlers.GetChatResourcesHandler)
			chat.DELETE("/:id", handlers.DeleteChat)
			chat.GET("/:id", handlers.GetChatHistory)
		}

		api.GET("/quiz/state", handlers.GetQuizStateByPhone)
		api.POST("/quiz/state-start", handlers.MarkQuizInProgress)
		api.POST("/quiz/start-progress", handlers.MarkQuizInProgress)

		r.POST("/quiz/whatsapp-trigger", handlers.WhatsAppTriggerQuiz)
		r.POST("/webhook/whatsapp", handlers.WhatsAppWebhook)

		api.GET("/dashboard/:user_id", handlers.GetDashboardData)

		// Schedule endpoints
		api.POST("/schedule", handlers.CreateSchedule)
		api.GET("/schedule/:user_id", handlers.GetUserSchedules)
		api.GET("/schedule/due", handlers.GetDueSchedules) // For n8n/cron
		api.DELETE("/schedule/:id", handlers.CancelSchedule)

		// Quiz endpoints (specific routes first)
		api.POST("/quiz/reminder", handlers.TriggerQuizReminder) // Webhook for n8n
		api.POST("/quiz/start", handlers.StartQuiz)
		api.POST("/quiz/answer", handlers.SubmitQuizAnswer) // Web: user_id, chat_id, answer
		api.POST("/quiz/answer-n8n", handlers.SubmitAnswer) // n8n: quiz_id, order, answer
		api.GET("/quiz/question", handlers.GetQuestion)     // n8n: get question by order
		api.POST("/quiz/submit", handlers.SubmitCompleteQuiz)
		api.GET("/quiz/:id", handlers.GetQuiz) // Must come after specific routes
	}
}
