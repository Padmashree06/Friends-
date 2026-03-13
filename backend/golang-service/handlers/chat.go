package handlers

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"golang-service/config"
	"golang-service/models"
	"golang-service/services"
)

//
// ---------------- START CHAT ----------------
//

func StartChat(c *gin.Context) {
	var body struct {
		UserID int `json:"user_id"`
	}

	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Always create a fresh empty-topic chat
	chatID := uuid.New().String()
	now := time.Now()

	_, err := config.DB.Exec(`
		INSERT INTO chats (id, user_id, topic, created_at, updated_at)
		VALUES ($1, $2, '', $3, $4)
	`, chatID, body.UserID, now, now)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"chat_id": chatID})
}

//
// ---------------- SEND MESSAGE ----------------
//

func SendMessage(c *gin.Context) {
	var body struct {
		UserID  int    `json:"user_id"`
		ChatID  string `json:"chat_id"`
		Message string `json:"message"`
	}

	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Load chat
	var chat models.Chat
	err := config.DB.Get(&chat,
		"SELECT * FROM chats WHERE id=$1 AND user_id=$2",
		body.ChatID, body.UserID)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	// ---------------- TOPIC CONTROL ----------------

	currentTopic := strings.TrimSpace(chat.Topic)

	if currentTopic == "" {
		// First meaningful message defines topic
		if wordCount(body.Message) >= 3 && body.Message!="Hello" && body.Message!="what's up" {
			newTopic := setTopic(body.Message)

			if strings.TrimSpace(newTopic) != "" {
				_, err := config.DB.Exec(
					"UPDATE chats SET topic=$1 WHERE id=$2",
					newTopic, chat.ID,
				)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				chat.Topic = newTopic
			}
		}
	} else {
		// Enforce topic
		groqKey := services.ResolveGroqAPIKeyFromRequest(c)
		ok, reason, _ := services.CheckTopic(body.ChatID, body.Message, os.Getenv("HF_KEY"), groqKey)
		if !ok {
			c.JSON(409, gin.H{"error": reason})
			return
		}
	}

	// ---------------- SAVE USER MESSAGE ----------------

	userMsgID := uuid.New().String()
	_, err = config.DB.Exec(`
		INSERT INTO messages (id, chat_id, role, content, created_at)
		VALUES ($1, $2, 'user', $3, $4)
	`, userMsgID, body.ChatID, body.Message, time.Now())

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// ---------------- LLM CALL ----------------

	apiKey := services.ResolveGroqAPIKeyFromRequest(c)
	if apiKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "GROQ_API_KEY not set"})
		return
	}

	preferredModel := strings.TrimSpace(c.GetHeader("X-Groq-Model"))

	botReply, err := services.GenerateGroqReply(
		context.Background(),
		apiKey,
		preferredModel,
		chat.Topic,
		body.Message,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// ---------------- SAVE BOT MESSAGE ----------------

	botMsgID := uuid.New().String()
	_, err = config.DB.Exec(`
		INSERT INTO messages (id, chat_id, role, content, created_at)
		VALUES ($1, $2, 'bot', $3, $4)
	`, botMsgID, body.ChatID, botReply, time.Now())

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"reply": botReply})
}

//
// ---------------- GET HISTORY ----------------
//

func GetChatHistory(c *gin.Context) {
	chatID := c.Param("id")
	var messages []models.Message

	err := config.DB.Select(&messages,
		"SELECT * FROM messages WHERE chat_id=$1 ORDER BY created_at ASC",
		chatID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, messages)
}

//
// ---------------- GET USER CHATS ----------------
//

func GetUserChats(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user_id"})
		return
	}

	var chats []models.Chat
	err = config.DB.Select(&chats,
		"SELECT * FROM chats WHERE user_id=$1 ORDER BY updated_at DESC",
		userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, chats)
}

//
// ---------------- DELETE CHAT ----------------
//

func DeleteChat(c *gin.Context) {
	chatID := c.Param("id")

	var body struct {
		UserID int `json:"user_id"`
	}
	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	_, err := config.DB.Exec(
		"DELETE FROM chats WHERE id=$1 AND user_id=$2",
		chatID, body.UserID,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Chat deleted"})
}

//
// ---------------- HELPERS ----------------
//

func wordCount(s string) int {
	return len(strings.Fields(strings.TrimSpace(s)))
}

func isMessageOnTopic(message, topic string) bool {
	m := strings.ToLower(message)
	t := strings.ToLower(strings.TrimSpace(topic))

	if t == "" {
		return true
	}

	return strings.Contains(m, t)
}
