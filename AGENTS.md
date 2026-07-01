# AGENTS.md - Guide for AI Coding Agents

## Project Overview

MiMo TTS Client is a cross-platform desktop TTS application:
- **Desktop mode** (Wails v2): Go backend + React/TypeScript frontend bundled into a native binary
- **Web mode** (HTTP API): Go backend serving REST API + SSE events, same frontend served as SPA

Both modes share the same core business logic in `internal/core/`.

## Architecture

```
                    ┌─────────────┐
                    │  Frontend    │  (React + TypeScript, Vite)
                    │  App.tsx     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │ desktop    │    web      │
              │ Wails bind │  fetch/SSE  │
              └──────┬─────┘─────┬──────┘
                     │           │
              ┌──────┴───┐ ┌────┴────────┐
              │ desktop/ │ │ httpapi/     │
              │ App.go   │ │ server.go    │
              └──────┬───┘ └─────┬───────┘
                     │           │
                    ┌┴───────────┴┐
                    │ internal/   │
                    │ core/Service│  ← shared business logic
                    └─────────────┘
```

## Directory Structure

```
.
├── main.go              # Desktop mode entry point (Wails app)
├── main_web.go          # Web mode entry point (HTTP server, build tag: web)
├── version.go           # App version
├── go.mod / go.sum      # Go module
├── wails.json           # Wails project config
├── Dockerfile           # Docker build for web mode
├── desktop/
│   ├── app.go           # Wails App struct, lifecycle hooks
│   ├── app_bindings.go  # Go method wrappers (desktop types ↔ core types)
│   ├── app_ui.go        # Desktop-only UI: SelectFolder, OpenFile, etc.
│   └── types.go         # Desktop-specific type definitions
├── internal/
│   ├── core/            # All business logic (shared by desktop & web)
│   │   ├── service.go   # Service struct, startup, hooks, env vars
│   │   ├── tts.go       # MiMo TTS API integration
│   │   ├── settings.go  # Settings CRUD (SQLite via GORM)
│   │   ├── i18n.go      # Backend i18n
│   │   ├── db.go        # Database setup
│   │   └── types.go     # Shared type definitions
│   ├── httpapi/
│   │   ├── server.go    # REST API handlers + file serving
│   │   └── events.go    # SSE EventHub
│   └── platform/
│       └── hidecmd.go   # Windows CMD window hiding
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Root component, composes pages
│   │   ├── main.tsx          # Entry point (bootstraps web auth, then renders)
│   │   ├── types.ts          # TypeScript type definitions
│   │   ├── components/       # UI: SynthesisPage, HistoryPage, SettingsDialog,
│   │   │   │                 #     AudioPlayer, LogPage, ErrorBoundary, ...
│   │   │   └── ui/           # shadcn/ui primitives (button, dialog, select, ...)
│   │   ├── hooks/            # useSynthesis, useSettings, useHistory, useRouter, ...
│   │   ├── lib/
│   │   │   ├── backend.ts    # Dual-mode API layer (Wails bind / HTTP fetch)
│   │   │   ├── runtime.ts    # Dual-mode event system (Wails events / SSE)
│   │   │   ├── webAuth.ts    # Web-mode token auth (TTS_WEB_TOKEN)
│   │   │   └── ...           # audioUtils, formatUtils, constants, contexts
│   │   ├── styles/ theme.css # Styles are split across styles/, theme.css, App.css
│   │   └── i18n/
│   │       ├── context.tsx   # useI18n hook
│   │       ├── zh-CN.ts      # Chinese translations
│   │       └── en-US.ts      # English translations
│   ├── wailsjs/          # Auto-generated Wails bindings (do not edit)
│   ├── package.json
│   └── vite.config.ts
└── build/                # Platform-specific build assets
```

## Build / Dev / Test Commands

### Full Application (Desktop)
| Command | Description |
|---------|-------------|
| `wails dev` | Run dev server with hot reload (Go + frontend) |
| `wails build` | Build production binary to `build/bin/` |

### Web Mode
| Command | Description |
|---------|-------------|
| `go build -tags web -o tts-server .` | Build web server binary |
| `docker build -t tts .` | Build Docker image |

### Go Backend
| Command | Description |
|---------|-------------|
| `go build ./...` | Compile all Go packages |
| `go vet ./...` | Run Go static analysis |
| `go test ./...` | Run all Go tests |

### Frontend
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server only |
| `npm run build` | Type-check (`tsc`) then build with Vite |
| `npm run lint` | Type-check only (`tsc --noEmit`) |

### Lint (Go)
| Command | Description |
|---------|-------------|
| `gofmt -l .` | List files needing formatting |
| `golangci-lint run` | Run Go linters (see `.golangci.yml`) |

## Environment Variables

| Variable | Mode | Description |
|----------|------|-------------|
| `TTS_API_KEY` | both | MiMo API key (fallback when not set in Settings) |
| `TTS_WEB_ADDR` | web | Listen address (default `:8080`) |
| `TTS_WEB_TOKEN` | web | If set, all `/api/*` require this token (Bearer header or `?token=`) |
| `TTS_CORS_ORIGIN` | web | If set, sends CORS headers for this origin |

## Key Libraries

### MiMo TTS API
- Base URL: `https://api.xiaomimimo.com/v1`
- Models: `mimo-v2.5-tts`, `mimo-v2.5-tts-voicedesign`, `mimo-v2.5-tts-voiceclone`
- Audio formats: `wav` (complete), `pcm16` (streaming, 24kHz)
- Authentication: API key via `TTS_API_KEY` env var

### Wails v2
- Frontend/Go binding via `wailsjs/go/desktop/App`
- Event system for real-time updates

## Code Style - Go

- **Formatting**: Use `gofmt` (tabs for indentation, no exceptions).
- **Imports**: Standard library first, blank line, then third-party.
- **Naming**: CamelCase for exported, camelCase for unexported.
- **Error handling**: Return `error` as the last return value.

## Code Style - TypeScript / React

- **Formatting**: No semicolons at end of statements.
- **Components**: Functional components with hooks.
- **State**: Use `useState` hook.
- **CSS**: Single `App.css` file with CSS variables.
- **Backend calls**: Import from `../lib/backend`. Do NOT import from `wailsjs/`.

## Key Conventions

- **Do not edit `frontend/wailsjs/`** - Auto-generated by Wails.
- **Settings auto-save**: SettingsDialog saves on every change.
- **i18n**: All user-facing text must use `useI18n()` hook.

## Commit Rules

Commit message format:
- `feat: <description>` — new feature
- `fix: <description>` — bug fix
- `docs: <description>` — documentation change
- `refactor: <description>` — refactor

Rules:
- Each commit contains exactly one logical change
- Descriptions are concise and clear
- **Commit messages MUST be in English**
- Always run `go build ./...` and `npm run build` before committing
