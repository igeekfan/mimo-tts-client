package core

import (
	"strings"
	"testing"
)

func TestGetSettingsDefaultsWithoutDB(t *testing.T) {
	s := &Service{apiKey: "env-key"}
	got := s.GetSettings()

	if got.Language != "zh-CN" {
		t.Errorf("Language = %q, want zh-CN", got.Language)
	}
	if got.Theme != "dark" {
		t.Errorf("Theme = %q, want dark", got.Theme)
	}
	if got.Model != "mimo-v2.5-tts" {
		t.Errorf("Model = %q, want mimo-v2.5-tts", got.Model)
	}
	if got.BaseUrl != "https://api.xiaomimimo.com/v1" {
		t.Errorf("BaseUrl = %q, want default", got.BaseUrl)
	}
	if got.ApiKey != "env-key" {
		t.Errorf("ApiKey = %q, want env-key fallback", got.ApiKey)
	}
}

func TestSaveAndGetSettingsRoundTrip(t *testing.T) {
	s := newTestService(t)

	in := Settings{
		Language: "en-US",
		Theme:    "light",
		ApiKey:   "sk-roundtrip",
		BaseUrl:  "https://example.test/v1",
		Model:    "mimo-v2.5-tts",
		Voice:    "mimo_default",
		Style:    "cheerful",
	}
	if err := s.SaveSettings(in); err != nil {
		t.Fatalf("SaveSettings: %v", err)
	}

	got := s.GetSettings()
	if got.Language != "en-US" || got.Theme != "light" || got.Style != "cheerful" {
		t.Fatalf("round trip mismatch: %+v", got)
	}
	// The key is stored encrypted but must decrypt back to the original.
	if got.ApiKey != "sk-roundtrip" {
		t.Fatalf("ApiKey round trip = %q, want sk-roundtrip", got.ApiKey)
	}
}

func TestSettingsNeverPersistOrReturnVoiceDataURI(t *testing.T) {
	s := newTestService(t)
	safe := Settings{
		Language: "en-US",
		Theme:    "dark",
		Model:    "mimo-v2.5-tts",
		Voice:    "mimo_default",
	}
	if err := s.SaveSettings(safe); err != nil {
		t.Fatalf("save safe settings: %v", err)
	}

	unsafe := safe
	unsafe.Voice = " \nDATA:audio/wav;base64,U0VDUkVU"
	if err := s.SaveSettings(unsafe); err == nil {
		t.Fatal("SaveSettings accepted a voice data URI")
	}
	var persisted SettingsRecord
	if err := s.db.First(&persisted, 1).Error; err != nil {
		t.Fatalf("read settings row: %v", err)
	}
	if persisted.Voice != safe.Voice {
		t.Fatalf("failed save changed persisted voice to %q", persisted.Voice)
	}

	// Simulate a row written by an older concurrently running application.
	if err := s.db.Model(&SettingsRecord{}).Where("id = ?", 1).
		Update("voice", "data:audio/mpeg;base64,TEVBSw==").Error; err != nil {
		t.Fatalf("inject legacy voice: %v", err)
	}
	got := s.GetSettings()
	if isDataURI(got.Voice) || strings.Contains(got.Voice, "TEVBSw") {
		t.Fatalf("GetSettings leaked legacy voice data: %q", got.Voice)
	}
	if got.Voice != "mimo_default" {
		t.Fatalf("GetSettings voice = %q, want safe default", got.Voice)
	}
}

