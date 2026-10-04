package desktop

import (
	"context"
	"fmt"
	"sync"

	"mimo-tts-client/internal/core"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx     context.Context
	service *core.Service

	requestsMu sync.Mutex
	requests   map[string]context.CancelFunc
}

func NewApp(appVersion string) *App {
	return &App{
		service:  core.NewService(appVersion),
		requests: make(map[string]context.CancelFunc),
	}
}

// registerRequest stores the cancel func for any in-flight synthesis. IDs are
// unique across ordinary and streaming requests so cancellation cannot target
// the wrong operation.
func (a *App) registerRequest(id string, cancel context.CancelFunc) error {
	if !validRequestID(id) {
		return fmt.Errorf("synthesis request id must contain 1-128 letters, digits, dots, underscores, or hyphens")
	}
	a.requestsMu.Lock()
	defer a.requestsMu.Unlock()
	if _, exists := a.requests[id]; exists {
		return fmt.Errorf("synthesis request %q is already running", id)
	}
	a.requests[id] = cancel
	return nil
}

func validRequestID(id string) bool {
	if len(id) == 0 || len(id) > 128 {
		return false
	}
	for i := 0; i < len(id); i++ {
		char := id[i]
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') || char == '-' || char == '_' || char == '.' {
			continue
		}
		return false
	}
	return true
}

func (a *App) unregisterRequest(id string) {
	a.requestsMu.Lock()
	if cancel, ok := a.requests[id]; ok {
		delete(a.requests, id)
		cancel()
	}
	a.requestsMu.Unlock()
}

// CancelSynthesis aborts an ordinary or streaming synthesis by request ID.
func (a *App) CancelSynthesis(requestID string) {
	a.requestsMu.Lock()
	cancel, ok := a.requests[requestID]
	a.requestsMu.Unlock()
	if ok {
		cancel()
	}
}

// CancelStream remains as a compatibility alias for older desktop clients.
func (a *App) CancelStream(streamID string) { a.CancelSynthesis(streamID) }

func OnStartup(app *App) func(context.Context) {
	return app.startup
}

func OnShutdown(app *App) func(context.Context) {
	return app.shutdown
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.service.SetHooks(core.Hooks{
		AppLog: func(msg string) {
			fmt.Println(msg)
			wailsRuntime.EventsEmit(a.ctx, "app:log", msg)
		},
	})
	if err := a.service.Startup(); err != nil {
		a.emitLog("service startup failed: %v", err)
	}
}

func (a *App) shutdown(_ context.Context) {
	a.requestsMu.Lock()
	cancels := make([]context.CancelFunc, 0, len(a.requests))
	for id, cancel := range a.requests {
		delete(a.requests, id)
		cancels = append(cancels, cancel)
	}
	a.requestsMu.Unlock()
	for _, cancel := range cancels {
		cancel()
	}
	if err := a.service.Shutdown(); err != nil {
		a.emitLog("service shutdown failed: %v", err)
	}
}

func (a *App) emitLog(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	fmt.Println(msg)
	if a.ctx != nil {
		wailsRuntime.EventsEmit(a.ctx, "app:log", msg)
	}
}
