package core

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestValidateSynthesisRequestCloneAudioBoundary(t *testing.T) {
	validAudio := "data:audio/wav;base64," + base64.StdEncoding.EncodeToString([]byte("RIFFtest"))
	tests := []struct {
		name    string
		req     SynthesisRequest
		wantErr bool
	}{
		{
			name: "valid clone uses request scoped audio",
			req:  SynthesisRequest{Text: "hello", Model: ModelVoiceClone, Voice: "sample.wav", CloneAudioData: validAudio},
		},
		{
			name:    "clone audio is required",
			req:     SynthesisRequest{Text: "hello", Model: ModelVoiceClone, Voice: "sample.wav"},
			wantErr: true,
		},
		{
			name:    "voice cannot contain legacy data URI",
			req:     SynthesisRequest{Text: "hello", Model: ModelPreset, Voice: validAudio},
			wantErr: true,
		},
		{
			name:    "clone audio is rejected for preset model",
			req:     SynthesisRequest{Text: "hello", Model: ModelPreset, Voice: "mimo_default", CloneAudioData: validAudio},
			wantErr: true,
		},
		{
			name:    "malformed clone base64 is rejected",
			req:     SynthesisRequest{Text: "hello", Model: ModelVoiceClone, Voice: "sample.wav", CloneAudioData: "data:audio/wav;base64,%%%"},
			wantErr: true,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateSynthesisRequest(test.req)
			if (err != nil) != test.wantErr {
				t.Fatalf("ValidateSynthesisRequest() error = %v, wantErr %v", err, test.wantErr)
			}
		})
	}
}

func TestValidateSynthesisRequestRejectsCloneOverTenMiB(t *testing.T) {
	encoded := base64.StdEncoding.EncodeToString(make([]byte, MaxCloneAudioBytes+1))
	err := ValidateSynthesisRequest(SynthesisRequest{
		Text:           "hello",
		Model:          ModelVoiceClone,
		Voice:          "sample.wav",
		CloneAudioData: "data:audio/wav;base64," + encoded,
	})
	if err == nil || !strings.Contains(err.Error(), "10 MiB") {
		t.Fatalf("expected 10 MiB validation error, got %v", err)
	}
}

func TestBuildChatRequestKeepsCloneAudioOutOfVoiceLabel(t *testing.T) {
	s := NewService("test")
	data := "data:audio/wav;base64,UklGRg=="
	req := SynthesisRequest{Text: "hello", Model: ModelVoiceClone, Voice: "safe.wav", CloneAudioData: data}
	upstream := s.buildChatRequest(req, "wav", false)
	if upstream.Audio.Voice != data {
		t.Fatal("clone audio was not sent in the upstream audio configuration")
	}
	for _, message := range upstream.Messages {
		if strings.Contains(message.Content, "data:audio") {
			t.Fatal("clone audio leaked into an upstream chat message")
		}
	}
}

func TestLockBaseURL(t *testing.T) {
	s := NewService("test")
	if err := s.LockBaseURL("https://example.test/v1/"); err != nil {
		t.Fatalf("LockBaseURL: %v", err)
	}
	if got := s.FixedBaseURL(); got != "https://example.test/v1" {
		t.Fatalf("FixedBaseURL = %q", got)
	}
	if err := s.LockBaseURL("https://example.test/v1"); err != nil {
		t.Fatalf("idempotent lock failed: %v", err)
	}
	if err := s.LockBaseURL("https://attacker.test/v1"); err == nil {
		t.Fatal("changing a locked base URL unexpectedly succeeded")
	}

	for _, invalid := range []string{
		"http://example.test/v1",
		"ftp://example.test/v1",
		"https://user:password@example.test/v1",
		"https://example.test/v1?redirect=1",
		"https://example.test/" + strings.Repeat("a", 4096),
	} {
		other := NewService("test")
		if err := other.LockBaseURL(invalid); err == nil {
			t.Errorf("LockBaseURL(%q) unexpectedly succeeded", invalid)
		}
	}
	if err := NewService("test").LockBaseURL("http://127.0.0.1:8080/v1"); err != nil {
		t.Fatalf("loopback HTTP base URL should be allowed for local upstreams: %v", err)
	}
}

