package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"mimo-tts-client/internal/core"
)

func TestHealthEndpointIsPublicAndMinimal(t *testing.T) {
	s := NewServer(core.NewService("test"), "", "0123456789abcdef")
	recorder := httptest.NewRecorder()
	s.ServeHTTP(recorder, newLocalRequest(http.MethodGet, "/healthz", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if strings.Contains(strings.ToLower(recorder.Body.String()), "baseurl") || strings.Contains(strings.ToLower(recorder.Body.String()), "token") {
		t.Fatalf("health response exposed configuration: %s", recorder.Body.String())
	}
}

func TestAPIErrorContractAndStrictContentType(t *testing.T) {
	s := NewServer(core.NewService("test"), "", "")
	tests := []struct {
		name        string
		method      string
		target      string
		body        string
		contentType string
		wantStatus  int
		wantCode    string
	}{
		{name: "wrong method", method: http.MethodGet, target: "/api/synthesize", wantStatus: http.StatusMethodNotAllowed, wantCode: "method_not_allowed"},
		{name: "missing content type", method: http.MethodPost, target: "/api/synthesize", body: `{}`, wantStatus: http.StatusUnsupportedMediaType, wantCode: "unsupported_media_type"},
		{name: "unknown JSON field", method: http.MethodPost, target: "/api/synthesize", body: `{"text":"hello","unknown":true}`, contentType: "application/json", wantStatus: http.StatusBadRequest, wantCode: "invalid_json"},
		{name: "invalid synthesis", method: http.MethodPost, target: "/api/synthesize", body: `{"text":""}`, contentType: "application/json; charset=utf-8", wantStatus: http.StatusBadRequest, wantCode: "invalid_synthesis_request"},
		{name: "not found", method: http.MethodGet, target: "/api/missing", wantStatus: http.StatusNotFound, wantCode: "not_found"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req := newLocalRequest(test.method, test.target, strings.NewReader(test.body))
			if test.contentType != "" {
				req.Header.Set("Content-Type", test.contentType)
			}
			recorder := httptest.NewRecorder()
			s.ServeHTTP(recorder, req)
			if recorder.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d; body=%s", recorder.Code, test.wantStatus, recorder.Body.String())
			}
			if got := recorder.Header().Get("Content-Type"); !strings.HasPrefix(got, "application/json") {
				t.Fatalf("Content-Type = %q", got)
			}
			var envelope errorEnvelope
			if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
				t.Fatalf("decode error envelope: %v", err)
			}
			if envelope.Error.Code != test.wantCode || envelope.Error.Message == "" {
				t.Fatalf("error = %+v", envelope.Error)
			}
		})
	}
}

func TestInvalidJSONDoesNotEchoAttackerControlledDecoderError(t *testing.T) {
	s := NewServer(core.NewService("test"), "", "")
	marker := strings.Repeat("ATTACKER", 200)
	req := newLocalRequest(http.MethodPost, "/api/synthesize", strings.NewReader(`{"`+marker+`":true}`))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	s.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body=%s", recorder.Code, recorder.Body.String())
	}
	if strings.Contains(recorder.Body.String(), marker) || recorder.Body.Len() > 512 {
		t.Fatalf("decoder response echoed attacker input: size=%d", recorder.Body.Len())
	}
}

func TestSynthesisBodyLimit(t *testing.T) {
	s := NewServer(core.NewService("test"), "", "")
	body := `{"text":"` + strings.Repeat("x", maxSynthesisBodyBytes) + `"}`
	req := newLocalRequest(http.MethodPost, "/api/synthesize", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	s.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, body=%s", recorder.Code, recorder.Body.String())
	}
	assertAPIErrorCode(t, recorder, "request_too_large")
}

func TestSynthesisConcurrencyLimit(t *testing.T) {
	s := NewServer(core.NewService("test"), "", "")
	s.synthSlots = make(chan struct{}, 1)
	s.synthSlots <- struct{}{}
	req := newLocalRequest(http.MethodPost, "/api/synthesize", strings.NewReader(`{"text":"hello","model":"mimo-v2.5-tts","voice":"mimo_default"}`))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	s.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, body=%s", recorder.Code, recorder.Body.String())
	}
	assertAPIErrorCode(t, recorder, "synthesis_busy")
}

