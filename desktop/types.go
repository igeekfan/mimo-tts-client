package desktop

const AppVersion = "1.0.0"

type Settings struct {
	Language string `json:"language"`
	Theme    string `json:"theme"`
	ApiKey   string `json:"apiKey"`
	BaseUrl  string `json:"baseUrl"`
	Model    string `json:"model"`
	Voice    string `json:"voice"`
	Style    string `json:"style"`
}

type TTSRequest struct {
	Text      string `json:"text"`
	Model     string `json:"model"`
	Voice     string `json:"voice"`
	Style     string `json:"style"`
	OutputDir string `json:"outputDir"`
}

type TTSResponse struct {
	AudioData string `json:"audioData"`
	Format    string `json:"format"`
	Error     string `json:"error"`
}

type StreamTTSRequest struct {
	StreamID string `json:"streamId"`
	Text     string `json:"text"`
	Model    string `json:"model"`
	Voice    string `json:"voice"`
	Style    string `json:"style"`
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

type AboutInfo struct {
	AppVersion    string `json:"appVersion"`
	SystemVersion string `json:"systemVersion"`
	AuthorEmail   string `json:"authorEmail"`
}
