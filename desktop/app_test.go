package desktop

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRequestRegistrationRejectsDuplicatesAndCancels(t *testing.T) {
	app := NewApp("test")
	ctx, cancel := context.WithCancel(context.Background())
	if err := app.registerRequest("request-1", cancel); err != nil {
		t.Fatalf("registerRequest: %v", err)
	}
	_, duplicateCancel := context.WithCancel(context.Background())
	defer duplicateCancel()
	if err := app.registerRequest("request-1", duplicateCancel); err == nil {
		t.Fatal("duplicate request ID unexpectedly registered")
	}

	app.CancelSynthesis("request-1")
	select {
	case <-ctx.Done():
	case <-time.After(time.Second):
		t.Fatal("CancelSynthesis did not cancel the registered context")
	}

	app.unregisterRequest("request-1")
	replacementCtx, replacementCancel := context.WithCancel(context.Background())
	if err := app.registerRequest("request-1", replacementCancel); err != nil {
		t.Fatalf("completed request ID could not be reused: %v", err)
	}
	app.CancelSynthesis("request-1")
	select {
	case <-replacementCtx.Done():
	case <-time.After(time.Second):
		t.Fatal("CancelSynthesis did not cancel the reused request ID")
	}
	app.unregisterRequest("request-1")
}

func TestRequestRegistrationRejectsEmptyID(t *testing.T) {
	app := NewApp("test")
	_, cancel := context.WithCancel(context.Background())
	defer cancel()
	for _, id := range []string{"", "bad:id", "contains space", string(make([]byte, 129))} {
		if err := app.registerRequest(id, cancel); err == nil {
			t.Fatalf("invalid request ID %q unexpectedly registered", id)
		}
	}
}

func TestShutdownCancelsAllRequests(t *testing.T) {
	app := NewApp("test")
	ctx, cancel := context.WithCancel(context.Background())
	if err := app.registerRequest("request-1", cancel); err != nil {
		t.Fatal(err)
	}
	app.shutdown(context.Background())
	select {
	case <-ctx.Done():
	case <-time.After(time.Second):
		t.Fatal("shutdown did not cancel in-flight synthesis")
	}
}

func TestCancelSynthesisCancelsUpstreamRequest(t *testing.T) {
	t.Setenv("TTS_API_KEY", "test-api-key")
	started := make(chan struct{})
	upstreamCanceled := make(chan struct{})
	releaseHandler := make(chan struct{})
	handlerDone := make(chan struct{})
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
		close(started)
		select {
		case <-releaseHandler:
		default:
			select {
			case <-r.Context().Done():
				close(upstreamCanceled)
			case <-releaseHandler:
			}
		}
		close(handlerDone)
	}))
	appCtx, cancelApp := context.WithCancel(context.Background())
	defer func() {
		cancelApp()
		close(releaseHandler)
		upstream.CloseClientConnections()
		select {
		case <-handlerDone:
		case <-time.After(time.Second):
		}
		upstream.Close()
	}()

	app := NewApp("test")
	app.ctx = appCtx
	if err := app.service.LockBaseURL(upstream.URL); err != nil {
		t.Fatalf("LockBaseURL: %v", err)
	}
	type synthesisResult struct {
		response TTSResponse
		err      error
	}
	result := make(chan synthesisResult, 1)
	go func() {
		response, err := app.SynthesizeSpeech(TTSRequest{
			RequestID: "cancel-me",
			Text:      "hello",
			Model:     "mimo-v2.5-tts",
			Voice:     "mimo_default",
		})
		result <- synthesisResult{response: response, err: err}
	}()

	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("upstream did not receive synthesis request")
	}
	app.CancelSynthesis("cancel-me")

	select {
	case resultValue := <-result:
		if resultValue.err != nil {
			t.Fatalf("SynthesizeSpeech returned binding error: %v", resultValue.err)
		}
		response := resultValue.response
		if response.Error == "" {
			t.Fatal("cancelled synthesis returned no error")
		}
	case <-time.After(time.Second):
		t.Fatal("CancelSynthesis did not finish the request")
	}
	select {
	case <-upstreamCanceled:
	case <-time.After(time.Second):
		t.Fatal("CancelSynthesis did not cancel the upstream request")
	}
}

func TestShutdownCancelsSynthesis(t *testing.T) {
	t.Setenv("TTS_API_KEY", "test-api-key")
	started := make(chan struct{})
	upstreamCanceled := make(chan struct{})
	releaseHandler := make(chan struct{})
	handlerDone := make(chan struct{})
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
		close(started)
		select {
		case <-releaseHandler:
		default:
			select {
			case <-r.Context().Done():
				close(upstreamCanceled)
			case <-releaseHandler:
			}
		}
		close(handlerDone)
	}))
	appCtx, cancelApp := context.WithCancel(context.Background())
	defer func() {
		cancelApp()
		close(releaseHandler)
		upstream.CloseClientConnections()
		select {
		case <-handlerDone:
		case <-time.After(time.Second):
		}
		upstream.Close()
	}()

	app := NewApp("test")
	app.ctx = appCtx
	if err := app.service.LockBaseURL(upstream.URL); err != nil {
		t.Fatalf("LockBaseURL: %v", err)
	}
	type synthesisResult struct {
		response TTSResponse
		err      error
	}
	result := make(chan synthesisResult, 1)
	go func() {
		response, err := app.SynthesizeSpeech(TTSRequest{
			RequestID: "shutdown-me",
			Text:      "hello",
			Model:     "mimo-v2.5-tts",
			Voice:     "mimo_default",
		})
		result <- synthesisResult{response: response, err: err}
	}()

	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("upstream did not receive synthesis request")
	}
	app.shutdown(context.Background())

	select {
	case resultValue := <-result:
		if resultValue.err != nil {
			t.Fatalf("SynthesizeSpeech returned binding error: %v", resultValue.err)
		}
		response := resultValue.response
		if response.Error == "" {
			t.Fatal("shutdown synthesis returned no error")
		}
	case <-time.After(time.Second):
		t.Fatal("shutdown did not finish the request")
	}
	select {
	case <-upstreamCanceled:
	case <-time.After(time.Second):
		t.Fatal("shutdown did not cancel the upstream request")
	}
}
