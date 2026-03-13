package handlers

import (
    "encoding/json"
    "fmt"
    "net/http"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "golang-service/config"
    "golang-service/models"
    "golang-service/services"
)

// FetchResourcesHandler fetches resources for a chat and stores them in DB
func FetchResourcesHandler(c *gin.Context) {
	chatID := c.Param("chat_id")

	// 1. Get chat info
	var chat models.Chat
	err := config.DB.Get(&chat, "SELECT * FROM chats WHERE id=$1", chatID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found"})
		return
	}

	// 2. Get user interests
	var preferences []string

rows, err := config.DB.Queryx(
    "SELECT answers FROM user_answers WHERE user_id=$1 ORDER BY id",
    chat.UserID,
)

if err == nil {
    for rows.Next() {
        var pref string
        if err := rows.Scan(&pref); err == nil {
            preferences = append(preferences, pref)
        }
    }
    rows.Close()
}

// fallback if no preferences found
if len(preferences) == 0 {
    preferences = []string{"videos", "documentation", "articles"}
}

	// 3. Get recent chat messages
	var messages []models.Message
	err = config.DB.Select(&messages, "SELECT * FROM messages WHERE chat_id=$1 ORDER BY created_at DESC LIMIT 10", chatID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch chat context"})
		return
	}
	var chatContext []string
	for _, m := range messages {
		chatContext = append(chatContext, m.Content)
	}

	// 4. Build prompt for Groq API
	prompt := BuildResourcePrompt(preferences, chatContext)
	apiKey := services.ResolveGroqAPIKeyFromRequest(c)
	if apiKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "GROQ_API_KEY not set"})
		return
	}

	resources, err := CallGrokForResources(prompt, apiKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if resources == nil {
		resources = []Resource{}
	}

	// 5. Store resources in DB
	for _, r := range resources {
		_, err := config.DB.Exec(
			`INSERT INTO chat_resources (chat_id, resource_title, resource_url, resource_type, resource_description, llm_explanation, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			chatID, r.Title, r.URL, r.Type, r.Description, r.Explanation, time.Now(),
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store resource: " + err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"resources": resources})
}

func BuildResourcePrompt(preferences []string, chatContext []string) string {

return `
User preferred resource format priority (highest → lowest):
` + strings.Join(preferences, " > ") + `

Chat context:
` + strings.Join(chatContext, " | ") + `

Suggest 5 learning resources about the topic discussed in the chat.

Follow this rule:
Prioritize resources based on the preference order.

Example:
If preferences are:
videos > documentation > articles

Then return approximately:
3 videos
1 documentation
1 article

Return STRICT JSON:

{
 "resources":[
  {
   "title":"...",
   "url":"...",
   "type":"video | article | documentation | course",
   "description":"...",
   "explanation":"Why this resource is useful"
  }
 ]
}
`
}

// Resource struct for Grok API response
 type Resource struct {
	Title       string `json:"title"`
	URL         string `json:"url"`
	Type        string `json:"type"`
	Description string `json:"description"`
	Explanation string `json:"explanation"`
}

// CallGrokForResources calls Grok API and parses resources
func CallGrokForResources(prompt, apiKey string) ([]Resource, error) {
	model := "llama-3.1-70b-versatile"
	url := "https://api.groq.com/openai/v1/chat/completions"
	bodyObj := map[string]interface{}{
		"model": model,
		"messages": []interface{}{
			map[string]interface{}{
				"role": "user",
				"content": prompt,
			},
		},
		"temperature": 0.7,
		"max_tokens": 1024,
	}
	b, _ := json.Marshal(bodyObj)
	req, _ := http.NewRequest(http.MethodPost, url, strings.NewReader(string(b)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	if len(parsed.Choices) == 0 {
		return nil, nil
	}
	var result struct {
		Resources []Resource `json:"resources"`
	}
content := strings.TrimSpace(parsed.Choices[0].Message.Content)
    if err := json.Unmarshal([]byte(content), &result); err != nil {
        // Try extracting JSON object from text (e.g., chatbot text prepended)
        start := strings.Index(content, "{\n \"resources\"")
        if start == -1 {
            start = strings.Index(content, "{\"resources\"")
        }
        if start >= 0 {
            end := strings.LastIndex(content, "}")
            if end > start {
                candidate := content[start : end+1]
                if err2 := json.Unmarshal([]byte(candidate), &result); err2 == nil {
                    return result.Resources, nil
                }
            }
        }

        // If no JSON parse,ForResources return empty array and optional warning in logs
        fmt.Printf("[warn] CallGrok: could not parse resources JSON; raw=%q; err=%v\n", content, err)
        return []Resource{}, nil
    }
    if result.Resources == nil {
        return []Resource{}, nil
	}
	return result.Resources, nil
}

// Handler to get stored resources
func GetChatResourcesHandler(c *gin.Context) {
	chatID := c.Param("chat_id")
	var resources []models.ChatResource
	err := config.DB.Select(&resources, "SELECT * FROM chat_resources WHERE chat_id=$1 ORDER BY created_at DESC", chatID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch resources"})
		return
	}
	if resources == nil {
		resources = []models.ChatResource{}
	}
	fmt.Printf("[debug] GetChatResourcesHandler resources len=%d nil=%v\n", len(resources), resources == nil)
	c.JSON(http.StatusOK, gin.H{"resources": resources})
}
