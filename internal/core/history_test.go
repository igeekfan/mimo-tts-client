package core

import (
	"bytes"
	"encoding/json"
	"errors"
	"log"
	"regexp"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// newTestService returns a Service backed by an isolated in-memory SQLite
// database. A single connection is used so the in-memory schema stays visible
// without leaking state across tests.
func newTestService(t *testing.T) *Service {
	t.Helper()
	db := newTestDB(t)
	if err := migrateDatabase(db); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return &Service{db: db, i18n: NewI18n()}
}

func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("db handle: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	return db
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

func TestHistoryQuotaConfiguration(t *testing.T) {
	if MaxHistoryRecords != 200 {
		t.Fatalf("MaxHistoryRecords = %d, want 200", MaxHistoryRecords)
	}
	if MaxHistoryAudioBytes != 50*1024*1024 {
		t.Fatalf("MaxHistoryAudioBytes = %d, want 50 MiB", MaxHistoryAudioBytes)
	}
	if MaxHistoryTotalAudioBytes != 512*1024*1024 {
		t.Fatalf("MaxHistoryTotalAudioBytes = %d, want 512 MiB", MaxHistoryTotalAudioBytes)
	}
}

func TestSaveHistoryRejectsAudioOverPerRecordQuota(t *testing.T) {
	s := newTestService(t)
	overLimit := make([]byte, maxHistoryAudioBytes+1)

	err := s.SaveHistory("text", "model", "voice", "style", "wav", overLimit)
	if !errors.Is(err, ErrHistoryAudioTooLarge) {
		t.Fatalf("SaveHistory error = %v, want ErrHistoryAudioTooLarge", err)
	}
	var count int64
	if err := s.db.Model(&HistoryRecord{}).Count(&count).Error; err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 0 {
		t.Fatalf("oversized audio was persisted; count = %d", count)
	}
}

func TestSaveHistoryPrunesTotalAudioNewestFirst(t *testing.T) {
	s := newTestService(t)
	const testTotalLimit = int64(10)

	for _, tc := range []struct {
		text string
		size int
	}{
		{"oldest", 7},
		{"middle", 3},
		{"newest", 4},
	} {
		if err := s.saveHistoryWithLimits(tc.text, "model", "voice", "", "wav", make([]byte, tc.size), 10, testTotalLimit); err != nil {
			t.Fatalf("save %s: %v", tc.text, err)
		}
	}

	var records []HistoryRecord
	if err := s.db.Order("created_at DESC").Order("id DESC").Find(&records).Error; err != nil {
		t.Fatalf("read records: %v", err)
	}
	if len(records) != 2 || records[0].Text != "newest" || records[1].Text != "middle" {
		t.Fatalf("retained records = %+v, want newest and middle", records)
	}
	var totalBytes int64
	if err := s.db.Model(&HistoryRecord{}).Select("COALESCE(SUM(length(audio_data)), 0)").Scan(&totalBytes).Error; err != nil {
		t.Fatalf("sum audio: %v", err)
	}
	if totalBytes > testTotalLimit {
		t.Fatalf("total audio = %d, limit = %d", totalBytes, testTotalLimit)
	}
}

func TestSaveHistoryValidatesMetadata(t *testing.T) {
	s := newTestService(t)
	tests := []struct {
		name   string
		text   string
		model  string
		voice  string
		style  string
		format string
	}{
		{"text", strings.Repeat("x", maxHistoryTextBytes+1), "model", "voice", "", "wav"},
		{"model", "text", strings.Repeat("x", maxHistoryModelBytes+1), "voice", "", "wav"},
		{"voice", "text", "model", strings.Repeat("x", maxHistoryVoiceBytes+1), "", "wav"},
		{"voice data URI", "text", "model", "\tDATA:audio/wav;base64,AAAA", "", "wav"},
		{"style", "text", "model", "voice", strings.Repeat("x", maxHistoryStyleBytes+1), "wav"},
		{"format", "text", "model", "voice", "", strings.Repeat("x", maxHistoryFormatBytes+1)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if err := s.SaveHistory(tc.text, tc.model, tc.voice, tc.style, tc.format, []byte{1}); err == nil {
				t.Fatal("SaveHistory unexpectedly accepted invalid metadata")
			}
		})
	}
}

func TestHistoryListAndSearchProjectMetadataWithoutBlob(t *testing.T) {
	s := newTestService(t)
	secretAudio := []byte("audio payload that must only be fetched explicitly")
	if err := s.SaveHistory("find me", "model", "voice", "style", "wav", secretAudio); err != nil {
		t.Fatalf("save: %v", err)
	}

	var sqlLog bytes.Buffer
	queryLogger := logger.New(log.New(&sqlLog, "", 0), logger.Config{LogLevel: logger.Info})
	s.db = s.db.Session(&gorm.Session{Logger: queryLogger})

	items, err := s.GetHistory(10)
	if err != nil {
		t.Fatalf("GetHistory: %v", err)
	}
	if len(items) != 1 || !items[0].HasAudio {
		t.Fatalf("GetHistory items = %+v", items)
	}
	assertNoBlobProjection(t, sqlLog.String())

	sqlLog.Reset()
	items, total, err := s.SearchHistory("find", 0, 10)
	if err != nil {
		t.Fatalf("SearchHistory: %v", err)
	}
	if total != 1 || len(items) != 1 || !items[0].HasAudio {
		t.Fatalf("SearchHistory total/items = %d/%+v", total, items)
	}
	assertNoBlobProjection(t, sqlLog.String())

	audio, format, err := s.GetHistoryAudio(items[0].ID)
	if err != nil {
		t.Fatalf("GetHistoryAudio: %v", err)
	}
	if !bytes.Equal(audio, secretAudio) || format != "wav" {
		t.Fatalf("GetHistoryAudio = %q/%q", audio, format)
	}
}

func TestHistoryNeverReturnsInjectedDataURI(t *testing.T) {
	s := newTestService(t)
	dataURI := "data:audio/wav;base64,U0VDUkVUX1ZPSUNF"
	if err := s.db.Create(&HistoryRecord{
		Text:      "legacy",
		Model:     "model",
		Voice:     dataURI,
		AudioData: []byte{1},
		Format:    "wav",
	}).Error; err != nil {
		t.Fatalf("inject legacy row: %v", err)
	}

	items, err := s.GetHistory(10)
	if err != nil {
		t.Fatalf("GetHistory: %v", err)
	}
	searched, _, err := s.SearchHistory("legacy", 0, 10)
	if err != nil {
		t.Fatalf("SearchHistory: %v", err)
	}
	encoded, err := json.Marshal(append(items, searched...))
	if err != nil {
		t.Fatalf("marshal results: %v", err)
	}
	if bytes.Contains(bytes.ToLower(encoded), []byte("data:")) || bytes.Contains(encoded, []byte("U0VDUkVUX1ZPSUNF")) {
		t.Fatalf("history leaked data URI: %s", encoded)
	}
	for _, item := range append(items, searched...) {
		if item.Voice != "" {
			t.Fatalf("invalid voice was not omitted: %q", item.Voice)
		}
	}
}

func assertNoBlobProjection(t *testing.T, sql string) {
	t.Helper()
	if regexp.MustCompile(`(?i)SELECT\s+\*`).MatchString(sql) {
		t.Fatalf("history query used SELECT *:\n%s", sql)
	}
	// audio_data may occur inside length(audio_data) to derive HasAudio, but it
	// must never be a selected column in list/search queries.
	if regexp.MustCompile(`(?i)(?:SELECT|,)\s*audio_data\s*(?:,|FROM)`).MatchString(sql) {
		t.Fatalf("history query projected audio_data BLOB:\n%s", sql)
	}
}
