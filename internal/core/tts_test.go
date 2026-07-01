package core

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"testing"
)

func TestSynthesizeSpeech(t *testing.T) {
	apiKey := os.Getenv("TTS_API_KEY")
	if apiKey == "" {
		t.Skip("TTS_API_KEY not set")
	}

	baseUrl := "https://api.xiaomimimo.com/v1"

	messages := []chatMessage{
		{Role: "user", Content: "用轻快的语调"},
		{Role: "assistant", Content: "你好世界，今天天气真好！"},
	}

	reqBody := chatRequest{
		Model:    "mimo-v2.5-tts",
		Messages: messages,
		Audio: audioConfig{
			Format: "wav",
			Voice:  "mimo_default",
		},
		Stream: false,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	t.Logf("Request: %s", string(jsonData))

	url := baseUrl + "/chat/completions"
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("create request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api-key", apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("send request: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read response: %v", err)
	}

	t.Logf("Status: %d", resp.StatusCode)
	t.Logf("Response length: %d bytes", len(body))

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("API returned %d: %s", resp.StatusCode, string(body))
	}

	var chatResp chatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if len(chatResp.Choices) == 0 {
		t.Fatal("no choices in response")
	}

	audioData := chatResp.Choices[0].Message.Audio.Data
	t.Logf("Audio data length: %d chars", len(audioData))

	if audioData == "" {
		t.Fatal("empty audio data")
	}

	decoded, err := base64.StdEncoding.DecodeString(audioData)
	if err != nil {
		t.Fatalf("decode base64: %v", err)
	}

	t.Logf("Decoded audio: %d bytes", len(decoded))

	if len(decoded) < 100 {
		t.Fatal("audio too small")
	}

	// Write to file for manual testing
	err = os.WriteFile("test_output.wav", decoded, 0644)
	if err != nil {
		t.Fatalf("write file: %v", err)
	}

	t.Log("Audio saved to test_output.wav")
}

func TestSynthesizeSpeechIntegration(t *testing.T) {
	apiKey := os.Getenv("TTS_API_KEY")
	if apiKey == "" {
		t.Skip("TTS_API_KEY not set")
	}
	s := &Service{apiKey: apiKey}

	audioData, format, err := s.SynthesizeSpeech(context.Background(), "你好世界", "mimo-v2.5-tts", "mimo_default", "", false)
	if err != nil {
		t.Fatalf("SynthesizeSpeech: %v", err)
	}

	t.Logf("Format: %s", format)
	t.Logf("Audio data: %d bytes", len(audioData))

	if len(audioData) < 100 {
		t.Fatal("audio too small")
	}

	err = os.WriteFile(fmt.Sprintf("test_integration.%s", format), audioData, 0644)
	if err != nil {
		t.Fatalf("write file: %v", err)
	}

	t.Logf("Audio saved to test_integration.%s", format)
}
