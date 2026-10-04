package core

import (
	"fmt"
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

const legacyCloneVoiceLabel = "voiceclone_reference"

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
	if err := migrateDatabase(db); err != nil {
		return nil, err
	}
	return db, nil
}

// migrateDatabase owns schema and data migrations that must run before any
// settings or history can be returned to callers. In particular, early
// versions persisted voice-clone audio as a data URI in the Voice column.
// Remove that sensitive payload without ever selecting it into application
// memory.
func migrateDatabase(db *gorm.DB) error {
	if err := db.AutoMigrate(&SettingsRecord{}, &HistoryRecord{}); err != nil {
		return fmt.Errorf("migrate schema: %w", err)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		if err := migrateLegacyVoiceData(tx); err != nil {
			return err
		}
		if err := pruneHistoryToLimits(tx, maxHistoryRecords, maxHistoryTotalAudioBytes); err != nil {
			return fmt.Errorf("apply history retention limits: %w", err)
		}
		return nil
	})
}

func migrateLegacyVoiceData(db *gorm.DB) error {
	// SQLite's two-argument ltrim handles the ASCII whitespace that may have
	// preceded legacy browser-generated data URIs. Runtime reads additionally
	// apply strings.TrimSpace as a defence in depth.
	const sqliteWhitespace = " \t\r\n\v\f"
	const dataURIPattern = "data:%"

	if err := db.Model(&SettingsRecord{}).
		Where("lower(ltrim(voice, ?)) LIKE ?", sqliteWhitespace, dataURIPattern).
		Update("voice", "").Error; err != nil {
		return fmt.Errorf("remove legacy settings voice data: %w", err)
	}
	if err := db.Model(&HistoryRecord{}).
		Where("lower(ltrim(voice, ?)) LIKE ?", sqliteWhitespace, dataURIPattern).
		Update("voice", legacyCloneVoiceLabel).Error; err != nil {
		return fmt.Errorf("remove legacy history voice data: %w", err)
	}
	return nil
}
