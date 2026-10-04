//go:build web

package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"mimo-tts-client/internal/core"
	"mimo-tts-client/internal/httpapi"
	"mimo-tts-client/internal/platform"
)

const defaultWebAddr = "127.0.0.1:8080"

func main() {
	platform.EnableUTF8Console()
	if err := runWeb(); err != nil {
		log.Printf("TTS web mode stopped: %v", err)
		os.Exit(1)
	}
}

func runWeb() error {
	addr := strings.TrimSpace(os.Getenv("TTS_WEB_ADDR"))
	if addr == "" {
		addr = defaultWebAddr
	}
	authToken := os.Getenv("TTS_WEB_TOKEN")
	if err := validateWebSecurity(addr, authToken); err != nil {
		return err
	}

	service := core.NewService(currentAppVersion())
	baseURL := strings.TrimSpace(os.Getenv("TTS_BASE_URL"))
	if baseURL == "" {
		baseURL = core.DefaultBaseURL
	}
	if err := service.LockBaseURL(baseURL); err != nil {
		return fmt.Errorf("configure upstream base URL: %w", err)
	}
	if err := service.Startup(); err != nil {
		return fmt.Errorf("service startup: %w", err)
	}
	defer func() {
		if err := service.Shutdown(); err != nil {
			log.Printf("service shutdown failed: %v", err)
		}
	}()

	apiServer := httpapi.NewServer(service, os.Getenv("TTS_CORS_ORIGIN"), authToken)
	service.SetHooks(core.Hooks{AppLog: func(msg string) {
		log.Println(msg)
		apiServer.Hub().Emit("app:log", msg)
	}})

	serverContext, stopSignals := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stopSignals()
	server := &http.Server{
		Addr:              addr,
		Handler:           webHandler(apiServer.Handler()),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
		BaseContext: func(net.Listener) context.Context {
			return serverContext
		},
	}

	listenErr := make(chan error, 1)
	go func() {
		log.Printf("TTS web mode listening on %s", addr)
		listenErr <- server.ListenAndServe()
	}()

	select {
	case err := <-listenErr:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-serverContext.Done():
		shutdownContext, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownContext); err != nil {
			_ = server.Close()
			return fmt.Errorf("HTTP server shutdown: %w", err)
		}
		err := <-listenErr
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	}
}

func validateWebSecurity(addr, token string) error {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return fmt.Errorf("invalid TTS_WEB_ADDR %q: %w", addr, err)
	}
	if token != "" && token != strings.TrimSpace(token) {
		return fmt.Errorf("TTS_WEB_TOKEN must not contain leading or trailing whitespace")
	}
	if isLoopbackListenHost(host) {
		return nil
	}
	if len(token) < 16 {
		return fmt.Errorf("TTS_WEB_TOKEN must contain at least 16 characters for a non-loopback listen address")
	}
	return nil
}

func isLoopbackListenHost(host string) bool {
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func webHandler(apiHandler http.Handler) http.Handler {
	const distDir = "frontend/dist"
	indexPath := filepath.Join(distDir, "index.html")
	fileServer := http.FileServer(http.Dir(distDir))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api" || strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/healthz" {
			apiHandler.ServeHTTP(w, r)
			return
		}

		if _, err := os.Stat(indexPath); err != nil {
			http.Error(w, "frontend/dist not found, run npm run build in frontend first", http.StatusServiceUnavailable)
			return
		}

		requestPath := strings.TrimPrefix(pathClean(r.URL.Path), "/")
		if requestPath == "" {
			http.ServeFile(w, r, indexPath)
			return
		}

		assetPath := filepath.Join(distDir, filepath.FromSlash(requestPath))
		if info, err := os.Stat(assetPath); err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}

		http.ServeFile(w, r, indexPath)
	})
}

func pathClean(path string) string {
	cleaned := filepath.ToSlash(filepath.Clean(path))
	if cleaned == "." {
		return "/"
	}
	if !strings.HasPrefix(cleaned, "/") {
		return "/" + cleaned
	}
	return cleaned
}
