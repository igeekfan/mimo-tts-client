package core

import (
	"encoding/json"
	"fmt"
)

func (s *Service) GetSettings() Settings {
	defaults := Settings{
		Language: "zh-CN",
		Theme:    "dark",
		ApiKey:   s.apiKey,
		BaseUrl:  "https://api.xiaomimimo.com/v1",
		Model:    "mimo-v2.5-tts",
		Voice:    "mimo_default",
		Style:    "",
	}
	if s.db == nil {
		return defaults
	}
	var rec SettingsRecord
	if err := s.db.First(&rec, 1).Error; err != nil {
		return defaults
	}
	if rec.Language != "" {
		defaults.Language = rec.Language
	}
	if rec.Theme != "" {
		defaults.Theme = rec.Theme
	}
	if rec.ApiKey != "" {
		if dec, err := decryptSecret(rec.ApiKey); err == nil {
			defaults.ApiKey = dec
		}
	}
	if rec.BaseUrl != "" {
		defaults.BaseUrl = rec.BaseUrl
	}
	if rec.Model != "" {
		defaults.Model = rec.Model
	}
	if rec.Voice != "" {
		defaults.Voice = rec.Voice
	}
	defaults.Style = rec.Style
	if rec.StyleHistory != "" {
		var history []string
		if err := json.Unmarshal([]byte(rec.StyleHistory), &history); err == nil {
			defaults.StyleHistory = history
		}
	}
	return defaults
}

func (s *Service) SaveSettings(settings Settings) error {
	if s.db == nil {
		return fmt.Errorf("database not initialized")
	}

	var styleHistoryJSON string
	if len(settings.StyleHistory) > 0 {
		if b, err := json.Marshal(settings.StyleHistory); err == nil {
			styleHistoryJSON = string(b)
		}
	}
	encryptedKey, err := encryptSecret(settings.ApiKey)
	if err != nil {
		return fmt.Errorf("encrypt api key: %w", err)
	}
	rec := SettingsRecord{
		ID:           1,
		Language:     settings.Language,
		Theme:        settings.Theme,
		ApiKey:       encryptedKey,
		BaseUrl:      settings.BaseUrl,
		Model:        settings.Model,
		Voice:        settings.Voice,
		Style:        settings.Style,
		StyleHistory: styleHistoryJSON,
	}
	return s.db.Save(&rec).Error
}

func (s *Service) ResetSettings() error {
	if s.db == nil {
		return fmt.Errorf("database not initialized")
	}
	return s.db.Where("id = ?", 1).Delete(&SettingsRecord{}).Error
}

func (s *Service) SetLang(lang string) {
	s.i18n.SetLang(Lang(lang))
}

func (s *Service) GetLang() string {
	return string(s.i18n.GetLang())
}
