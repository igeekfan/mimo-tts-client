package core

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"gorm.io/gorm"
)

type Hooks struct {
	AppLog func(string)
}

type Service struct {
	i18n         *I18n
	mu           sync.RWMutex
	db           *gorm.DB
	appVersion   string
	hooks        Hooks
	apiKey       string // from TTS_API_KEY env
}

func NewService(appVersion string) *Service {
	s := &Service{
		i18n:       NewI18n(),
		appVersion: appVersion,
		apiKey:     os.Getenv("TTS_API_KEY"),
	}
	return s
}

func (s *Service) SetHooks(h Hooks) {
	s.hooks = h
}

func (s *Service) Startup() error {
	db, err := openDB()
	if err != nil {
		return err
	}
	s.db = db
	settings := s.GetSettings()
	// Initialize i18n language from saved settings
	if settings.Language != "" {
		s.i18n.SetLang(Lang(settings.Language))
	}
	return nil
}

func (s *Service) emitLog(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	if s.hooks.AppLog != nil {
		s.hooks.AppLog(msg)
	}
}

func (s *Service) GetCurrentVersion() string {
	return s.appVersion
}

func (s *Service) GetDataDir() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, "mimo-tts-client")
}
