package httpapi

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"

	"mimo-tts-client/internal/core"
)

const (
	maxSettingsBodyBytes  = 600 << 10
	maxSynthesisBodyBytes = 15 << 20
	maxHistoryBodyBytes   = 68 << 20
	defaultSynthesisLimit = 2
)

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type errorEnvelope struct {
	Error apiError `json:"error"`
}

type Server struct {
	service    *core.Service
	mux        *http.ServeMux
	hub        *EventHub
	corsOrigin string
	authToken  string
	synthSlots chan struct{}
}

func NewServer(service *core.Service, corsOrigin, authToken string) *Server {
	// NewServer is web-specific. Locking here as well as in main_web prevents a
	// future caller from accidentally exposing a settings-controlled Base URL.
	if service.FixedBaseURL() == "" {
		if err := service.LockBaseURL(core.DefaultBaseURL); err != nil {
			panic(err)
		}
	}
	s := &Server{
		service:    service,
		mux:        http.NewServeMux(),
		hub:        NewEventHub(),
		corsOrigin: strings.TrimSpace(corsOrigin),
		authToken:  authToken,
		synthSlots: make(chan struct{}, defaultSynthesisLimit),
	}
	s.registerRoutes()
	return s
}

func (s *Server) registerRoutes() {
	s.mux.HandleFunc("/healthz", s.handleHealth)
	s.mux.HandleFunc("/api/config", s.handleConfig)
	s.mux.HandleFunc("/api/settings", s.handleSettings)
	s.mux.HandleFunc("/api/synthesize", s.handleSynthesize)
	s.mux.HandleFunc("/api/synthesize-stream", s.handleSynthesizeStream)
	s.mux.HandleFunc("/api/about", s.handleAbout)
	s.mux.HandleFunc("/api/version", s.handleVersion)
	s.mux.HandleFunc("/api/update", s.handleUpdate)
	s.mux.HandleFunc("/api/history", s.handleHistory)
	s.mux.HandleFunc("/api/history/search", s.handleHistorySearch)
	s.mux.HandleFunc("/api/history/audio", s.handleHistoryAudio)
	s.mux.HandleFunc("/api/history/delete", s.handleHistoryDelete)
	s.mux.HandleFunc("/api/history/clear", s.handleHistoryClear)
	s.mux.Handle("/api/events", s.hub)
	s.mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		writeAPIError(w, http.StatusNotFound, "not_found", "endpoint not found")
	})
}

func (s *Server) Hub() *EventHub { return s.hub }

func (s *Server) Handler() http.Handler { return s }

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// A tokenless server is intended exclusively for loopback use. Checking the
	// request authority as well as the listening address closes DNS-rebinding
	// and cross-origin write paths into the local API.
	if s.authToken == "" && !s.tokenlessLocalRequestAllowed(r) {
		writeAPIError(w, http.StatusForbidden, "forbidden_origin", "request must come from the local application origin")
		return
	}
	if strings.HasPrefix(r.URL.Path, "/api") && path.Clean(r.URL.Path) != r.URL.Path {
		writeAPIError(w, http.StatusBadRequest, "invalid_path", "API path must be canonical")
		return
	}
	s.applyCORS(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if !s.authorized(r) {
		writeAPIError(w, http.StatusUnauthorized, "unauthorized", "a valid bearer token is required")
		return
	}
	s.mux.ServeHTTP(w, r)
}

func (s *Server) tokenlessLocalRequestAllowed(r *http.Request) bool {
	if !isLoopbackAuthority(r.Host) {
		return false
	}
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return true
	}

	u, err := url.Parse(origin)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" {
		return false
	}
	if equalAuthority(u.Host, r.Host) {
		return true
	}
	// An explicit, exact CORS origin is an operator opt-in. Wildcard CORS is
	// deliberately insufficient when no authentication token is configured.
	return s.corsOrigin != "" && s.corsOrigin != "*" && origin == s.corsOrigin
}

