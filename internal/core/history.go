package core

import (
	"fmt"
	"time"
)

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

func (s *Service) SaveHistory(text, model, voice, style, format string, audioData []byte) error {
	if s.db == nil {
		return fmt.Errorf("database not initialized")
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
	return s.db.Create(&rec).Error
}

func (s *Service) GetHistory(limit int) ([]HistoryItem, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}
	if limit <= 0 {
		limit = 50
	}
	var records []HistoryRecord
	if err := s.db.Order("created_at DESC").Limit(limit).Find(&records).Error; err != nil {
		return nil, err
	}
	items := make([]HistoryItem, len(records))
	for i, r := range records {
		items[i] = HistoryItem{
			ID:        r.ID,
			Text:      r.Text,
			Model:     r.Model,
			Voice:     r.Voice,
			Style:     r.Style,
			HasAudio:  len(r.AudioData) > 0,
			Format:    r.Format,
			CreatedAt: r.CreatedAt,
		}
	}
	return items, nil
}

func (s *Service) GetHistoryAudio(id uint) ([]byte, string, error) {
	if s.db == nil {
		return nil, "", fmt.Errorf("database not initialized")
	}
	var rec HistoryRecord
	if err := s.db.First(&rec, id).Error; err != nil {
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
