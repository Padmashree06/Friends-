package handlers

import (
	"strings"

	"golang-service/services"
)

func setTopic(message string) string {
	topic := services.ExtractTopicFromMessage(message)
	if strings.TrimSpace(topic) == "" {
		return "General"
	}
	return topic
}
