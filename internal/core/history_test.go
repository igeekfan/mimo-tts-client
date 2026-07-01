package core

import (
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// newTestService returns a Service backed by an in-memory SQLite database.
func newTestService(t *testing.T) *Service {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&SettingsRecord{}, &HistoryRecord{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return &Service{db: db, i18n: NewI18n()}
}

func TestSaveHistoryPrunesOldRecords(t *testing.T) {
	s := newTestService(t)

	total := maxHistoryRecords + 25
	for i := 0; i < total; i++ {
		if err := s.SaveHistory("text", "mimo-v2.5-tts", "mimo_default", "", "wav", []byte{1, 2, 3}); err != nil {
			t.Fatalf("save %d: %v", i, err)
		}
	}

	var count int64
	if err := s.db.Model(&HistoryRecord{}).Count(&count).Error; err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != int64(maxHistoryRecords) {
		t.Fatalf("expected %d records after prune, got %d", maxHistoryRecords, count)
	}
}
