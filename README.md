# MiMo TTS Client

[English](README.md) | [简体中文](README.zh-CN.md)

A cross-platform desktop TTS (Text-to-Speech) client powered by [MiMo-V2.5-TTS](https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/multimodal-understanding/speech-synthesis-v2.5). Built with Go + Wails + React.

## Features

- **Three synthesis models**: Preset voices, voice design (text-to-voice), voice clone (audio-to-voice)
- **9 preset voices**: Chinese (冰糖, 茉莉, 苏打, 白桦) and English (Mia, Chloe, Milo, Dean, default)
- **16+ style presets**: Including dialect (东北话, 四川话, 粤语), singing, and various emotions
- **Director mode**: Fine-grained control via character, scene, and direction parameters
- **Voice design**: Generate custom voices from text descriptions
- **Voice clone**: Clone a voice from audio samples
- **Streaming output**: Low-latency real-time PCM16 audio streaming with play/pause/cancel
- **Audio player**: Progress bar, seek, volume control, play/pause/stop
- **Synthesis history**: Persistent storage with play, download, and delete
- **Style history**: Recently used style tags for quick reuse
- **Dark/Light theme**: Manual toggle or automatic system theme detection
- **Bilingual UI**: Chinese and English interface, auto-save settings
- **Dual mode**: Desktop app (Wails) + Web server (HTTP/SSE) with shared codebase
- **REST API**: Full HTTP API for headless/remote usage

## Supported Models

| Model ID | Description |
|----------|-------------|
| `mimo-v2.5-tts` | Preset voices, supports singing |
| `mimo-v2.5-tts-voicedesign` | Text-described voice generation |
| `mimo-v2.5-tts-voiceclone` | Voice cloning from audio samples |

## Requirements

- [Go](https://go.dev/dl/) 1.21+
- [Node.js](https://nodejs.org/) 18+
- [Wails v2](https://wails.io/docs/gettingstarted/installation)

## Development

```bash
# Install dependencies
cd frontend && npm install && cd ..

# Run dev server
wails dev

# Build production binary
wails build
```

## API Key

Set your MiMo API key as an environment variable:

```bash
export TTS_API_KEY="your_api_key_here"
```

You can also configure the API key and base URL in the application settings UI.

## Usage

1. Launch the application
2. Select a model (preset voice, voice design, or voice clone)
3. Choose a voice or describe the desired voice
4. Enter text to synthesize
5. Optionally add style instructions or use director mode
6. Click **Synthesize** or **Stream** for real-time playback
7. Play, pause, or download the generated audio

## macOS Installation Note

If macOS blocks the app with a message such as "untrusted developer" or says the app should be moved to Trash, remove the quarantine attribute and try again:

```bash
sudo xattr -rd com.apple.quarantine /Applications/MiMo-TTS.app
```

If you launch the app from a different location, replace `/Applications/MiMo-TTS.app` with the actual app path.

This workaround matches the current unsigned release behavior on macOS. A properly signed and notarized release is still recommended for smoother installation.

## Web Mode

In addition to the desktop app, the server can run as a standalone web server:

```bash
go build -tags web -o tts-server .
./tts-server
# Open http://localhost:8080
```

Or with Docker:

```bash
docker build -t tts .
docker run -p 8080:8080 -e TTS_API_KEY=your_key tts
```

### Web mode environment variables

| Variable | Description |
|----------|-------------|
| `TTS_API_KEY` | MiMo API key (fallback when not set in Settings) |
| `TTS_WEB_ADDR` | Listen address (default `:8080`) |
| `TTS_WEB_TOKEN` | If set, every `/api/*` request requires this token (sent as a Bearer header, or `?token=` for the event stream). The web UI prompts for it. |
| `TTS_CORS_ORIGIN` | If set, emits CORS headers allowing this origin |

The web API never returns the stored API key, and the key is encrypted at rest.

## Tech Stack

- **Backend**: Go, Wails v2, GORM + SQLite
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Radix UI
- **API**: MiMo-V2.5-TTS (OpenAI-compatible interface)

## Project Structure

See [PLAN.md](PLAN.md) for detailed project structure and development plan.

## License

MIT
