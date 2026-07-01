package httpapi

import (
	"net/http/httptest"
	"testing"
)

func TestAuthorized(t *testing.T) {
	s := &Server{authToken: "secret"}

	cases := []struct {
		name   string
		method string
		target string
		bearer string
		want   bool
	}{
		{"config is public", "GET", "/api/config", "", true},
		{"missing token rejected", "GET", "/api/version", "", false},
		{"valid bearer accepted", "GET", "/api/version", "secret", true},
		{"wrong bearer rejected", "GET", "/api/version", "wrong", false},
		{"query token accepted", "GET", "/api/events?token=secret", "", true},
		{"wrong query token rejected", "GET", "/api/events?token=nope", "", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(tc.method, tc.target, nil)
			if tc.bearer != "" {
				r.Header.Set("Authorization", "Bearer "+tc.bearer)
			}
			if got := s.authorized(r); got != tc.want {
				t.Fatalf("authorized(%s)=%v want %v", tc.target, got, tc.want)
			}
		})
	}

	// With no token configured, everything is allowed.
	open := &Server{authToken: ""}
	if !open.authorized(httptest.NewRequest("GET", "/api/version", nil)) {
		t.Fatal("server without a token should allow all requests")
	}
}
