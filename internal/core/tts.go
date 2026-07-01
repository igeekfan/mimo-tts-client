package core

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

var (
	// synthClient is used for non-streaming synthesis. A generous overall
	// timeout guards against a hung upstream while still allowing long text.
	synthClient = &http.Client{Timeout: 120 * time.Second}

	// streamClient is used for streaming synthesis. It must not set an overall
	// Timeout (which would abort a long stream); it bounds only the time to
	// receive response headers. Cancelling the stream body is done via context.
	streamClient = newStreamClient()
)

func newStreamClient() *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.ResponseHeaderTimeout = 60 * time.Second
	return &http.Client{Transport: transport}
}

type chatRequest struct {
	Model    string        `json:"model"`
	Messages []chatMessage `json:"messages"`
	Audio    audioConfig   `json:"audio"`
	Stream   bool          `json:"stream"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type audioConfig struct {
	Format              string `json:"format"`
	Voice               string `json:"voice,omitempty"`
	OptimizeTextPreview *bool  `json:"optimize_text_preview,omitempty"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Audio struct {
				Data string `json:"data"`
			} `json:"audio"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type streamChunk struct {
	Choices []struct {
		Delta struct {
			Audio struct {
				Data string `json:"data"`
			} `json:"audio"`
		} `json:"delta"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func truncateForLog(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

func (s *Service) buildMessages(text, style, voice, model string, optimizeTextPreview bool) []chatMessage {
	messages := []chatMessage{}
	if model == "mimo-v2.5-tts-voicedesign" {
		messages = append(messages, chatMessage{Role: "user", Content: voice})
		if !optimizeTextPreview {
			messages = append(messages, chatMessage{Role: "assistant", Content: text})
		}
		return messages
	}
	if style != "" {
		messages = append(messages, chatMessage{Role: "user", Content: style})
	} else {
		messages = append(messages, chatMessage{Role: "user", Content: ""})
	}
	messages = append(messages, chatMessage{Role: "assistant", Content: text})
	return messages
}

func (s *Service) getApiConfig() (apiKey, baseUrl string, err error) {
	settings := s.GetSettings()
	apiKey = settings.ApiKey
	if apiKey == "" {
		apiKey = s.apiKey
	}
	if apiKey == "" {
		return "", "", fmt.Errorf("%s", s.i18n.T("err.api_key_missing"))
	}
	baseUrl = settings.BaseUrl
	if baseUrl == "" {
		baseUrl = "https://api.xiaomimimo.com/v1"
	}
	return apiKey, baseUrl, nil
}

func (s *Service) SynthesizeSpeech(ctx context.Context, text, model, voice, style string, optimizeTextPreview bool) ([]byte, string, error) {
	apiKey, baseUrl, err := s.getApiConfig()
	if err != nil {
		return nil, "", err
	}

	if model == "" {
		model = "mimo-v2.5-tts"
	}
	if voice == "" && model != "mimo-v2.5-tts-voicedesign" {
		voice = "mimo_default"
	}

	messages := s.buildMessages(text, style, voice, model, optimizeTextPreview)

	audioCfg := audioConfig{Format: "wav"}
	if model != "mimo-v2.5-tts-voicedesign" {
		audioCfg.Voice = voice
	} else if optimizeTextPreview {
		audioCfg.OptimizeTextPreview = &optimizeTextPreview
	}

	reqBody := chatRequest{
		Model:    model,
		Messages: messages,
		Audio:    audioCfg,
		Stream:   false,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, "", fmt.Errorf("%s: %w", s.i18n.T("err.marshal_request"), err)
	}

	s.emitLog("[TTS] 请求: model=%s, voice=%s, format=wav, textLen=%d", model, truncateForLog(voice, 30), len(text))

	url := baseUrl + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, "", fmt.Errorf("%s: %w", s.i18n.T("err.create_request"), err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api-key", apiKey)

	resp, err := synthClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("%s: %w", s.i18n.T("err.api_request"), err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("%s: %w", s.i18n.T("err.read_response"), err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp chatResponse
		if json.Unmarshal(body, &errResp) == nil && errResp.Error != nil {
			return nil, "", fmt.Errorf("%s: %s", s.i18n.T("err.api_error"), errResp.Error.Message)
		}
		return nil, "", fmt.Errorf("%s %d: %s", s.i18n.T("err.api_status"), resp.StatusCode, truncateForLog(string(body), 200))
	}

	var chatResp chatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return nil, "", fmt.Errorf("%s: %w", s.i18n.T("err.parse_response"), err)
	}

	if len(chatResp.Choices) == 0 {
		return nil, "", fmt.Errorf("%s", s.i18n.T("err.empty_result"))
	}

	audioBase64 := chatResp.Choices[0].Message.Audio.Data
	if audioBase64 == "" {
		return nil, "", fmt.Errorf("%s", s.i18n.T("err.no_audio"))
	}

	audioData, err := base64.StdEncoding.DecodeString(audioBase64)
	if err != nil {
		return nil, "", fmt.Errorf("%s: %w", s.i18n.T("err.decode_audio"), err)
	}

	s.emitLog("[TTS] 合成完成: %d bytes", len(audioData))
	if len(audioData) >= 4 && string(audioData[:4]) == "RIFF" {
		return audioData, "wav", nil
	}

	wavData := addWavHeader(audioData, 24000, 1, 16)
	return wavData, "wav", nil
}

type StreamChunkCallback func(chunk []byte) error

func (s *Service) SynthesizeSpeechStream(ctx context.Context, text, model, voice, style string, optimizeTextPreview bool, callback StreamChunkCallback) error {
	apiKey, baseUrl, err := s.getApiConfig()
	if err != nil {
		return err
	}

	if model == "" {
		model = "mimo-v2.5-tts"
	}
	if voice == "" && model != "mimo-v2.5-tts-voicedesign" {
		voice = "mimo_default"
	}

	messages := s.buildMessages(text, style, voice, model, optimizeTextPreview)

	audioCfg := audioConfig{Format: "pcm16"}
	if model != "mimo-v2.5-tts-voicedesign" {
		audioCfg.Voice = voice
	} else if optimizeTextPreview {
		audioCfg.OptimizeTextPreview = &optimizeTextPreview
	}

	reqBody := chatRequest{
		Model:    model,
		Messages: messages,
		Audio:    audioCfg,
		Stream:   true,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("%s: %w", s.i18n.T("err.marshal_request"), err)
	}

	s.emitLog("[TTS Stream] 请求: model=%s, voice=%s, format=pcm16, textLen=%d", model, truncateForLog(voice, 30), len(text))

	url := baseUrl + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("%s: %w", s.i18n.T("err.create_request"), err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api-key", apiKey)

	resp, err := streamClient.Do(req)
	if err != nil {
		return fmt.Errorf("%s: %w", s.i18n.T("err.api_request"), err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("%s %d: %s", s.i18n.T("err.api_status"), resp.StatusCode, truncateForLog(string(body), 200))
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var chunk streamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		if chunk.Error != nil {
			return fmt.Errorf("%s: %s", s.i18n.T("err.api_error"), chunk.Error.Message)
		}

		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Audio.Data != "" {
			audioBytes, err := base64.StdEncoding.DecodeString(chunk.Choices[0].Delta.Audio.Data)
			if err != nil {
				continue
			}
			if err := callback(audioBytes); err != nil {
				return err
			}
		}
	}

	return scanner.Err()
}

func addWavHeader(pcmData []byte, sampleRate int, channels int, bitsPerSample int) []byte {
	byteRate := sampleRate * channels * bitsPerSample / 8
	blockAlign := channels * bitsPerSample / 8
	dataSize := len(pcmData)
	fileSize := 36 + dataSize

	buf := new(bytes.Buffer)

	buf.WriteString("RIFF")
	writeUint32(buf, uint32(fileSize))
	buf.WriteString("WAVE")

	buf.WriteString("fmt ")
	writeUint32(buf, 16)
	writeUint16(buf, 1)
	writeUint16(buf, uint16(channels))
	writeUint32(buf, uint32(sampleRate))
	writeUint32(buf, uint32(byteRate))
	writeUint16(buf, uint16(blockAlign))
	writeUint16(buf, uint16(bitsPerSample))

	buf.WriteString("data")
	writeUint32(buf, uint32(dataSize))
	buf.Write(pcmData)

	return buf.Bytes()
}

func writeUint16(buf *bytes.Buffer, v uint16) {
	buf.WriteByte(byte(v))
	buf.WriteByte(byte(v >> 8))
}

func writeUint32(buf *bytes.Buffer, v uint32) {
	buf.WriteByte(byte(v))
	buf.WriteByte(byte(v >> 8))
	buf.WriteByte(byte(v >> 16))
	buf.WriteByte(byte(v >> 24))
}