func TestSaveSettingsRejectsOversizedFields(t *testing.T) {
	s := newTestService(t)
	base := Settings{
		Language: "zh-CN",
		Theme:    "dark",
		ApiKey:   "key",
		BaseUrl:  "https://example.test/v1",
		Model:    "model",
		Voice:    "voice",
		Style:    "style",
	}
	tests := []struct {
		name   string
		mutate func(*Settings)
	}{
		{"language", func(v *Settings) { v.Language = strings.Repeat("x", maxSettingsLanguageBytes+1) }},
		{"theme", func(v *Settings) { v.Theme = strings.Repeat("x", maxSettingsThemeBytes+1) }},
		{"api key", func(v *Settings) { v.ApiKey = strings.Repeat("x", maxSettingsAPIKeyBytes+1) }},
		{"base URL", func(v *Settings) { v.BaseUrl = strings.Repeat("x", maxSettingsBaseURLBytes+1) }},
		{"model", func(v *Settings) { v.Model = strings.Repeat("x", maxSettingsModelBytes+1) }},
		{"voice", func(v *Settings) { v.Voice = strings.Repeat("x", maxSettingsVoiceBytes+1) }},
		{"style", func(v *Settings) { v.Style = strings.Repeat("x", maxSettingsStyleBytes+1) }},
		{"style history count", func(v *Settings) { v.StyleHistory = make([]string, maxStyleHistoryEntries+1) }},
		{"style history entry", func(v *Settings) { v.StyleHistory = []string{strings.Repeat("x", maxSettingsStyleBytes+1)} }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			input := base
			tc.mutate(&input)
			if err := s.SaveSettings(input); err == nil {
				t.Fatal("SaveSettings unexpectedly accepted oversized field")
			}
		})
	}
}

func TestGetSettingsIgnoresOversizedPersistedVoice(t *testing.T) {
	s := newTestService(t)
	if err := s.db.Create(&SettingsRecord{
		ID:    1,
		Voice: strings.Repeat("x", maxSettingsVoiceBytes+1),
	}).Error; err != nil {
		t.Fatalf("seed settings: %v", err)
	}
	if got := s.GetSettings(); got.Voice != "mimo_default" {
		t.Fatalf("GetSettings voice = %q, want safe default", got.Voice)
	}
}

func TestSettingsHonorLockedBaseURL(t *testing.T) {
	s := newTestService(t)
	if err := s.LockBaseURL("https://fixed.example/v1/"); err != nil {
		t.Fatalf("LockBaseURL: %v", err)
	}
	input := Settings{
		Language: "zh-CN",
		Theme:    "dark",
		BaseUrl:  "https://attacker.example/collect",
		Model:    "mimo-v2.5-tts",
		Voice:    "mimo_default",
	}
	if err := s.SaveSettings(input); err != nil {
		t.Fatalf("SaveSettings: %v", err)
	}

	var persisted SettingsRecord
	if err := s.db.First(&persisted, 1).Error; err != nil {
		t.Fatalf("read persisted settings: %v", err)
	}
	if persisted.BaseUrl != "https://fixed.example/v1" {
		t.Fatalf("persisted BaseUrl = %q", persisted.BaseUrl)
	}
	if got := s.GetSettings(); got.BaseUrl != "https://fixed.example/v1" {
		t.Fatalf("GetSettings BaseUrl = %q", got.BaseUrl)
	}
}

func TestWebStartupOverwritesLegacyBaseURLForLaterDesktopUse(t *testing.T) {
	configRoot := t.TempDir()
	t.Setenv("APPDATA", configRoot)
	t.Setenv("XDG_CONFIG_HOME", configRoot)
	t.Setenv("HOME", configRoot)

	legacy := NewService("test")
	if err := legacy.Startup(); err != nil {
		t.Fatalf("legacy Startup: %v", err)
	}
	if err := legacy.SaveSettings(Settings{
		Language: "zh-CN",
		Theme:    "dark",
		BaseUrl:  "https://attacker.example/collect",
		Model:    "mimo-v2.5-tts",
		Voice:    "mimo_default",
	}); err != nil {
		t.Fatalf("seed legacy settings: %v", err)
	}
	if err := legacy.Shutdown(); err != nil {
		t.Fatalf("legacy Shutdown: %v", err)
	}

	web := NewService("test")
	if err := web.LockBaseURL("https://fixed.example/v1"); err != nil {
		t.Fatalf("LockBaseURL: %v", err)
	}
	if err := web.Startup(); err != nil {
		t.Fatalf("web Startup: %v", err)
	}
	if err := web.Shutdown(); err != nil {
		t.Fatalf("web Shutdown: %v", err)
	}

	desktop := NewService("test")
	if err := desktop.Startup(); err != nil {
		t.Fatalf("desktop Startup: %v", err)
	}
	t.Cleanup(func() { _ = desktop.Shutdown() })
	if got := desktop.GetSettings().BaseUrl; got != "https://fixed.example/v1" {
		t.Fatalf("desktop BaseUrl = %q, want fixed URL", got)
	}
}