func TestSynthesizeSpeechUsesLockedBaseURLAndAPIKey(t *testing.T) {
	t.Setenv("TTS_API_KEY", "test-api-key")
	var upstreamRequest chatRequest
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" {
			t.Errorf("upstream path = %q", r.URL.Path)
		}
		if got := r.Header.Get("api-key"); got != "test-api-key" {
			t.Errorf("api-key = %q", got)
		}
		if err := json.NewDecoder(r.Body).Decode(&upstreamRequest); err != nil {
			t.Errorf("decode upstream request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"audio":{"data":"AQI="}}}]}`))
	}))
	defer upstream.Close()

	s := NewService("test")
	if err := s.LockBaseURL(upstream.URL + "/v1"); err != nil {
		t.Fatalf("LockBaseURL: %v", err)
	}
	audio, format, err := s.SynthesizeSpeech(context.Background(), SynthesisRequest{Text: "hello", Model: ModelPreset, Voice: "mimo_default"})
	if err != nil {
		t.Fatalf("SynthesizeSpeech: %v", err)
	}
	if format != "wav" || !bytes.HasPrefix(audio, []byte("RIFF")) {
		t.Fatalf("unexpected audio response: format=%q bytes=%d", format, len(audio))
	}
	if upstreamRequest.Audio.Voice != "mimo_default" {
		t.Fatalf("upstream voice = %q", upstreamRequest.Audio.Voice)
	}
}

func TestSynthesisClientRejectsRedirects(t *testing.T) {
	redirected := false
	destination := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		redirected = true
	}))
	defer destination.Close()
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, destination.URL, http.StatusTemporaryRedirect)
	}))
	defer source.Close()

	req, err := http.NewRequest(http.MethodPost, source.URL, strings.NewReader("{}"))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("api-key", "secret")
	resp, err := newSynthesisClient(0).Do(req)
	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusTemporaryRedirect {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	if redirected {
		t.Fatal("client followed a redirect")
	}
}

func TestSynthesizeSpeechStreamHasOverallTimeout(t *testing.T) {
	t.Setenv("TTS_API_KEY", "test-api-key")
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
		<-r.Context().Done()
	}))
	defer upstream.Close()

	originalClient := streamClient
	streamClient = newStreamClient(75 * time.Millisecond)
	t.Cleanup(func() { streamClient = originalClient })

	s := NewService("test")
	if err := s.LockBaseURL(upstream.URL); err != nil {
		t.Fatalf("LockBaseURL: %v", err)
	}
	started := time.Now()
	err := s.SynthesizeSpeechStream(context.Background(), SynthesisRequest{
		Text: "hello", Model: ModelPreset, Voice: "mimo_default",
	}, func([]byte) error { return nil })
	if err == nil {
		t.Fatal("stream without data or DONE unexpectedly succeeded")
	}
	if elapsed := time.Since(started); elapsed > time.Second {
		t.Fatalf("stream timeout took %s", elapsed)
	}
}

func TestConsumeUpstreamStreamStrictContract(t *testing.T) {
	validChunk := `{"choices":[{"delta":{"audio":{"data":"AQI="}}}]}`
	callbackErr := errors.New("callback failed")
	tests := []struct {
		name      string
		stream    string
		callback  StreamChunkCallback
		wantError string
	}{
		{name: "valid", stream: "data: " + validChunk + "\n\ndata: [DONE]\n\n", callback: func([]byte) error { return nil }},
		{name: "bad JSON", stream: "data: {\n\ndata: [DONE]\n", callback: func([]byte) error { return nil }, wantError: "JSON"},
		{name: "bad base64", stream: "data: {\"choices\":[{\"delta\":{\"audio\":{\"data\":\"%%%\"}}}]}\n\ndata: [DONE]\n", callback: func([]byte) error { return nil }, wantError: "base64"},
		{name: "base64 whitespace", stream: "data: {\"choices\":[{\"delta\":{\"audio\":{\"data\":\"AQI=\\n\"}}}]}\n\ndata: [DONE]\n", callback: func([]byte) error { return nil }, wantError: "base64"},
		{name: "missing done", stream: "data: " + validChunk + "\n", callback: func([]byte) error { return nil }, wantError: "without [DONE]"},
		{name: "empty audio", stream: "data: {\"choices\":[]}\n\ndata: [DONE]\n", callback: func([]byte) error { return nil }, wantError: "without audio"},
		{name: "invalid line", stream: "garbage\n", callback: func([]byte) error { return nil }, wantError: "invalid upstream stream line"},
		{name: "callback error", stream: "data: " + validChunk + "\n", callback: func([]byte) error { return callbackErr }, wantError: callbackErr.Error()},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := consumeUpstreamStream(strings.NewReader(test.stream), test.callback)
			if test.wantError == "" {
				if err != nil {
					t.Fatalf("consumeUpstreamStream: %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), test.wantError) {
				t.Fatalf("error = %v, want substring %q", err, test.wantError)
			}
		})
	}
}
