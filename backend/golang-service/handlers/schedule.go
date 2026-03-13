package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"golang-service/config"
	"golang-service/models"

	"github.com/gin-gonic/gin"
)

// CreateSchedule creates a quiz reminder schedule from the current chat
func CreateSchedule(c *gin.Context) {
	var body struct {
		UserID          int    `json:"user_id" binding:"required"`
		ChatID          string `json:"chat_id" binding:"required"`
		ScheduledTime   string `json:"scheduled_time,omitempty"`           // ISO 8601 format for one-time reminders
		RecurrenceType  string `json:"recurrence_type" binding:"required"` // "daily", "weekly", "once"
		ReminderTime    string `json:"reminder_time" binding:"required"`   // Time of day "HH:MM" or "HH:MM-HH:MM" for range
		ReminderTimeEnd string `json:"reminder_time_end,omitempty"`        // Optional end time for ranges
		DaysOfWeek      string `json:"days_of_week,omitempty"`             // Comma-separated: "1,3,5" for Mon,Wed,Fri
	}

	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Verify chat exists and belongs to user, get topic
	var chat models.Chat
	err := config.DB.Get(&chat, "SELECT * FROM chats WHERE id=$1 AND user_id=$2", body.ChatID, body.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found or unauthorized"})
		return
	}

	var scheduledTime time.Time
	var nextScheduledTime time.Time
	now := time.Now()

	// Calculate next scheduled time based on recurrence type
	if body.RecurrenceType == "once" {
		// One-time reminder - use provided scheduled_time
		if body.ScheduledTime == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "scheduled_time is required for one-time reminders"})
			return
		}
		var err error
		scheduledTime, err = time.Parse(time.RFC3339, body.ScheduledTime)
		if err != nil {
			// Try simpler format
			scheduledTime, err = time.Parse("2006-01-02T15:04:05", body.ScheduledTime)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid time format. Use ISO 8601 (e.g., 2025-10-31T14:30:00Z)"})
				return
			}
		}
		nextScheduledTime = scheduledTime
	} else {
		// Recurring reminder - calculate next occurrence
		// Parse reminder time (HH:MM)
		t, err := time.Parse("15:04", body.ReminderTime)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid reminder time format. Use HH:MM (e.g., 14:30)"})
			return
		}

		// Get hour and minute
		reminderHour := t.Hour()
		reminderMinute := t.Minute()

		today := time.Date(now.Year(), now.Month(), now.Day(), reminderHour, reminderMinute, 0, 0, now.Location())

		if body.RecurrenceType == "daily" {
			// Daily - if time today has passed, schedule for tomorrow
			if today.After(now) || today.Equal(now) {
				nextScheduledTime = today
			} else {
				nextScheduledTime = today.AddDate(0, 0, 1)
			}
		} else if body.RecurrenceType == "weekly" {
			// Weekly - find next matching day of week
			if body.DaysOfWeek == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "days_of_week required for weekly reminders"})
				return
			}
			nextScheduledTime = calculateNextWeeklyReminder(now, body.DaysOfWeek, reminderHour, reminderMinute)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid recurrence_type. Use 'daily', 'weekly', or 'once'"})
			return
		}
		scheduledTime = nextScheduledTime // For compatibility
	}

	// Check if time is in the future
	if nextScheduledTime.Before(now) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Scheduled time must be in the future"})
		return
	}

	// Insert schedule - try with new fields, fallback to old schema if needed
	var scheduleID int
	err = config.DB.QueryRow(`
		INSERT INTO schedules (user_id, chat_id, topic, scheduled_time, active, created_at, recurrence_type, reminder_time, reminder_time_end, days_of_week)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id
	`, body.UserID, body.ChatID, chat.Topic, nextScheduledTime, true, time.Now(), body.RecurrenceType, body.ReminderTime, body.ReminderTimeEnd, body.DaysOfWeek).Scan(&scheduleID)

	if err != nil {
		// Fallback to old schema if new columns don't exist
		err = config.DB.QueryRow(`
			INSERT INTO schedules (user_id, chat_id, topic, scheduled_time, active, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id
		`, body.UserID, body.ChatID, chat.Topic, nextScheduledTime, true, time.Now()).Scan(&scheduleID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create schedule: " + err.Error()})
			return
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":         "Reminder created successfully",
		"schedule_id":     scheduleID,
		"topic":           chat.Topic,
		"recurrence_type": body.RecurrenceType,
		"reminder_time":   body.ReminderTime,
		"next_reminder":   nextScheduledTime.Format(time.RFC3339),
	})
}