func isLoopbackAuthority(authority string) bool {
	host, _, ok := splitAuthority(authority)
	if !ok {
		return false
	}
	host = strings.TrimSuffix(strings.ToLower(host), ".")
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func equalAuthority(a, b string) bool {
	aHost, aPort, aOK := splitAuthority(a)
	bHost, bPort, bOK := splitAuthority(b)
	return aOK && bOK && strings.EqualFold(strings.TrimSuffix(aHost, "."), strings.TrimSuffix(bHost, ".")) && aPort == bPort
}

func splitAuthority(authority string) (host, port string, ok bool) {
	if authority == "" || strings.ContainsAny(authority, "@/\\") {
		return "", "", false
	}
	if parsedHost, parsedPort, err := net.SplitHostPort(authority); err == nil {
		if parsedHost == "" {
			return "", "", false
		}
		return strings.Trim(parsedHost, "[]"), parsedPort, true
	}
	trimmed := strings.Trim(authority, "[]")
	if strings.Contains(trimmed, ":") && net.ParseIP(trimmed) == nil {
		return "", "", false
	}
	return trimmed, "", trimmed != ""
}

func (s *Server) applyCORS(w http.ResponseWriter, r *http.Request) {
	if s.corsOrigin == "" {
		return
	}
	origin := r.Header.Get("Origin")
	if s.corsOrigin != "*" && origin != s.corsOrigin {
		return
	}
	w.Header().Add("Vary", "Origin")
	w.Header().Set("Access-Control-Allow-Origin", s.corsOrigin)
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

// /healthz and /api/config are intentionally public. Query-string tokens are
// accepted only for EventSource, which cannot attach an Authorization header.
func (s *Server) authorized(r *http.Request) bool {
	if s.authToken == "" || r.URL.Path == "/healthz" || r.URL.Path == "/api/config" {
		return true
	}
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	scheme, token, ok := strings.Cut(auth, " ")
	if ok && strings.EqualFold(scheme, "Bearer") && tokenEqual(strings.TrimSpace(token), s.authToken) {
		return true
	}
	return r.URL.Path == "/api/events" && tokenEqual(r.URL.Query().Get("token"), s.authToken)
}

func tokenEqual(a, b string) bool {
	return len(a) == len(b) && subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"authRequired": s.authToken != ""})
}

func (s *Server) handleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		settings := s.service.GetSettings()
		settings.HasApiKey = settings.ApiKey != ""
		settings.ApiKey = ""
		settings.BaseUrl = s.service.FixedBaseURL()
		writeJSON(w, http.StatusOK, settings)
	case http.MethodPost:
		var settings core.Settings
		if !decodeJSON(w, r, &settings, maxSettingsBodyBytes) {
			return
		}
		if err := validateSettings(settings); err != nil {
			writeAPIError(w, http.StatusBadRequest, "invalid_settings", err.Error())
			return
		}
		current := s.service.GetSettings()
		if settings.ApiKey == "" {
			settings.ApiKey = current.ApiKey
		}
		// Ignore any client-supplied value. The endpoint is fixed by the server
		// operator and is never writable through the web API.
		settings.BaseUrl = s.service.FixedBaseURL()
		if err := s.service.SaveSettings(settings); err != nil {
			writeAPIError(w, http.StatusInternalServerError, "settings_save_failed", err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		methodNotAllowed(w, http.MethodGet, http.MethodPost)
	}
}

func validateSettings(settings core.Settings) error {
	if len(settings.Language) > 32 || len(settings.Theme) > 32 || len(settings.Model) > 128 {
		return fmt.Errorf("a settings field is too large")
	}
	if len(settings.ApiKey) > 4096 || len(settings.BaseUrl) > 4096 || len(settings.Voice) > core.MaxVoiceDesignBytes || len(settings.Style) > core.MaxSynthesisStyleBytes {
		return fmt.Errorf("a settings field is too large")
	}
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(settings.Voice)), "data:") {
		return fmt.Errorf("voice must not contain audio data")
	}
	if len(settings.StyleHistory) > 100 {
		return fmt.Errorf("style history is too large")
	}
	for _, item := range settings.StyleHistory {
		if len(item) > core.MaxSynthesisStyleBytes {
			return fmt.Errorf("style history item is too large")
		}
	}
	return nil
}

func (s *Server) handleSynthesize(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, http.MethodPost)
		return
	}
	var req core.SynthesisRequest
	if !decodeJSON(w, r, &req, maxSynthesisBodyBytes) {
		return
	}
	if err := core.ValidateSynthesisRequest(req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_synthesis_request", err.Error())
		return
	}
	if !s.acquireSynthesis() {
		writeAPIError(w, http.StatusTooManyRequests, "synthesis_busy", "too many synthesis requests are running")
		return
	}
	defer s.releaseSynthesis()

	audioData, format, err := s.service.SynthesizeSpeech(r.Context(), req)
	if err != nil {
		if r.Context().Err() != nil {
			return
		}
		status, code := synthesisErrorStatus(err)
		writeAPIError(w, status, code, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"audioData": base64.StdEncoding.EncodeToString(audioData),
		"format":    format,
	})
}

