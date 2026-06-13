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
