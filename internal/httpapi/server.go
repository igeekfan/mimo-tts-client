package httpapi

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"

	"mimo-tts-client/internal/core"
)

type Server struct {
	service    *core.Service
	mux        *http.ServeMux
	hub        *EventHub
	corsOrigin string
}

func NewServer(service *core.Service, corsOrigin string) *Server {
	s := &Server{
		service:    service,
		mux:        http.NewServeMux(),
		hub:        NewEventHub(),
		corsOrigin: corsOrigin,
	}
	s.registerRoutes()
	return s
}

func (s *Server) registerRoutes() {
	s.mux.HandleFunc("/api/settings", s.handleSettings)
	s.mux.HandleFunc("/api/synthesize", s.handleSynthesize)
	s.mux.HandleFunc("/api/synthesize-stream", s.handleSynthesizeStream)
	s.mux.HandleFunc("/api/about", s.handleAbout)
	s.mux.HandleFunc("/api/history", s.handleHistory)
	s.mux.HandleFunc("/api/history/search", s.handleHistorySearch)
	s.mux.HandleFunc("/api/history/audio", s.handleHistoryAudio)
	s.mux.HandleFunc("/api/history/delete", s.handleHistoryDelete)
	s.mux.HandleFunc("/api/history/clear", s.handleHistoryClear)
	s.mux.Handle("/api/events", s.hub)
}

func (s *Server) Hub() *EventHub {
	return s.hub
}

func (s *Server) Handler() http.Handler {
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", s.corsOrigin)
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	s.mux.ServeHTTP(w, r)
}

func (s *Server) handleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		settings := s.service.GetSettings()
		json.NewEncoder(w).Encode(settings)
	case "POST":
		var settings core.Settings
		if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := s.service.SaveSettings(settings); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleSynthesize(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Text                string `json:"text"`
		Model               string `json:"model"`
		Voice               string `json:"voice"`
		Style               string `json:"style"`
		OptimizeTextPreview bool   `json:"optimizeTextPreview"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	audioData, format, err := s.service.SynthesizeSpeech(req.Text, req.Model, req.Voice, req.Style, req.OptimizeTextPreview)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"audioData": base64.StdEncoding.EncodeToString(audioData),
		"format":    format,
		"error":     "",
	})
}

func (s *Server) handleAbout(w http.ResponseWriter, r *http.Request) {
	about := map[string]string{
		"appVersion": s.service.GetCurrentVersion(),
	}
	json.NewEncoder(w).Encode(about)
}

func (s *Server) handleSynthesizeStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Text                string `json:"text"`
		Model               string `json:"model"`
		Voice               string `json:"voice"`
		Style               string `json:"style"`
		OptimizeTextPreview bool   `json:"optimizeTextPreview"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	err := s.service.SynthesizeSpeechStream(req.Text, req.Model, req.Voice, req.Style, req.OptimizeTextPreview, func(chunk []byte) error {
		data := base64.StdEncoding.EncodeToString(chunk)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
		return nil
	})

	if err != nil {
		fmt.Fprintf(w, "event: error\ndata: %s\n\n", err.Error())
		flusher.Flush()
	}

	fmt.Fprintf(w, "data: [DONE]\n\n")
	flusher.Flush()
}

func (s *Server) handleHistory(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		items, err := s.service.GetHistory(50)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(items)
	case "POST":
		var req struct {
			Text      string `json:"text"`
			Model     string `json:"model"`
			Voice     string `json:"voice"`
			Style     string `json:"style"`
			AudioData string `json:"audioData"`
			Format    string `json:"format"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		audioBytes, _ := base64.StdEncoding.DecodeString(req.AudioData)
		if err := s.service.SaveHistory(req.Text, req.Model, req.Voice, req.Style, req.Format, audioBytes); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleHistorySearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := r.URL.Query().Get("q")
	offsetStr := r.URL.Query().Get("offset")
	limitStr := r.URL.Query().Get("limit")

	offset := 0
	limit := 20
	fmt.Sscanf(offsetStr, "%d", &offset)
	fmt.Sscanf(limitStr, "%d", &limit)
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	items, total, err := s.service.SearchHistory(query, offset, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"items":  items,
		"total":  total,
		"offset": offset,
		"limit":  limit,
	})
}

func (s *Server) handleHistoryAudio(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, "Missing id", http.StatusBadRequest)
		return
	}
	var id uint
	fmt.Sscanf(idStr, "%d", &id)
	audioData, format, err := s.service.GetHistoryAudio(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", fmt.Sprintf("audio/%s", format))
	w.Write(audioData)
}

func (s *Server) handleHistoryDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		ID uint `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.service.DeleteHistory(req.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleHistoryClear(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := s.service.ClearHistory(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}