func (s *Server) handleSynthesizeStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, http.MethodPost)
		return
	}
	var req core.SynthesisRequest
	if !decodeJSON(w, r, &req, maxSynthesisBodyBytes) {
		return
	}
	if err := core.ValidateSynthesisRequest(req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_synthesis_request", err.Error())
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeAPIError(w, http.StatusInternalServerError, "streaming_unsupported", "streaming is not supported")
		return
	}
	if !s.acquireSynthesis() {
		writeAPIError(w, http.StatusTooManyRequests, "synthesis_busy", "too many synthesis requests are running")
		return
	}
	defer s.releaseSynthesis()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	started := false
	err := s.service.SynthesizeSpeechStream(r.Context(), req, func(chunk []byte) error {
		if err := r.Context().Err(); err != nil {
			return err
		}
		started = true
		_, err := fmt.Fprintf(w, "data: %s\n\n", base64.StdEncoding.EncodeToString(chunk))
		if err == nil {
			flusher.Flush()
		}
		return err
	})
	if r.Context().Err() != nil {
		return
	}
	if err != nil {
		status, code := synthesisErrorStatus(err)
		if !started {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Del("Cache-Control")
			w.Header().Del("Connection")
			w.Header().Del("X-Accel-Buffering")
			writeAPIError(w, status, code, err.Error())
			return
		}
		payload, _ := json.Marshal(errorEnvelope{Error: apiError{Code: code, Message: err.Error()}})
		_, _ = fmt.Fprintf(w, "event: error\ndata: %s\n\n", payload)
		flusher.Flush()
		return
	}
	_, _ = fmt.Fprint(w, "data: [DONE]\n\n")
	flusher.Flush()
}

func synthesisErrorStatus(err error) (int, string) {
	var validationErr *core.RequestValidationError
	if errors.As(err, &validationErr) {
		return http.StatusBadRequest, "invalid_synthesis_request"
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return http.StatusGatewayTimeout, "upstream_timeout"
	}
	return http.StatusBadGateway, "synthesis_failed"
}

func (s *Server) acquireSynthesis() bool {
	select {
	case s.synthSlots <- struct{}{}:
		return true
	default:
		return false
	}
}

func (s *Server) releaseSynthesis() { <-s.synthSlots }

func (s *Server) handleAbout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	writeJSON(w, http.StatusOK, s.service.GetAboutInfo())
}

func (s *Server) handleVersion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"version": s.service.GetCurrentVersion()})
}

func (s *Server) handleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	info, err := s.service.CheckForUpdate()
	if err != nil {
		writeAPIError(w, http.StatusBadGateway, "update_check_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, info)
}

func (s *Server) handleHistory(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := s.service.GetHistory(50)
		if err != nil {
			writeAPIError(w, http.StatusInternalServerError, "history_load_failed", err.Error())
			return
		}
		writeJSON(w, http.StatusOK, items)
	case http.MethodPost:
		var req struct {
			Text      string `json:"text"`
			Model     string `json:"model"`
			Voice     string `json:"voice"`
			Style     string `json:"style"`
			AudioData string `json:"audioData"`
			Format    string `json:"format"`
		}
		if !decodeJSON(w, r, &req, maxHistoryBodyBytes) {
			return
		}
		if err := validateHistoryRequest(req.Text, req.Model, req.Voice, req.Style, req.Format); err != nil {
			writeAPIError(w, http.StatusBadRequest, "invalid_history", err.Error())
			return
		}
		audioBytes, err := base64.StdEncoding.Strict().DecodeString(req.AudioData)
		if err != nil || len(audioBytes) == 0 {
			writeAPIError(w, http.StatusBadRequest, "invalid_history", "audioData must be valid non-empty base64")
			return
		}
		if len(audioBytes) > core.MaxHistoryAudioBytes {
			writeAPIError(w, http.StatusRequestEntityTooLarge, "audio_too_large", "history audio exceeds the 50 MiB limit")
			return
		}
		if err := s.service.SaveHistory(req.Text, req.Model, req.Voice, req.Style, req.Format, audioBytes); err != nil {
			if errors.Is(err, core.ErrHistoryAudioTooLarge) {
				writeAPIError(w, http.StatusRequestEntityTooLarge, "audio_too_large", err.Error())
				return
			}
			writeAPIError(w, http.StatusInternalServerError, "history_save_failed", err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		methodNotAllowed(w, http.MethodGet, http.MethodPost)
	}
}

func validateHistoryRequest(text, model, voice, style, format string) error {
	if strings.TrimSpace(text) == "" || len(text) > core.MaxSynthesisTextBytes {
		return fmt.Errorf("text is invalid")
	}
	maxVoiceBytes := core.MaxVoiceLabelBytes
	if model == core.ModelVoiceDesign {
		maxVoiceBytes = core.MaxVoiceDesignBytes
	}
	if len(model) > 128 || len(voice) > maxVoiceBytes || len(style) > core.MaxSynthesisStyleBytes {
		return fmt.Errorf("history metadata is too large")
	}
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(voice)), "data:") {
		return fmt.Errorf("voice must not contain audio data")
	}
	switch format {
	case "wav", "pcm16", "mp3":
		return nil
	default:
		return fmt.Errorf("format is not supported")
	}
}

