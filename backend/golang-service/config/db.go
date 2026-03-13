package config

import (
	"fmt"
	"github.com/jmoiron/sqlx"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"log"
	"os"
)

var DB *sqlx.DB

func ConnectDatabase() {

	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error laoding .env")
	}

	ConnStr := os.Getenv("SUPABASE_DB_URL")

	fmt.Println("✅ Environment variables loaded successfully!")
	fmt.Println("Supabase URL:", ConnStr)

	db, err := sqlx.Open("postgres", ConnStr)
	if err != nil {
		log.Fatal("Error opening database:", err)
	}

	err = db.Ping()
	if err != nil {
		log.Fatal("Cannot connect to database:", err)

	}

	fmt.Println(" Connected to Supabase PostgreSQL successfully!")

	// Ensure required tables exist
	createUsers := `
	CREATE TABLE IF NOT EXISTS users (
		id SERIAL PRIMARY KEY,
		username TEXT NOT NULL,
		email TEXT UNIQUE NOT NULL,
		password TEXT NOT NULL,
		refresh_token TEXT,
		created_at TIMESTAMP DEFAULT NOW(),
		updated_at TIMESTAMP DEFAULT NOW()
	);`

	createChats := `
	CREATE TABLE IF NOT EXISTS chats (
		id TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL,
		topic TEXT NOT NULL,
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL
	);`

	createMessages := `
	CREATE TABLE IF NOT EXISTS messages (
		id TEXT PRIMARY KEY,
		chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
		role TEXT NOT NULL,
		content TEXT NOT NULL,
		created_at TIMESTAMP NOT NULL
	);`

	createUserAnswers := `
	CREATE TABLE IF NOT EXISTS user_answers (
		user_id INTEGER NOT NULL,
		question_number INTEGER NOT NULL,
		question TEXT NOT NULL,
		answer TEXT NOT NULL
	);`

	createSchedules := `
	CREATE TABLE IF NOT EXISTS schedules (
		id SERIAL PRIMARY KEY,
		user_id INTEGER NOT NULL,
		chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
		topic TEXT NOT NULL,
		scheduled_time TIMESTAMP NOT NULL,
		active BOOLEAN DEFAULT true,
		created_at TIMESTAMP DEFAULT NOW()
	);`

	createQuizzes := `
	CREATE TABLE IF NOT EXISTS quizzes (
		id SERIAL PRIMARY KEY,
		user_id INTEGER NOT NULL,
		chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
		topic TEXT NOT NULL,
		status TEXT DEFAULT 'pending',
		score INTEGER DEFAULT 0,
		total_questions INTEGER NOT NULL,
		created_at TIMESTAMP DEFAULT NOW(),
		completed_at TIMESTAMP
	);`

	createQuizQuestions := `
	CREATE TABLE IF NOT EXISTS quiz_questions (
		id SERIAL PRIMARY KEY,
		quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
		question TEXT NOT NULL,
		answer TEXT NOT NULL,
		options TEXT,
		user_answer TEXT,
		is_correct BOOLEAN,
		order_num INTEGER NOT NULL
	);`

	createTopicState := `
	CREATE TABLE IF NOT EXISTS chat_topic_state (
		id SERIAL PRIMARY KEY,
		chat_id TEXT NOT NULL,
		topic_text TEXT NOT NULL,
		topic_embedding TEXT NOT NULL,
		subject TEXT NOT NULL,
		scope TEXT NOT NULL,
		entities TEXT NOT NULL,
		locked BOOLEAN DEFAULT false,
		locked_reason TEXT,
		created_at TIMESTAMP DEFAULT NOW()
	);`

	if _, err := db.Exec(createUsers); err != nil {
		log.Fatal("Failed creating users table:", err)
	}
	if _, err := db.Exec(createChats); err != nil {
		log.Fatal("Failed creating chats table:", err)
	}
	if _, err := db.Exec(createMessages); err != nil {
		log.Fatal("Failed creating messages table:", err)
	}
	if _, err := db.Exec(createUserAnswers); err != nil {
		log.Fatal("Failed creating user_answers table:", err)
	}
	if _, err := db.Exec(createSchedules); err != nil {
		log.Fatal("Failed creating schedules table:", err)
	}
	if _, err := db.Exec(createQuizzes); err != nil {
		log.Fatal("Failed creating quizzes table:", err)
	}
	if _, err := db.Exec(createQuizQuestions); err != nil {
		log.Fatal("Failed creating quiz_questions table:", err)
	}

	if _, err := db.Exec(createTopicState); err != nil {
		log.Fatal("Failed creating chat_topic_state table:", err)
	}

	// Migration: Add options column if it doesn't exist
	_, err = db.Exec(`
		DO $$ 
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.columns 
				WHERE table_name = 'quiz_questions' AND column_name = 'options'
			) THEN
				ALTER TABLE quiz_questions ADD COLUMN options TEXT;
			END IF;
		END $$;
	`)
	if err != nil {
		fmt.Printf("Warning: Failed to add options column (might already exist): %v\n", err)
	} else {
		fmt.Println("✅ Added options column to quiz_questions table")
	}

	DB = db
}
