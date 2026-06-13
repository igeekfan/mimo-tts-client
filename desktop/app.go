package desktop

import (
	"context"
	"fmt"

	"mimo-tts-client/internal/core"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx     context.Context
	service *core.Service
}

func NewApp(appVersion string) *App {
	return &App{service: core.NewService(appVersion)}
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
