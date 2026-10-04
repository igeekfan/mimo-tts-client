package core

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strings"
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
	fixedBaseURL string
	shutdown     bool
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
	s.mu.Lock()
	defer s.mu.Unlock()
	s.hooks = h
}

func (s *Service) Startup() error {
	db, err := openDB()
	if err != nil {
		return err
	}
	s.db = db
	if fixedBaseURL := s.FixedBaseURL(); fixedBaseURL != "" {
		if err := db.Transaction(func(tx *gorm.DB) error {
			return tx.Model(&SettingsRecord{}).Where("id = ?", 1).Update("base_url", fixedBaseURL).Error
		}); err != nil {
			s.db = nil
			sqlDB, sqlErr := db.DB()
			if sqlErr == nil {
				_ = sqlDB.Close()
			}
			return fmt.Errorf("persist locked base URL: %w", err)
		}
	}
	s.mu.Lock()
	s.shutdown = false
	s.mu.Unlock()
	settings := s.GetSettings()
	// Initialize i18n language from saved settings
	if settings.Language != "" {
		s.i18n.SetLang(Lang(settings.Language))
	}
	return nil
}

// Shutdown closes the underlying database. It is safe to call more than once.
func (s *Service) Shutdown() error {
	s.mu.Lock()
	if s.shutdown {
		s.mu.Unlock()
		return nil
	}
	s.shutdown = true
	db := s.db
	s.mu.Unlock()

	if db == nil {
		return nil
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// LockBaseURL fixes the upstream endpoint for the lifetime of this Service.
// Web mode calls this before Startup so settings submitted by clients can
// never redirect requests (and the api-key header) to another host.
func (s *Service) LockBaseURL(rawURL string) error {
	if strings.TrimSpace(rawURL) == "" {
		rawURL = DefaultBaseURL
	}
	normalized, err := normalizeBaseURL(rawURL)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if s.fixedBaseURL != "" && s.fixedBaseURL != normalized {
		return fmt.Errorf("base URL is already locked")
	}
	s.fixedBaseURL = normalized
	return nil
}

// FixedBaseURL returns the immutable upstream URL used by web mode. An empty
// string means desktop mode may still use its locally stored setting.
func (s *Service) FixedBaseURL() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.fixedBaseURL
}

func normalizeBaseURL(rawURL string) (string, error) {
	trimmed := strings.TrimSpace(rawURL)
	if len(trimmed) > 4<<10 {
		return "", fmt.Errorf("base URL exceeds 4096 bytes")
	}
	u, err := url.Parse(trimmed)
	if err != nil {
		return "", fmt.Errorf("invalid base URL: %w", err)
	}
	if u.Scheme != "https" && u.Scheme != "http" {
		return "", fmt.Errorf("base URL must use https")
	}
	if u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return "", fmt.Errorf("base URL must contain only scheme, host, and path")
	}
	if u.Scheme == "http" && !isLoopbackHost(u.Hostname()) {
		return "", fmt.Errorf("non-loopback base URL must use https")
	}
	u.Path = strings.TrimRight(u.Path, "/")
	u.RawPath = ""
	return strings.TrimRight(u.String(), "/"), nil
}

func isLoopbackHost(host string) bool {
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func (s *Service) emitLog(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	s.mu.RLock()
	hook := s.hooks.AppLog
	s.mu.RUnlock()
	if hook != nil {
		hook(msg)
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
