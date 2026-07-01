package httpapi

import (
	"sync"
	"testing"
)

// TestEventHubConcurrentEmit exercises Emit against concurrent
// subscribe/unsubscribe/drain to catch races (run with -race) and to ensure a
// full subscriber buffer never deadlocks Emit.
func TestEventHubConcurrentEmit(t *testing.T) {
	hub := NewEventHub()

	var wg sync.WaitGroup

	// Emitters.
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 1000; j++ {
				hub.Emit("app:log", "message")
			}
		}()
	}

	// Subscribers that come and go, some draining slowly.
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 200; j++ {
				ch := hub.Subscribe()
				// Drain a few, then leave the rest to fill the buffer.
				for k := 0; k < 3; k++ {
					select {
					case <-ch:
					default:
					}
				}
				hub.Unsubscribe(ch)
			}
		}()
	}

	wg.Wait()
}
