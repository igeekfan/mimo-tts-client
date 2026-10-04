package core

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"strings"
	"time"
)

const (
	MaxSynthesisTextBytes  = 20 << 10
	MaxSynthesisStyleBytes = 4 << 10
	MaxVoiceLabelBytes     = 512
	MaxVoiceDesignBytes    = 4 << 10
	maxUpstreamBodyBytes   = 68 << 20
	maxStreamLineBytes     = 2 << 20
	maxStreamDuration      = 5 * time.Minute
)

var (
	// Redirects are rejected so an api-key header can never be carried into a
	// redirected request.
	synthClient = newSynthesisClient(120 * time.Second)
	// Bound the entire exchange after headers as well as the initial response.
	// Callers can still impose a shorter request-scoped context deadline.
	streamClient = newStreamClient(maxStreamDuration)
)

func newSynthesisClient(timeout time.Duration) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	return &http.Client{Transport: transport, Timeout: timeout, CheckRedirect: rejectRedirect}
}

func newStreamClient(timeout time.Duration) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.ResponseHeaderTimeout = 60 * time.Second
	return &http.Client{Transport: transport, Timeout: timeout, CheckRedirect: rejectRedirect}
}

func rejectRedirect(_ *http.Request, _ []*http.Request) error {
	return http.ErrUseLastResponse
}

type RequestValidationError struct {
	Field   string
	Message string
}

func (e *RequestValidationError) Error() string {
	if e.Field == "" {
		return e.Message
	}
	return e.Field + ": " + e.Message
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

func truncateForLog(value string, maxLen int) string {
	if len(value) <= maxLen {
		return value
	}
	return value[:maxLen] + "..."
}

func normalizeSynthesisRequest(req SynthesisRequest) SynthesisRequest {
	if req.Model == "" {
		req.Model = ModelPreset
	}
	if req.Model == ModelPreset && req.Voice == "" {
		req.Voice = "mimo_default"
	}
	return req
}

// ValidateSynthesisRequest applies the same boundary checks for desktop and
// web callers. In particular, cloned audio may only travel in CloneAudioData.
func ValidateSynthesisRequest(input SynthesisRequest) error {
	req := normalizeSynthesisRequest(input)
	if strings.TrimSpace(req.Text) == "" {
		return &RequestValidationError{Field: "text", Message: "is required"}
	}
	if len(req.Text) > MaxSynthesisTextBytes {
		return &RequestValidationError{Field: "text", Message: "is too large"}
	}
	if len(req.Style) > MaxSynthesisStyleBytes {
		return &RequestValidationError{Field: "style", Message: "is too large"}
	}

	switch req.Model {
	case ModelPreset:
		if err := validateSafeVoice(req.Voice, MaxVoiceLabelBytes, true); err != nil {
			return err
		}
	case ModelVoiceDesign:
		if strings.TrimSpace(req.Voice) == "" {
			return &RequestValidationError{Field: "voice", Message: "is required for voice design"}
		}
		if err := validateSafeVoice(req.Voice, MaxVoiceDesignBytes, false); err != nil {
			return err
		}
	case ModelVoiceClone:
		if err := validateSafeVoice(req.Voice, MaxVoiceLabelBytes, false); err != nil {
			return err
		}
		if err := validateCloneAudioData(req.CloneAudioData); err != nil {
			return err
		}
	default:
		return &RequestValidationError{Field: "model", Message: "is not supported"}
	}

	if req.Model != ModelVoiceClone && req.CloneAudioData != "" {
		return &RequestValidationError{Field: "cloneAudioData", Message: "is only allowed for voice clone"}
	}
	return nil
}

func validateSafeVoice(voice string, maxBytes int, required bool) error {
	if required && strings.TrimSpace(voice) == "" {
		return &RequestValidationError{Field: "voice", Message: "is required"}
	}
	if len(voice) > maxBytes {
		return &RequestValidationError{Field: "voice", Message: "is too large"}
	}
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(voice)), "data:") {
		return &RequestValidationError{Field: "voice", Message: "must not contain audio data"}
	}
	return nil
}

