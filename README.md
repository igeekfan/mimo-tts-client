# MiMo TTS Client

[English](README.md) | [简体中文](README.zh-CN.md)

A cross-platform desktop TTS (Text-to-Speech) client powered by [MiMo-V2.5-TTS](https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/multimodal-understanding/speech-synthesis-v2.5). Built with Go + Wails + React.

## Features

- **Three synthesis models**: Preset voices, voice design (text-to-voice), voice clone (audio-to-voice)
- **9 preset voices**: Chinese (冰糖, 茉莉, 苏打, 白桦) and English (Mia, Chloe, Milo, Dean, default)
- **Rich style control**: Natural language instructions and audio tag control
- **Director mode**: Fine-grained control via character, scene, and direction parameters
- **Singing mode**: Generate singing audio with Chinese lyrics
- **Streaming output**: Low-latency real-time audio streaming
- **Dark/Light theme**: Automatic system theme detection
- **Bilingual UI**: Chinese and English interface

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
export MIMO_API_KEY="your_api_key_here"
```

## Usage

1. Launch the application
2. Select a model (preset voice, voice design, or voice clone)
3. Choose a voice or describe the desired voice
4. Enter text to synthesize
5. Optionally add style instructions
6. Click **Synthesize**
7. Play or download the generated audio

## Tech Stack

- **Backend**: Go, Wails v2, GORM + SQLite
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Radix UI
- **API**: MiMo-V2.5-TTS (OpenAI-compatible interface)

## License

MIT
