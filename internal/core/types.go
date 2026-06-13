package core

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
