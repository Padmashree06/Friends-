package services

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
)

// SendWhatsAppMessage sends a message via Twilio WhatsApp API
// Phone format: "whatsapp:+919876543210"
func SendWhatsAppMessage(to, message string) error {
	accountSID := os.Getenv("TWILIO_ACCOUNT_SID")
	authToken := os.Getenv("TWILIO_AUTH_TOKEN")
	fromNumber := os.Getenv("TWILIO_WHATSAPP_FROM")

	if accountSID == "" || authToken == "" {
		return fmt.Errorf("Twilio credentials not set")
	}

	normalizedTo := normalizeToE164(to)
	if normalizedTo == "" {
		return fmt.Errorf("invalid destination phone number")
	}
	to = "whatsapp:" + normalizedTo

	fromNumber = normalizeWhatsAppFrom(fromNumber)
	if fromNumber == "" {
		// Twilio WhatsApp sandbox default sender.
		fromNumber = "whatsapp:+14155238886"
	}

	apiURL := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", accountSID)

	msgData := url.Values{}
	msgData.Set("To", to)
	msgData.Set("From", fromNumber)
	msgData.Set("Body", message)

	client := &http.Client{}
	req, err := http.NewRequest("POST", apiURL, strings.NewReader(msgData.Encode()))
	if err != nil {
		return err
	}

	req.SetBasicAuth(accountSID, authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("Twilio error: HTTP %d", resp.StatusCode)
	}
	return nil
}

func normalizeWhatsAppFrom(from string) string {
	from = strings.TrimSpace(strings.TrimPrefix(from, "whatsapp:"))
	e164 := normalizeToE164(from)
	if e164 == "" {
		return ""
	}
	return "whatsapp:" + e164
}

func normalizeToE164(raw string) string {
	s := strings.TrimSpace(strings.TrimPrefix(raw, "whatsapp:"))
	if s == "" {
		return ""
	}

	// Keep only digits and leading plus.
	clean := strings.Builder{}
	for i, r := range s {
		if r >= '0' && r <= '9' {
			clean.WriteRune(r)
			continue
		}
		if r == '+' && i == 0 {
			clean.WriteRune(r)
		}
	}
	s = clean.String()
	if s == "" {
		return ""
	}

	if strings.HasPrefix(s, "00") {
		s = "+" + strings.TrimPrefix(s, "00")
	}

	if strings.HasPrefix(s, "+") {
		if len(s) < 8 {
			return ""
		}
		return s
	}

	// Apply default country code when number is not in international format.
	defaultCC := strings.TrimPrefix(strings.TrimSpace(os.Getenv("DEFAULT_COUNTRY_CODE")), "+")
	if defaultCC == "" {
		defaultCC = "962"
	}
	s = strings.TrimLeft(s, "0")
	if s == "" {
		return ""
	}
	return "+" + defaultCC + s
}