func validateCloneAudioData(dataURL string) error {
	if dataURL == "" {
		return &RequestValidationError{Field: "cloneAudioData", Message: "is required for voice clone"}
	}
	comma := strings.IndexByte(dataURL, ',')
	if comma <= len("data:") || !strings.HasPrefix(strings.ToLower(dataURL), "data:") {
		return &RequestValidationError{Field: "cloneAudioData", Message: "must be a base64 audio data URL"}
	}
	metadata := strings.ToLower(dataURL[len("data:"):comma])
	parts := strings.Split(metadata, ";")
	if len(parts) != 2 || parts[1] != "base64" {
		return &RequestValidationError{Field: "cloneAudioData", Message: "must be base64 encoded"}
	}
	switch parts[0] {
	case "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave":
	default:
		return &RequestValidationError{Field: "cloneAudioData", Message: "must be MP3 or WAV audio"}
	}

	payload := dataURL[comma+1:]
	if payload == "" {
		return &RequestValidationError{Field: "cloneAudioData", Message: "must not be empty"}
	}
	if strings.ContainsAny(payload, " \t\r\n") {
		return &RequestValidationError{Field: "cloneAudioData", Message: "contains invalid base64 whitespace"}
	}
	decoder := base64.NewDecoder(base64.StdEncoding.Strict(), strings.NewReader(payload))
	decodedBytes, err := io.Copy(io.Discard, io.LimitReader(decoder, MaxCloneAudioBytes+1))
	if err != nil {
		return &RequestValidationError{Field: "cloneAudioData", Message: "contains invalid base64"}
	}
	if decodedBytes == 0 {
		return &RequestValidationError{Field: "cloneAudioData", Message: "must not be empty"}
	}
	if decodedBytes > MaxCloneAudioBytes {
		return &RequestValidationError{Field: "cloneAudioData", Message: "exceeds the 10 MiB limit"}
	}
	return nil
}

