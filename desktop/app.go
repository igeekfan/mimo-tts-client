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

	streamsMu sync.Mutex
	streams   map[string]context.CancelFunc
}

func NewApp(appVersion string) *App {
	return &App{
		service: core.NewService(appVersion),
		streams: make(map[string]context.CancelFunc),
	}
}

// registerStream stores the cancel func for an in-flight stream so it can be
// cancelled later via CancelStream.
func (a *App) registerStream(id string, cancel context.CancelFunc) {
	a.streamsMu.Lock()
	a.streams[id] = cancel
	a.streamsMu.Unlock()
}

// unregisterStream removes and cancels a stream's context, releasing resources.
func (a *App) unregisterStream(id string) {
	a.streamsMu.Lock()
	if cancel, ok := a.streams[id]; ok {
		delete(a.streams, id)
		cancel()
	}
	a.streamsMu.Unlock()
}

// CancelStream aborts an in-flight streaming synthesis by its stream id.
func (a *App) CancelStream(streamID string) {
	a.streamsMu.Lock()
	cancel, ok := a.streams[streamID]
	a.streamsMu.Unlock()
	if ok {
		cancel()
	}
}

func OnStartup(app *App) func(context.Context) {
	return app.startup
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.service.SetHooks(core.Hooks{
		AppLog: func(msg string) {
			fmt.Println(msg)
			wailsRuntime.EventsEmit(a.ctx, "app:log", msg)
		},
	})
	_ = a.service.Startup()
}

func (a *App) emitLog(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	fmt.Println(msg)
	if a.ctx != nil {
		wailsRuntime.EventsEmit(a.ctx, "app:log", msg)
	}
}
