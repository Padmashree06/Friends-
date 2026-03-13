package handlers

import (
	"golang-service/config"
	"golang-service/middleware"
	"golang-service/models"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func SignUp(c *gin.Context) {

	var input models.User
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Username, email, and password are required"})
		return
	}

	if input.Email == "" || input.Password == "" || input.Username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Username, email, and password are required"})
		return
	}

	var exists bool
	err := config.DB.Get(&exists, "SELECT EXISTS(SELECT 1 FROM users WHERE email=$1)", input.Email)
	if err == nil && exists {
		c.JSON(http.StatusBadRequest, gin.H{"message": "User already exists with this email"})
		return
	}
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error hashing password"})
		return
	}

	err = config.DB.QueryRow(
		"INSERT INTO users (username, email, password, phone) VALUES ($1, $2, $3, $4) RETURNING id",
		input.Username, input.Email, string(hashedPassword), input.Phone,
	).Scan(&input.ID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error saving user: " + err.Error()})
		return
	}

	token, err := middleware.GenerateAcessToken(input.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error generating token"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"user": gin.H{
			"id":       input.ID,
			"username": input.Username,
			"email":    input.Email,
		},
	})

}

func Login(c *gin.Context) {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid input"})
		return
	}

	var user models.User
	err := config.DB.Get(&user, "SELECT id, username, email, password FROM users WHERE email=$1", input.Email)
	if err != nil {
		log.Printf("Failed login attempt for email %s: %s", input.Email, "user not found")
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid email or user not found"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		log.Printf("Failed login attempt for email %s: %s", input.Email, "invalid password")
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid password"})
		return
	}

	token, err := middleware.GenerateAcessToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error generating token"})
		return
	}

	// Check if user has completed onboarding
	hasCompletedOnboarding, err := middleware.CheckUserOnboardingStatus(user.ID)
	if err != nil {
		log.Printf("Error checking onboarding status for user %d: %v", user.ID, err)
		// Continue anyway, default to false
		hasCompletedOnboarding = false
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
		},
		"hasCompletedOnboarding": hasCompletedOnboarding,
	})
}
