package core

import "sync"

type Lang string

const (
	LangZhCN Lang = "zh-CN"
	LangEnUS Lang = "en-US"
)

var translations = map[Lang]map[string]string{
	LangZhCN: {
		"err.api_key_missing": "API Key 未配置，请在设置中填写",
		"err.marshal_request": "请求序列化失败",
		"err.create_request":  "创建请求失败",
		"err.api_request":     "API 请求失败",
		"err.read_response":   "读取响应失败",
		"err.api_error":       "API 错误",
		"err.api_status":      "API 返回状态码",
		"err.parse_response":  "解析响应失败",
		"err.empty_result":    "API 返回空结果",
		"err.no_audio":        "API 未返回音频数据",
		"err.decode_audio":    "解码音频失败",
	},
	LangEnUS: {
		"err.api_key_missing": "API key is not configured. Please set it in Settings.",
		"err.marshal_request": "failed to serialize request",
		"err.create_request":  "failed to create request",
		"err.api_request":     "API request failed",
		"err.read_response":   "failed to read response",
		"err.api_error":       "API error",
		"err.api_status":      "API returned status code",
		"err.parse_response":  "failed to parse response",
		"err.empty_result":    "API returned an empty result",
		"err.no_audio":        "API returned no audio data",
		"err.decode_audio":    "failed to decode audio",
	},
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
