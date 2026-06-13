package desktop

import (
	"mimo-tts-client/internal/core"
	"encoding/base64"
	"fmt"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func toCoreSettings(in Settings) core.Settings {
	return core.Settings(in)
}

func fromCoreSettings(in core.Settings) Settings {
	return Settings(in)
}

func fromCoreHistoryItem(in core.HistoryItem) HistoryItem {
	return HistoryItem{
		ID:        in.ID,
		Text:      in.Text,
		Model:     in.Model,
		Voice:     in.Voice,
		Style:     in.Style,
		HasAudio:  in.HasAudio,
		Format:    in.Format,
		CreatedAt: in.CreatedAt.Format(time.RFC3339),
	}
}

func (a *App) GetSettings() Settings         { return fromCoreSettings(a.service.GetSettings()) }
func (a *App) SaveSettings(s Settings) error { return a.service.SaveSettings(toCoreSettings(s)) }
func (a *App) SetLang(lang string)           { a.service.SetLang(lang) }
func (a *App) GetLang() string               { return a.service.GetLang() }
func (a *App) GetAboutInfo() AboutInfo {
	return AboutInfo{
		AppVersion:    a.service.GetCurrentVersion(),
		SystemVersion: "1.0.0",
		AuthorEmail:   "igeekfan@foxmail.com",
	}
}
func (a *App) GetCurrentVersion() string { return a.service.GetCurrentVersion() }

func (a *App) SynthesizeSpeech(req TTSRequest) (TTSResponse, error) {
	audioData, format, err := a.service.SynthesizeSpeech(req.Text, req.Model, req.Voice, req.Style)
	if err != nil {
		return TTSResponse{
			AudioData: "",
			Format:    format,
			Error:     err.Error(),
		}, nil
	}
	return TTSResponse{
		AudioData: base64.StdEncoding.EncodeToString(audioData),
		Format:    format,
		Error:     "",
	}, nil
}

func (a *App) StartSynthesizeSpeechStream(req StreamTTSRequest) error {
	if a.ctx == nil {
		return fmt.Errorf("app context not initialized")
	}
	if req.StreamID == "" {
		return fmt.Errorf("stream id is required")
	}

	eventName := "tts:stream:" + req.StreamID

	go func() {
		err := a.service.SynthesizeSpeechStream(req.Text, req.Model, req.Voice, req.Style, func(chunk []byte) error {
			wailsRuntime.EventsEmit(a.ctx, eventName, StreamChunk{
				Data: base64.StdEncoding.EncodeToString(chunk),
			})
			return nil
		})

		if err != nil {
			wailsRuntime.EventsEmit(a.ctx, eventName, StreamChunk{
				Error: err.Error(),
				Done:  true,
			})
			return
		}

		wailsRuntime.EventsEmit(a.ctx, eventName, StreamChunk{Done: true})
	}()

	return nil
}

func (a *App) GetHistory() ([]HistoryItem, error) {
	items, err := a.service.GetHistory(50)
	if err != nil {
		return nil, err
	}

	result := make([]HistoryItem, len(items))
	for i, item := range items {
		result[i] = fromCoreHistoryItem(item)
	}

	return result, nil
}

func (a *App) SaveHistory(req SaveHistoryRequest) error {
	audioData, err := base64.StdEncoding.DecodeString(req.AudioData)
	if err != nil {
		return err
	}

	return a.service.SaveHistory(req.Text, req.Model, req.Voice, req.Style, req.Format, audioData)
}

func (a *App) GetHistoryAudio(id uint) (HistoryAudioResponse, error) {
	audioData, format, err := a.service.GetHistoryAudio(id)
	if err != nil {
		return HistoryAudioResponse{}, err
	}

	return HistoryAudioResponse{
		AudioData: base64.StdEncoding.EncodeToString(audioData),
		Format:    format,
	}, nil
}

func (a *App) DeleteHistory(id uint) error {
	return a.service.DeleteHistory(id)
}

func (a *App) ClearHistory() error {
	return a.service.ClearHistory()
}
