package core

import "testing"

func TestBuildMessages(t *testing.T) {
	s := &Service{}

	t.Run("voicedesign without optimize includes text", func(t *testing.T) {
		msgs := s.buildMessages("hello", "", "warm female voice", "mimo-v2.5-tts-voicedesign", false)
		if len(msgs) != 2 {
			t.Fatalf("want 2 messages, got %d", len(msgs))
		}
		if msgs[0].Role != "user" || msgs[0].Content != "warm female voice" {
			t.Fatalf("unexpected user message: %+v", msgs[0])
		}
		if msgs[1].Role != "assistant" || msgs[1].Content != "hello" {
			t.Fatalf("unexpected assistant message: %+v", msgs[1])
		}
	})

	t.Run("voicedesign with optimize omits text", func(t *testing.T) {
		msgs := s.buildMessages("hello", "", "warm female voice", "mimo-v2.5-tts-voicedesign", true)
		if len(msgs) != 1 {
			t.Fatalf("want 1 message, got %d", len(msgs))
		}
		if msgs[0].Content != "warm female voice" {
			t.Fatalf("unexpected message: %+v", msgs[0])
		}
	})

	t.Run("preset with style", func(t *testing.T) {
		msgs := s.buildMessages("hello", "cheerful", "mimo_default", "mimo-v2.5-tts", false)
		if len(msgs) != 2 || msgs[0].Content != "cheerful" || msgs[1].Content != "hello" {
			t.Fatalf("unexpected messages: %+v", msgs)
		}
	})

	t.Run("preset without style uses empty user content", func(t *testing.T) {
		msgs := s.buildMessages("hello", "", "mimo_default", "mimo-v2.5-tts", false)
		if len(msgs) != 2 || msgs[0].Role != "user" || msgs[0].Content != "" {
			t.Fatalf("unexpected messages: %+v", msgs)
		}
		if msgs[1].Content != "hello" {
			t.Fatalf("unexpected assistant content: %+v", msgs[1])
		}
	})
}

func TestAddWavHeader(t *testing.T) {
	pcm := make([]byte, 100)
	wav := addWavHeader(pcm, 24000, 1, 16)

	if len(wav) != 44+len(pcm) {
		t.Fatalf("want %d bytes, got %d", 44+len(pcm), len(wav))
	}
	if string(wav[0:4]) != "RIFF" {
		t.Fatalf("missing RIFF marker: %q", wav[0:4])
	}
	if string(wav[8:12]) != "WAVE" {
		t.Fatalf("missing WAVE marker: %q", wav[8:12])
	}
	if string(wav[36:40]) != "data" {
		t.Fatalf("missing data marker: %q", wav[36:40])
	}
}
