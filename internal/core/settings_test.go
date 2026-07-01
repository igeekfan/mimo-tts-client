package core

import "testing"

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
