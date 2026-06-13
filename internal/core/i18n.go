package core

import "sync"

type Lang string

const (
	LangZhCN Lang = "zh-CN"
	LangEnUS Lang = "en-US"
)

var translations = map[Lang]map[string]string{
	LangZhCN: {},
	LangEnUS: {},
}

// I18n provides language-aware string lookups.
type I18n struct {
	mu   sync.RWMutex
	lang Lang
}

// NewI18n creates an I18n instance with the default language (zh-CN).
func NewI18n() *I18n {
	return &I18n{lang: LangZhCN}
}

// SetLang switches the active language.
func (i *I18n) SetLang(lang Lang) {
	i.mu.Lock()
	defer i.mu.Unlock()
	if lang == LangZhCN || lang == LangEnUS {
		i.lang = lang
	}
}

// GetLang returns the active language.
func (i *I18n) GetLang() Lang {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.lang
}

// T returns the translation for the given key in the active language.
// If the key is missing in the active language, it falls back to zh-CN.
// If the key is not found at all, the key itself is returned.
func (i *I18n) T(key string) string {
	i.mu.RLock()
	lang := i.lang
	i.mu.RUnlock()
	if m, ok := translations[lang]; ok {
		if v, ok := m[key]; ok {
			return v
		}
	}
	if m, ok := translations[LangZhCN]; ok {
		if v, ok := m[key]; ok {
			return v
		}
	}
	return key
}
