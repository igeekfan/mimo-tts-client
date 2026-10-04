package core

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

const (
	MaxHistoryRecords         = 200
	MaxHistoryAudioBytes      = 50 * 1024 * 1024
	MaxHistoryTotalAudioBytes = int64(512 * 1024 * 1024)

	// Keep package-local aliases for the retention implementation and existing
	// package tests while exposing one source of truth to the HTTP adapter.
	maxHistoryRecords         = MaxHistoryRecords
	maxHistoryAudioBytes      = MaxHistoryAudioBytes
	maxHistoryTotalAudioBytes = MaxHistoryTotalAudioBytes
	maxHistoryTextBytes       = MaxSynthesisTextBytes
	maxHistoryModelBytes      = 128
	maxHistoryVoiceBytes      = maxSettingsVoiceBytes
	maxHistoryStyleBytes      = MaxSynthesisStyleBytes
	maxHistoryFormatBytes     = 32
	maxHistorySearchBytes     = 1024
)

var ErrHistoryAudioTooLarge = errors.New("history audio exceeds 50 MiB limit")

type HistoryItem struct {
	ID        uint      `json:"id"`
	Text      string    `json:"text"`
	Model     string    `json:"model"`
	Voice     string    `json:"voice"`
	Style     string    `json:"style"`
	HasAudio  bool      `json:"hasAudio"`
	Format    string    `json:"format"`
	CreatedAt time.Time `json:"createdAt"`
}

// historyMetadataRecord deliberately has no AudioData field. List and search
// queries project only display metadata and derive HasAudio inside SQLite.
type historyMetadataRecord struct {
	ID        uint
	Text      string
	Model     string
	Voice     string
	Style     string
	HasAudio  bool
	Format    string
	CreatedAt time.Time
}

type historyStorageRecord struct {
	ID         uint
	AudioBytes int64
}

func (s *Service) SaveHistory(text, model, voice, style, format string, audioData []byte) error {
	return s.saveHistoryWithLimits(
		text,
		model,
		voice,
		style,
		format,
		audioData,
		maxHistoryRecords,
		maxHistoryTotalAudioBytes,
	)
}

func (s *Service) saveHistoryWithLimits(
	text, model, voice, style, format string,
	audioData []byte,
	maxRecords int,
	maxTotalAudioBytes int64,
) error {
	if s.db == nil {
		return fmt.Errorf("database not initialized")
	}
	if err := validateHistory(text, model, voice, style, format, audioData); err != nil {
		return err
	}
	if maxRecords <= 0 || maxTotalAudioBytes < 0 {
		return fmt.Errorf("invalid history retention limits")
	}
	if int64(len(audioData)) > maxTotalAudioBytes {
		return fmt.Errorf("history audio exceeds total storage limit")
	}

	rec := HistoryRecord{
		Text:      text,
		Model:     model,
		Voice:     voice,
		Style:     style,
		AudioData: audioData,
		Format:    format,
		CreatedAt: time.Now(),
	}

	// Insert and pruning are one atomic operation. A caller never observes a
	// newly inserted row without the count and total-audio quotas also holding.
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&rec).Error; err != nil {
			return err
		}
		if err := pruneHistoryToLimits(tx, maxRecords, maxTotalAudioBytes); err != nil {
			return fmt.Errorf("prune history: %w", err)
		}
		return nil
	})
}

func validateHistory(text, model, voice, style, format string, audioData []byte) error {
	fields := []struct {
		name  string
		value string
		max   int
	}{
		{"history text", text, maxHistoryTextBytes},
		{"history model", model, maxHistoryModelBytes},
		{"history style", style, maxHistoryStyleBytes},
		{"history format", format, maxHistoryFormatBytes},
	}
	for _, field := range fields {
		if err := validateStringLength(field.name, field.value, field.max); err != nil {
			return err
		}
	}
	if err := validateVoice(voice, maxHistoryVoiceBytes); err != nil {
		return err
	}
	if len(audioData) > maxHistoryAudioBytes {
		return ErrHistoryAudioTooLarge
	}
	return nil
}