func (s *Service) buildMessages(text, style, voice, model string, optimizeTextPreview bool) []chatMessage {
	messages := []chatMessage{}
	if model == ModelVoiceDesign {
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

func (s *Service) getAPIConfig() (apiKey, baseURL string, err error) {
	settings := s.GetSettings()
	apiKey = settings.ApiKey
	if apiKey == "" {
		apiKey = s.apiKey
	}
	if apiKey == "" {
		return "", "", fmt.Errorf("%s", s.translate("err.api_key_missing"))
	}

	baseURL = s.FixedBaseURL()
	if baseURL == "" {
		baseURL = settings.BaseUrl
		if baseURL == "" {
			baseURL = DefaultBaseURL
		}
		baseURL, err = normalizeBaseURL(baseURL)
		if err != nil {
			return "", "", err
		}
	}
	return apiKey, baseURL, nil
}

func (s *Service) translate(key string) string {
	if s.i18n == nil {
		return key
	}
	return s.i18n.T(key)
}

func (s *Service) buildChatRequest(req SynthesisRequest, format string, stream bool) chatRequest {
	audio := audioConfig{Format: format}
	switch req.Model {
	case ModelVoiceDesign:
		if req.OptimizeTextPreview {
			audio.OptimizeTextPreview = &req.OptimizeTextPreview
		}
	case ModelVoiceClone:
		audio.Voice = req.CloneAudioData
	default:
		audio.Voice = req.Voice
	}
	return chatRequest{
		Model:    req.Model,
		Messages: s.buildMessages(req.Text, req.Style, req.Voice, req.Model, req.OptimizeTextPreview),
		Audio:    audio,
		Stream:   stream,
	}
}

func (s *Service) SynthesizeSpeech(ctx context.Context, input SynthesisRequest) ([]byte, string, error) {
	req := normalizeSynthesisRequest(input)
	if err := ValidateSynthesisRequest(req); err != nil {
		return nil, "", err
	}
	apiKey, baseURL, err := s.getAPIConfig()
	if err != nil {
		return nil, "", err
	}

	jsonData, err := json.Marshal(s.buildChatRequest(req, "wav", false))
	if err != nil {
		return nil, "", fmt.Errorf("%s: %w", s.translate("err.marshal_request"), err)
	}
	s.emitLog("[TTS] 请求: model=%s, voice=%s, format=wav, textLen=%d", req.Model, truncateForLog(req.Voice, 30), len(req.Text))
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/chat/completions", bytes.NewReader(jsonData))
	if err != nil {
		return nil, "", fmt.Errorf("%s: %w", s.translate("err.create_request"), err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("api-key", apiKey)

	resp, err := synthClient.Do(request)
	if err != nil {
		return nil, "", fmt.Errorf("%s: %w", s.translate("err.api_request"), err)
	}
	defer resp.Body.Close()
	body, err := readLimitedBody(resp.Body, maxUpstreamBodyBytes)
	if err != nil {
		return nil, "", fmt.Errorf("%s: %w", s.translate("err.read_response"), err)
	}
	if resp.StatusCode != http.StatusOK {
		var errResp chatResponse
		if json.Unmarshal(body, &errResp) == nil && errResp.Error != nil {
			return nil, "", fmt.Errorf("%s: %s", s.translate("err.api_error"), errResp.Error.Message)
		}
		return nil, "", fmt.Errorf("%s %d: %s", s.translate("err.api_status"), resp.StatusCode, truncateForLog(string(body), 200))
	}

	var chatResp chatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return nil, "", fmt.Errorf("%s: %w", s.translate("err.parse_response"), err)
	}
	if chatResp.Error != nil {
		return nil, "", fmt.Errorf("%s: %s", s.translate("err.api_error"), chatResp.Error.Message)
	}
	if len(chatResp.Choices) == 0 {
		return nil, "", fmt.Errorf("%s", s.translate("err.empty_result"))
	}
	audioBase64 := chatResp.Choices[0].Message.Audio.Data
	if audioBase64 == "" {
		return nil, "", fmt.Errorf("%s", s.translate("err.no_audio"))
	}
	audioData, err := decodeStrictBase64(audioBase64)
	if err != nil {
		return nil, "", fmt.Errorf("%s: %w", s.translate("err.decode_audio"), err)
	}
	if len(audioData) == 0 {
		return nil, "", fmt.Errorf("%s", s.translate("err.no_audio"))
	}

	s.emitLog("[TTS] 合成完成: %d bytes", len(audioData))
	if len(audioData) >= 4 && string(audioData[:4]) == "RIFF" {
		return audioData, "wav", nil
	}
	return addWavHeader(audioData, 24000, 1, 16), "wav", nil
}

type StreamChunkCallback func(chunk []byte) error

func (s *Service) SynthesizeSpeechStream(ctx context.Context, input SynthesisRequest, callback StreamChunkCallback) error {
	req := normalizeSynthesisRequest(input)
	if err := ValidateSynthesisRequest(req); err != nil {
		return err
	}
	if callback == nil {
		return fmt.Errorf("stream callback is required")
	}
	apiKey, baseURL, err := s.getAPIConfig()
	if err != nil {
		return err
	}

	jsonData, err := json.Marshal(s.buildChatRequest(req, "pcm16", true))
	if err != nil {
		return fmt.Errorf("%s: %w", s.translate("err.marshal_request"), err)
	}
	s.emitLog("[TTS Stream] 请求: model=%s, voice=%s, format=pcm16, textLen=%d", req.Model, truncateForLog(req.Voice, 30), len(req.Text))
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/chat/completions", bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("%s: %w", s.translate("err.create_request"), err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("api-key", apiKey)

	resp, err := streamClient.Do(request)
	if err != nil {
		return fmt.Errorf("%s: %w", s.translate("err.api_request"), err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, readErr := readLimitedBody(resp.Body, 1<<20)
		if readErr != nil {
			return fmt.Errorf("%s %d", s.translate("err.api_status"), resp.StatusCode)
		}
		return fmt.Errorf("%s %d: %s", s.translate("err.api_status"), resp.StatusCode, truncateForLog(string(body), 200))
	}
	mediaType, _, err := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	if err != nil || mediaType != "text/event-stream" {
		return fmt.Errorf("upstream returned an invalid stream content type")
	}
	return consumeUpstreamStream(resp.Body, callback)
}

func consumeUpstreamStream(reader io.Reader, callback StreamChunkCallback) error {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 0, 64<<10), maxStreamLineBytes)
	seenDone := false
	seenAudio := false

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" || strings.HasPrefix(line, ":") {
			continue
		}
		if !strings.HasPrefix(line, "data:") {
			return fmt.Errorf("invalid upstream stream line")
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			seenDone = true
			break
		}
		if data == "" {
			return fmt.Errorf("empty upstream stream event")
		}

		var chunk streamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			return fmt.Errorf("invalid upstream stream JSON: %w", err)
		}
		if chunk.Error != nil {
			return fmt.Errorf("upstream API error: %s", chunk.Error.Message)
		}
		for _, choice := range chunk.Choices {
			encoded := choice.Delta.Audio.Data
			if encoded == "" {
				continue
			}
			audioBytes, err := decodeStrictBase64(encoded)
			if err != nil {
				return fmt.Errorf("invalid upstream audio base64: %w", err)
			}
			if len(audioBytes) == 0 {
				return fmt.Errorf("upstream returned an empty audio chunk")
			}
			if err := callback(audioBytes); err != nil {
				return err
			}
			seenAudio = true
		}
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read upstream stream: %w", err)
	}
	if !seenDone {
		return fmt.Errorf("upstream stream ended without [DONE]")
	}
	if !seenAudio {
		return fmt.Errorf("upstream stream completed without audio")
	}
	return nil
}

func decodeStrictBase64(encoded string) ([]byte, error) {
	if strings.ContainsAny(encoded, " \t\r\n") {
		return nil, fmt.Errorf("base64 contains whitespace")
	}
	return base64.StdEncoding.Strict().DecodeString(encoded)
}

func readLimitedBody(reader io.Reader, maxBytes int64) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(reader, maxBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > maxBytes {
		return nil, fmt.Errorf("response exceeds %d bytes", maxBytes)
	}
	return data, nil
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

func writeUint16(buf *bytes.Buffer, value uint16) {
	buf.WriteByte(byte(value))
	buf.WriteByte(byte(value >> 8))
}

func writeUint32(buf *bytes.Buffer, value uint32) {
	buf.WriteByte(byte(value))
	buf.WriteByte(byte(value >> 8))
	buf.WriteByte(byte(value >> 16))
	buf.WriteByte(byte(value >> 24))
}
