package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

type eventMessage struct {
	Name string
	Data any
}

type EventHub struct {
	mu          sync.RWMutex
	subscribers map[chan eventMessage]struct{}
}

func NewEventHub() *EventHub {
	return &EventHub{subscribers: make(map[chan eventMessage]struct{})}
}

func (h *EventHub) Subscribe() chan eventMessage {
	ch := make(chan eventMessage, 32)
	h.mu.Lock()
	h.subscribers[ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

func (h *EventHub) Unsubscribe(ch chan eventMessage) {
	h.mu.Lock()
	if _, ok := h.subscribers[ch]; ok {
		delete(h.subscribers, ch)
		close(ch)
	}
	h.mu.Unlock()
}

func (h *EventHub) Emit(name string, data any) {
	msg := eventMessage{Name: name, Data: data}
	// Use the write lock so the drop-oldest-then-send sequence below is atomic
	// across concurrent Emit calls, and so delivery never races Unsubscribe
	// closing a channel.
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.subscribers {
		select {
		case ch <- msg:
		default:
			// Subscriber is slow and its buffer is full — drop the oldest
			// queued message to make room for the newest, so the client keeps
			// receiving current updates instead of stalling on stale ones.
			select {
			case <-ch:
			default:
			}
			select {
			case ch <- msg:
			default:
			}
		}
	}
}

func (h *EventHub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ch := h.Subscribe()
	defer h.Unsubscribe(ch)

	_, _ = fmt.Fprint(w, ": connected\n\n")
	flusher.Flush()

	keepAlive := time.NewTicker(25 * time.Second)
	defer keepAlive.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-keepAlive.C:
			_, _ = fmt.Fprint(w, ": ping\n\n")
			flusher.Flush()
		case msg, ok := <-ch:
			if !ok {
				return
			}
			payload, err := json.Marshal(msg.Data)
			if err != nil {
				payload = []byte("null")
			}
			_, _ = fmt.Fprintf(w, "event: %s\n", msg.Name)
			_, _ = fmt.Fprintf(w, "data: %s\n\n", payload)
			flusher.Flush()
		}
	}
}
