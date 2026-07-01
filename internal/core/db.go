package core

import (
	"os"
	"path/filepath"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type SettingsRecord struct {
	ID           uint `gorm:"primaryKey"`
	Language     string
	Theme        string
	ApiKey       string
	BaseUrl      string
	Model        string
	Voice        string
	Style        string
	StyleHistory string `gorm:"type:text"` // JSON array of strings
}

type HistoryRecord struct {
	ID        uint   `gorm:"primaryKey"`
	Text      string `gorm:"type:text"`
	Model     string
	Voice     string
	Style     string
	AudioData []byte `gorm:"type:blob"`
	Format    string
	CreatedAt time.Time
}

func openDB() (*gorm.DB, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	appDir := filepath.Join(dir, "mimo-tts-client")
	if err := os.MkdirAll(appDir, 0700); err != nil {
		return nil, err
	}
	dbPath := filepath.Join(appDir, "settings.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		return nil, err
	}
	if err := db.AutoMigrate(&SettingsRecord{}, &HistoryRecord{}); err != nil {
		return nil, err
	}
	return db, nil
}
