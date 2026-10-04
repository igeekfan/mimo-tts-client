package core

const (
	DefaultBaseURL = "https://api.xiaomimimo.com/v1"

	ModelPreset      = "mimo-v2.5-tts"
	ModelVoiceDesign = "mimo-v2.5-tts-voicedesign"
	ModelVoiceClone  = "mimo-v2.5-tts-voiceclone"

	MaxCloneAudioBytes = 10 << 20
)

type Settings struct {
	Language     string   `json:"language"`
	Theme        string   `json:"theme"`
	ApiKey       string   `json:"apiKey"`
	BaseUrl      string   `json:"baseUrl"`
	Model        string   `json:"model"`
	Voice        string   `json:"voice"`
	Style        string   `json:"style"`
	StyleHistory []string `json:"styleHistory"`
	// HasApiKey is a read-only flag set by the web API to indicate a key is
	// configured without exposing it. It is never persisted.
	HasApiKey bool `json:"hasApiKey,omitempty"`
}

// SynthesisRequest contains only data needed for one synthesis operation.
// CloneAudioData is deliberately request-scoped: callers must not persist it
// in Settings, history metadata, or UI labels. Voice remains a preset voice ID,
// a voice-design description, or a short safe label for cloned audio.
type SynthesisRequest struct {
	Text                string `json:"text"`
	Model               string `json:"model"`
	Voice               string `json:"voice"`
	CloneAudioData      string `json:"cloneAudioData,omitempty"`
	Style               string `json:"style"`
	OptimizeTextPreview bool   `json:"optimizeTextPreview"`
}

type UpdateInfo struct {
	HasUpdate      bool   `json:"hasUpdate"`
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	ReleaseName    string `json:"releaseName"`
	ReleaseBody    string `json:"releaseBody"`
	HTMLURL        string `json:"htmlUrl"`
	PublishedAt    string `json:"publishedAt"`
}

type AboutInfo struct {
	AppVersion    string `json:"appVersion"`
	SystemVersion string `json:"systemVersion"`
	GithubRepo    string `json:"githubRepo"`
	GithubURL     string `json:"githubUrl"`
	AuthorEmail   string `json:"authorEmail"`
}