func (s *Server) handleHistorySearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	query := r.URL.Query().Get("q")
	if len(query) > 256 {
		writeAPIError(w, http.StatusBadRequest, "invalid_query", "q is too large")
		return
	}
	offset, ok := parseBoundedInt(w, r.URL.Query().Get("offset"), 0, 0, 1_000_000, "offset")
	if !ok {
		return
	}
	limit, ok := parseBoundedInt(w, r.URL.Query().Get("limit"), 20, 1, 100, "limit")
	if !ok {
		return
	}
	items, total, err := s.service.SearchHistory(query, offset, limit)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "history_search_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total, "offset": offset, "limit": limit})
}

func parseBoundedInt(w http.ResponseWriter, raw string, fallback, minValue, maxValue int, field string) (int, bool) {
	if raw == "" {
		return fallback, true
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < minValue || value > maxValue {
		writeAPIError(w, http.StatusBadRequest, "invalid_query", field+" is invalid")
		return 0, false
	}
	return value, true
}

func (s *Server) handleHistoryAudio(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	id, err := parseHistoryID(r.URL.Query().Get("id"), strconv.IntSize)
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_id", "id must be a positive integer")
		return
	}
	audioData, format, err := s.service.GetHistoryAudio(id)
	if err != nil {
		writeAPIError(w, http.StatusNotFound, "history_not_found", err.Error())
		return
	}
	contentType := "application/octet-stream"
	switch format {
	case "wav":
		contentType = "audio/wav"
	case "mp3":
		contentType = "audio/mpeg"
	case "pcm16":
		contentType = "audio/L16"
	}
	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(audioData)
}

func parseHistoryID(raw string, bitSize int) (uint, error) {
	id, err := strconv.ParseUint(raw, 10, bitSize)
	if err != nil || id == 0 {
		return 0, fmt.Errorf("invalid history id")
	}
	return uint(id), nil
}

func (s *Server) handleHistoryDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, http.MethodPost)
		return
	}
	var req struct {
		ID uint `json:"id"`
	}
	if !decodeJSON(w, r, &req, 1<<10) {
		return
	}
	if req.ID == 0 {
		writeAPIError(w, http.StatusBadRequest, "invalid_id", "id must be positive")
		return
	}
	if err := s.service.DeleteHistory(req.ID); err != nil {
		writeAPIError(w, http.StatusInternalServerError, "history_delete_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleHistoryClear(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, http.MethodPost)
		return
	}
	var request *struct{}
	if !decodeJSON(w, r, &request, 1<<10) {
		return
	}
	if request == nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_json", "request body must contain an empty JSON object")
		return
	}
	if err := s.service.ClearHistory(); err != nil {
		writeAPIError(w, http.StatusInternalServerError, "history_clear_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, destination any, maxBytes int64) bool {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		writeAPIError(w, http.StatusUnsupportedMediaType, "unsupported_media_type", "Content-Type must be application/json")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			writeAPIError(w, http.StatusRequestEntityTooLarge, "request_too_large", "request body is too large")
		} else {
			writeAPIError(w, http.StatusBadRequest, "invalid_json", "request body must contain valid JSON matching the endpoint schema")
		}
		return false
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			writeAPIError(w, http.StatusRequestEntityTooLarge, "request_too_large", "request body is too large")
		} else {
			writeAPIError(w, http.StatusBadRequest, "invalid_json", "request body must contain one JSON object")
		}
		return false
	}
	return true
}

func methodNotAllowed(w http.ResponseWriter, methods ...string) {
	w.Header().Set("Allow", strings.Join(methods, ", "))
	writeAPIError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
}

func writeAPIError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorEnvelope{Error: apiError{Code: code, Message: message}})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