// calculateNextWeeklyReminder finds the next occurrence for weekly reminders
func calculateNextWeeklyReminder(now time.Time, daysOfWeek string, hour, minute int) time.Time {
	// Parse days of week (0=Sunday, 1=Monday, etc.)
	var days []int
	// Simple parsing - assumes comma-separated integers
	for _, dayStr := range strings.Split(daysOfWeek, ",") {
		var day int
		fmt.Sscanf(strings.TrimSpace(dayStr), "%d", &day)
		if day >= 0 && day <= 6 {
			days = append(days, day)
		}
	}

	if len(days) == 0 {
		return now.AddDate(0, 0, 1) // Default to tomorrow if invalid
	}

	currentWeekday := int(now.Weekday()) // 0=Sunday, 1=Monday, etc.

	// Sort days for consistent behavior
	for i := 0; i < len(days)-1; i++ {
		for j := i + 1; j < len(days); j++ {
			if days[i] > days[j] {
				days[i], days[j] = days[j], days[i]
			}
		}
	}

	// Check each day in order
	for _, day := range days {
		daysUntil := (day - currentWeekday + 7) % 7

		if daysUntil > 0 {
			// Future day this week
			nextDate := now.AddDate(0, 0, daysUntil)
			return time.Date(nextDate.Year(), nextDate.Month(), nextDate.Day(), hour, minute, 0, 0, now.Location())
		}

		// daysUntil == 0 means today - check if time has passed
		if daysUntil == 0 {
			today := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, now.Location())
			if today.After(now) {
				return today
			}
			// Time has passed today, continue to check next day (will be handled in next iteration or fallback)
		}
	}

	// All days have passed or today is the only option but time passed - get first day next week
	firstDay := days[0]
	daysUntil := (firstDay - currentWeekday + 7) % 7
	if daysUntil == 0 {
		daysUntil = 7
	}
	nextDate := now.AddDate(0, 0, daysUntil)
	return time.Date(nextDate.Year(), nextDate.Month(), nextDate.Day(), hour, minute, 0, 0, now.Location())
}

// GetUserSchedules returns all active schedules for a user
func GetUserSchedules(c *gin.Context) {
	userID := c.Param("user_id")
	var schedules []models.Schedule

	err := config.DB.Select(&schedules, `
		SELECT * FROM schedules 
		WHERE user_id=$1 AND active=true 
		ORDER BY scheduled_time ASC
	`, userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, schedules)
}

// CancelSchedule deactivates a schedule
func CancelSchedule(c *gin.Context) {
	scheduleID := c.Param("id")
	userID := c.Query("user_id") // Optional: verify ownership

	var schedule models.Schedule
	err := config.DB.Get(&schedule, "SELECT * FROM schedules WHERE id=$1", scheduleID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Schedule not found"})
		return
	}

	// Optional: verify user owns this schedule
	if userID != "" {
		if schedule.UserID != parseInt(userID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized"})
			return
		}
	}

	// Deactivate schedule
	_, err = config.DB.Exec("UPDATE schedules SET active=false WHERE id=$1", scheduleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Schedule cancelled successfully"})
}

// GetDueSchedules returns schedules that are due (scheduled_time <= now, active, not sent)
// Useful for n8n/cron jobs to check what needs reminders
func GetDueSchedules(c *gin.Context) {
	var schedules []models.Schedule

	err := config.DB.Select(&schedules, `
		SELECT * FROM schedules 
		WHERE active=true 
		AND scheduled_time <= NOW()
		AND scheduled_time >= NOW() - INTERVAL '1 hour'
		ORDER BY scheduled_time ASC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, schedules)
}

func parseInt(s string) int {
	var n int
	fmt.Sscanf(s, "%d", &n)
	return n
}