func TestSynthesisUpstreamFailureUsesNon2xxJSON(t *testing.T) {
	t.Setenv("TTS_API_KEY", "test-key")
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte("upstream failed"))
	}))
	defer upstream.Close()

	service := core.NewService("test")
	if err := service.LockBaseURL(upstream.URL); err != nil {
		t.Fatalf("LockBaseURL: %v", err)
	}
	s := NewServer(service, "", "")
	req := newLocalRequest(http.MethodPost, "/api/synthesize", strings.NewReader(`{"text":"hello","model":"mimo-v2.5-tts","voice":"mimo_default"}`))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	s.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, body=%s", recorder.Code, recorder.Body.String())
	}
	assertAPIErrorCode(t, recorder, "synthesis_failed")
}

func TestStreamFailureBeforeFirstChunkUsesNon2xxJSON(t *testing.T) {
	t.Setenv("TTS_API_KEY", "test-key")
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {not-json}\n\n"))
	}))
	defer upstream.Close()

	service := core.NewService("test")
	if err := service.LockBaseURL(upstream.URL); err != nil {
		t.Fatalf("LockBaseURL: %v", err)
	}
	s := NewServer(service, "", "")
	req := newLocalRequest(http.MethodPost, "/api/synthesize-stream", strings.NewReader(`{"text":"hello","model":"mimo-v2.5-tts","voice":"mimo_default"}`))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	s.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, body=%s", recorder.Code, recorder.Body.String())
	}
	if got := recorder.Header().Get("Content-Type"); !strings.HasPrefix(got, "application/json") {
		t.Fatalf("Content-Type = %q", got)
	}
	assertAPIErrorCode(t, recorder, "synthesis_failed")
}

func TestStreamFailureAfterAudioEmitsErrorWithoutDone(t *testing.T) {
	t.Setenv("TTS_API_KEY", "test-key")
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"audio\":{\"data\":\"AQI=\"}}}]}\n\n"))
	}))
	defer upstream.Close()

	service := core.NewService("test")
	if err := service.LockBaseURL(upstream.URL); err != nil {
		t.Fatalf("LockBaseURL: %v", err)
	}
	s := NewServer(service, "", "")
	req := newLocalRequest(http.MethodPost, "/api/synthesize-stream", strings.NewReader(`{"text":"hello","model":"mimo-v2.5-tts","voice":"mimo_default"}`))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	s.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", recorder.Code, recorder.Body.String())
	}
	body := recorder.Body.String()
	if !strings.Contains(body, "event: error") || strings.Contains(body, "data: [DONE]") {
		t.Fatalf("unexpected stream response: %s", body)
	}
}

func TestNewServerLocksBaseURL(t *testing.T) {
	service := core.NewService("test")
	_ = NewServer(service, "", "")
	if got := service.FixedBaseURL(); got != core.DefaultBaseURL {
		t.Fatalf("FixedBaseURL = %q", got)
	}
}

func TestWebSettingsHideAPIKeyAndCannotChangeBaseURL(t *testing.T) {
	t.Setenv("TTS_API_KEY", "environment-secret")
	service := newStartedWebService(t, "https://fixed.example/v1")
	s := NewServer(service, "", "")

	getRecorder := httptest.NewRecorder()
	s.ServeHTTP(getRecorder, newLocalRequest(http.MethodGet, "/api/settings", nil))
	if getRecorder.Code != http.StatusOK {
		t.Fatalf("GET status = %d, body=%s", getRecorder.Code, getRecorder.Body.String())
	}
	var got core.Settings
	if err := json.Unmarshal(getRecorder.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode settings: %v", err)
	}
	if got.ApiKey != "" || !got.HasApiKey {
		t.Fatalf("API key exposure state = key %q, has=%v", got.ApiKey, got.HasApiKey)
	}
	if got.BaseUrl != "https://fixed.example/v1" {
		t.Fatalf("GET BaseUrl = %q", got.BaseUrl)
	}

	body := `{"language":"zh-CN","theme":"dark","baseUrl":"https://attacker.example/collect","model":"mimo-v2.5-tts","voice":"mimo_default"}`
	post := newLocalRequest(http.MethodPost, "/api/settings", strings.NewReader(body))
	post.Header.Set("Content-Type", "application/json")
	postRecorder := httptest.NewRecorder()
	s.ServeHTTP(postRecorder, post)
	if postRecorder.Code != http.StatusOK {
		t.Fatalf("POST status = %d, body=%s", postRecorder.Code, postRecorder.Body.String())
	}
	if persisted := service.GetSettings().BaseUrl; persisted != "https://fixed.example/v1" {
		t.Fatalf("persisted BaseUrl = %q", persisted)
	}
}