// pruneHistoryToLimits retains a newest-to-oldest prefix. It reads only row
// IDs and SQLite's BLOB length, never the BLOB itself.
func pruneHistoryToLimits(db *gorm.DB, maxRecords int, maxTotalAudioBytes int64) error {
	if maxRecords < 0 || maxTotalAudioBytes < 0 {
		return fmt.Errorf("invalid history retention limits")
	}

	var records []historyStorageRecord
	if err := db.Model(&HistoryRecord{}).
		Select("id, COALESCE(length(audio_data), 0) AS audio_bytes").
		Order("created_at DESC").
		Order("id DESC").
		Find(&records).Error; err != nil {
		return err
	}

	keepCount := 0
	var totalAudioBytes int64
	for keepCount < len(records) && keepCount < maxRecords {
		size := records[keepCount].AudioBytes
		if size < 0 || size > maxTotalAudioBytes-totalAudioBytes {
			break
		}
		totalAudioBytes += size
		keepCount++
	}
	if keepCount == len(records) {
		return nil
	}
	if keepCount == 0 {
		return db.Where("1 = 1").Delete(&HistoryRecord{}).Error
	}

	// The retained prefix is bounded (200 in production), so NOT IN never
	// creates one SQL variable per historical row when migrating an old,
	// previously unbounded database.
	keepIDs := make([]uint, 0, keepCount)
	for _, record := range records[:keepCount] {
		keepIDs = append(keepIDs, record.ID)
	}
	return db.Where("id NOT IN ?", keepIDs).Delete(&HistoryRecord{}).Error
}

func (s *Service) GetHistory(limit int) ([]HistoryItem, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}
	limit = normalizeHistoryLimit(limit, 50)

	var records []historyMetadataRecord
	if err := historyMetadataQuery(s.db).
		Order("created_at DESC").
		Order("id DESC").
		Limit(limit).
		Find(&records).Error; err != nil {
		return nil, err
	}
	return historyItems(records), nil
}

func (s *Service) SearchHistory(query string, offset, limit int) ([]HistoryItem, int64, error) {
	if s.db == nil {
		return nil, 0, fmt.Errorf("database not initialized")
	}
	if len(query) > maxHistorySearchBytes {
		return nil, 0, fmt.Errorf("history search exceeds %d bytes", maxHistorySearchBytes)
	}
	if offset < 0 {
		offset = 0
	}
	limit = normalizeHistoryLimit(limit, 20)

	baseQuery := s.db.Model(&HistoryRecord{})
	if query != "" {
		like := "%" + query + "%"
		baseQuery = baseQuery.Where("text LIKE ? OR voice LIKE ? OR style LIKE ?", like, like, like)
	}

	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var records []historyMetadataRecord
	if err := historyMetadataQuery(baseQuery).
		Order("created_at DESC").
		Order("id DESC").
		Offset(offset).
		Limit(limit).
		Find(&records).Error; err != nil {
		return nil, 0, err
	}

	return historyItems(records), total, nil
}

func historyMetadataQuery(db *gorm.DB) *gorm.DB {
	const sqliteWhitespace = " \t\r\n\v\f"
	const projection = `
		id,
		text,
		model,
		CASE
			WHEN lower(ltrim(voice, ?)) LIKE ? THEN ''
			WHEN length(CAST(voice AS BLOB)) > ? THEN ''
			ELSE voice
		END AS voice,
		style,
		CASE WHEN COALESCE(length(audio_data), 0) > 0 THEN 1 ELSE 0 END AS has_audio,
		format,
		created_at`
	return db.Model(&HistoryRecord{}).Select(
		projection,
		sqliteWhitespace,
		"data:%",
		maxHistoryVoiceBytes,
	)
}

func historyItems(records []historyMetadataRecord) []HistoryItem {
	items := make([]HistoryItem, len(records))
	for i, record := range records {
		voice := record.Voice
		if isDataURI(voice) || len(voice) > maxHistoryVoiceBytes {
			voice = ""
		}
		items[i] = HistoryItem{
			ID:        record.ID,
			Text:      record.Text,
			Model:     record.Model,
			Voice:     voice,
			Style:     record.Style,
			HasAudio:  record.HasAudio,
			Format:    record.Format,
			CreatedAt: record.CreatedAt,
		}
	}
	return items
}

func normalizeHistoryLimit(limit, fallback int) int {
	if limit <= 0 {
		return fallback
	}
	if limit > maxHistoryRecords {
		return maxHistoryRecords
	}
	return limit
}

func (s *Service) GetHistoryAudio(id uint) ([]byte, string, error) {
	if s.db == nil {
		return nil, "", fmt.Errorf("database not initialized")
	}
	var rec struct {
		AudioData []byte
		Format    string
	}
	if err := s.db.Model(&HistoryRecord{}).
		Select("audio_data, format").
		Where("id = ?", id).
		Take(&rec).Error; err != nil {
		return nil, "", err
	}
	return rec.AudioData, rec.Format, nil
}

func (s *Service) DeleteHistory(id uint) error {
	if s.db == nil {
		return fmt.Errorf("database not initialized")
	}
	return s.db.Delete(&HistoryRecord{}, id).Error
}

func (s *Service) ClearHistory() error {
	if s.db == nil {
		return fmt.Errorf("database not initialized")
	}
	return s.db.Where("1 = 1").Delete(&HistoryRecord{}).Error
}
