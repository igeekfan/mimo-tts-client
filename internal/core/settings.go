package core

import (
	"encoding/json"
	"fmt"
	"strings"
)

const (
	maxSettingsLanguageBytes     = 32
	maxSettingsThemeBytes        = 32
	maxSettingsAPIKeyBytes       = 4 * 1024
	maxSettingsBaseURLBytes      = 4 * 1024
	maxSettingsModelBytes        = 128
	maxSettingsVoiceBytes        = MaxVoiceDesignBytes
	maxSettingsStyleBytes        = MaxSynthesisStyleBytes
	maxStyleHistoryEntries       = 100
	maxSettingsStyleHistoryBytes = 512 * 1024

	// AES-GCM metadata and base64 encoding add less than 2x overhead. Bounding
	// the stored value before decrypting also protects reads from malformed DB
	// rows that are much larger than a valid API key could produce.
	maxStoredEncryptedAPIKeyBytes = maxSettingsAPIKeyBytes * 2
)

func (s *Service) GetSettings() Settings {
	fixedBaseURL := s.FixedBaseURL()
	baseURL := DefaultBaseURL
	if fixedBaseURL != "" {
		baseURL = fixedBaseURL
	}
	defaults := Settings{
		Language: "zh-CN",
		Theme:    "dark",
		ApiKey:   s.apiKey,
		BaseUrl:  baseURL,
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
	if isValidStoredString(rec.Language, maxSettingsLanguageBytes) && rec.Language != "" {
		defaults.Language = rec.Language
	}
	if isValidStoredString(rec.Theme, maxSettingsThemeBytes) && rec.Theme != "" {
		defaults.Theme = rec.Theme
	}
	if rec.ApiKey != "" && len(rec.ApiKey) <= maxStoredEncryptedAPIKeyBytes {
		if dec, err := decryptSecret(rec.ApiKey); err == nil && len(dec) <= maxSettingsAPIKeyBytes {
			defaults.ApiKey = dec
		}
	}
	if fixedBaseURL == "" && isValidStoredString(rec.BaseUrl, maxSettingsBaseURLBytes) && rec.BaseUrl != "" {
		defaults.BaseUrl = rec.BaseUrl
	}
	if isValidStoredString(rec.Model, maxSettingsModelBytes) && rec.Model != "" {
		defaults.Model = rec.Model
	}
	// A migration removes legacy data URIs at startup. Keep this read-time
	// guard as defence in depth for databases changed by an older process.
	if isValidStoredVoice(rec.Voice) && rec.Voice != "" {
		defaults.Voice = rec.Voice
	}
	if isValidStoredString(rec.Style, maxSettingsStyleBytes) {
		defaults.Style = rec.Style
	}
	if rec.StyleHistory != "" && len(rec.StyleHistory) <= maxSettingsStyleHistoryBytes {
		var history []string
		if err := json.Unmarshal([]byte(rec.StyleHistory), &history); err == nil && validStyleHistory(history) == nil {
			defaults.StyleHistory = history
		}
	}
	return defaults
}

func (s *Service) SaveSettings(settings Settings) error {
	if s.db == nil {
		return fmt.Errorf("database not initialized")
	}
	// Web mode locks the upstream before startup. Ignore any client-submitted
	// BaseUrl and persist the locked value so a later desktop read cannot revive
	// an attacker-controlled endpoint.
	if fixedBaseURL := s.FixedBaseURL(); fixedBaseURL != "" {
		settings.BaseUrl = fixedBaseURL
	}
	if err := validateSettings(settings); err != nil {
		return err
	}

	var styleHistoryJSON string
	if len(settings.StyleHistory) > 0 {
		b, err := json.Marshal(settings.StyleHistory)
		if err != nil {
			return fmt.Errorf("encode style history: %w", err)
		}
		if len(b) > maxSettingsStyleHistoryBytes {
			return fmt.Errorf("style history exceeds %d bytes", maxSettingsStyleHistoryBytes)
		}
		styleHistoryJSON = string(b)
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

func validateSettings(settings Settings) error {
	fields := []struct {
		name  string
		value string
		max   int
	}{
		{"language", settings.Language, maxSettingsLanguageBytes},
		{"theme", settings.Theme, maxSettingsThemeBytes},
		{"api key", settings.ApiKey, maxSettingsAPIKeyBytes},
		{"base URL", settings.BaseUrl, maxSettingsBaseURLBytes},
		{"model", settings.Model, maxSettingsModelBytes},
		{"style", settings.Style, maxSettingsStyleBytes},
	}
	for _, field := range fields {
		if err := validateStringLength(field.name, field.value, field.max); err != nil {
			return err
		}
	}
	if err := validateVoice(settings.Voice, maxSettingsVoiceBytes); err != nil {
		return err
	}
	return validStyleHistory(settings.StyleHistory)
}

func validStyleHistory(history []string) error {
	if len(history) > maxStyleHistoryEntries {
		return fmt.Errorf("style history exceeds %d entries", maxStyleHistoryEntries)
	}
	for i, style := range history {
		if err := validateStringLength(fmt.Sprintf("style history entry %d", i), style, maxSettingsStyleBytes); err != nil {
			return err
		}
	}
	return nil
}

func validateVoice(voice string, maxBytes int) error {
	if err := validateStringLength("voice", voice, maxBytes); err != nil {
		return err
	}
	if isDataURI(voice) {
		return fmt.Errorf("voice must be a preset ID, design description, or clone file label; data URIs are not allowed")
	}
	return nil
}

func validateStringLength(name, value string, maxBytes int) error {
	if len(value) > maxBytes {
		return fmt.Errorf("%s exceeds %d bytes", name, maxBytes)
	}
	return nil
}

func isValidStoredString(value string, maxBytes int) bool {
	return len(value) <= maxBytes
}

func isValidStoredVoice(voice string) bool {
	return len(voice) <= maxSettingsVoiceBytes && !isDataURI(voice)
}

func isDataURI(value string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(value)), "data:")
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
