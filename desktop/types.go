package desktop

const AppVersion = "1.0.0"

type Settings struct {
	Language     string   `json:"language"`
	Theme        string   `json:"theme"`
	ApiKey       string   `json:"apiKey"`
	BaseUrl      string   `json:"baseUrl"`
	Model        string   `json:"model"`
	Voice        string   `json:"voice"`
	Style        string   `json:"style"`
	StyleHistory []string `json:"styleHistory"`
}

type TTSRequest struct {
	Text                string `json:"text"`
	Model               string `json:"model"`
	Voice               string `json:"voice"`
	Style               string `json:"style"`
	OutputDir           string `json:"outputDir"`
	OptimizeTextPreview bool   `json:"optimizeTextPreview"`
}

type TTSResponse struct {
	AudioData string `json:"audioData"`
	Format    string `json:"format"`
	Error     string `json:"error"`
}

type StreamTTSRequest struct {
	StreamID            string `json:"streamId"`
	Text                string `json:"text"`
	Model               string `json:"model"`
	Voice               string `json:"voice"`
	Style               string `json:"style"`
	OptimizeTextPreview bool   `json:"optimizeTextPreview"`
}

type StreamChunk struct {
	Data  string `json:"data"`
	Error string `json:"error"`
	Done  bool   `json:"done"`
}

type HistoryItem struct {
	ID        uint   `json:"id"`
	Text      string `json:"text"`
	Model     string `json:"model"`
	Voice     string `json:"voice"`
	Style     string `json:"style"`
	HasAudio  bool   `json:"hasAudio"`
	Format    string `json:"format"`
	CreatedAt string `json:"createdAt"`
}

type SaveHistoryRequest struct {
	Text      string `json:"text"`
	Model     string `json:"model"`
	Voice     string `json:"voice"`
	Style     string `json:"style"`
	AudioData string `json:"audioData"`
	Format    string `json:"format"`
}

type HistoryAudioResponse struct {
	AudioData string `json:"audioData"`
	Format    string `json:"format"`
}

type HistorySearchResult struct {
	Items  []HistoryItem `json:"items"`
	Total  int64         `json:"total"`
	Offset int           `json:"offset"`
	Limit  int           `json:"limit"`
}

type AboutInfo struct {
	AppVersion    string `json:"appVersion"`
	SystemVersion string `json:"systemVersion"`
	GithubRepo    string `json:"githubRepo"`
	GithubURL     string `json:"githubUrl"`
	AuthorEmail   string `json:"authorEmail"`
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