func TestTokenlessServerRejectsRebindingAndCrossOriginRequests(t *testing.T) {
	s := NewServer(core.NewService("test"), "", "")
	tests := []struct {
		name   string
		host   string
		origin string
	}{
		{name: "non-loopback host", host: "evil.example", origin: "http://evil.example"},
		{name: "cross-origin", host: "127.0.0.1:8080", origin: "http://evil.example"},
		{name: "null origin", host: "127.0.0.1:8080", origin: "null"},
		{name: "lookalike host", host: "127.0.0.1.evil.example"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
			req.Host = test.host
			if test.origin != "" {
				req.Header.Set("Origin", test.origin)
			}
			recorder := httptest.NewRecorder()
			s.ServeHTTP(recorder, req)
			if recorder.Code != http.StatusForbidden {
				t.Fatalf("status = %d, body=%s", recorder.Code, recorder.Body.String())
			}
			assertAPIErrorCode(t, recorder, "forbidden_origin")
		})
	}
}

func TestTokenlessServerAllowsSameLocalOrigin(t *testing.T) {
	s := NewServer(core.NewService("test"), "", "")
	req := newLocalRequest(http.MethodGet, "/api/config", nil)
	req.Header.Set("Origin", "http://127.0.0.1:8080")
	recorder := httptest.NewRecorder()
	s.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestHistoryClearRequiresEmptyJSONObjectEvenWhenChunked(t *testing.T) {
	s := NewServer(core.NewService("test"), "", "")
	req := newLocalRequest(http.MethodPost, "/api/history/clear", strings.NewReader("unexpected"))
	req.ContentLength = -1
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	s.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body=%s", recorder.Code, recorder.Body.String())
	}
	assertAPIErrorCode(t, recorder, "invalid_json")
}

func TestHistoryClearRejectsJSONNull(t *testing.T) {
	s := NewServer(core.NewService("test"), "", "")
	req := newLocalRequest(http.MethodPost, "/api/history/clear", strings.NewReader("null"))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	s.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body=%s", recorder.Code, recorder.Body.String())
	}
	assertAPIErrorCode(t, recorder, "invalid_json")
}

func TestNonCanonicalAPIPathUsesJSONError(t *testing.T) {
	s := NewServer(core.NewService("test"), "", "")
	recorder := httptest.NewRecorder()
	s.ServeHTTP(recorder, newLocalRequest(http.MethodGet, "/api//settings", nil))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body=%s", recorder.Code, recorder.Body.String())
	}
	assertAPIErrorCode(t, recorder, "invalid_path")
}

func TestParseHistoryIDHonorsPlatformWidth(t *testing.T) {
	if _, err := parseHistoryID("4294967295", 32); err != nil {
		t.Fatalf("max uint32 should parse: %v", err)
	}
	if _, err := parseHistoryID("4294967296", 32); err == nil {
		t.Fatal("uint32 overflow unexpectedly parsed")
	}
	if _, err := parseHistoryID("18446744073709551616", 64); err == nil {
		t.Fatal("uint64 overflow unexpectedly parsed")
	}
}

func assertAPIErrorCode(t *testing.T, recorder *httptest.ResponseRecorder, want string) {
	t.Helper()
	var envelope errorEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode error envelope: %v (body=%s)", err, recorder.Body.String())
	}
	if envelope.Error.Code != want {
		t.Fatalf("error code = %q, want %q", envelope.Error.Code, want)
	}
}

func newLocalRequest(method, target string, body io.Reader) *http.Request {
	req := httptest.NewRequest(method, target, body)
	req.Host = "127.0.0.1:8080"
	return req
}

func newStartedWebService(t *testing.T, baseURL string) *core.Service {
	t.Helper()
	configRoot := t.TempDir()
	t.Setenv("APPDATA", configRoot)
	t.Setenv("XDG_CONFIG_HOME", configRoot)
	t.Setenv("HOME", configRoot)
	service := core.NewService("test")
	if err := service.LockBaseURL(baseURL); err != nil {
		t.Fatalf("LockBaseURL: %v", err)
	}
	if err := service.Startup(); err != nil {
		t.Fatalf("Startup: %v", err)
	}
	t.Cleanup(func() { _ = service.Shutdown() })
	return service
}
