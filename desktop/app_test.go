package desktop

import (
	"context"
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
	app.CancelStream("request-1")
	select {
	case <-replacementCtx.Done():
	case <-time.After(time.Second):
		t.Fatal("CancelStream compatibility alias did not cancel the request")
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
