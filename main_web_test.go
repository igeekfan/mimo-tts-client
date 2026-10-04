//go:build web

package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDefaultWebAddressIsLoopback(t *testing.T) {
	if defaultWebAddr != "127.0.0.1:8080" {
		t.Fatalf("defaultWebAddr = %q", defaultWebAddr)
	}
	if err := validateWebSecurity(defaultWebAddr, ""); err != nil {
		t.Fatalf("default address should be safe without a token: %v", err)
	}
}

func TestValidateWebSecurity(t *testing.T) {
	tests := []struct {
		name    string
		addr    string
		token   string
		wantErr bool
	}{
		{name: "IPv4 loopback", addr: "127.0.0.1:8080"},
		{name: "IPv6 loopback", addr: "[::1]:8080"},
		{name: "localhost", addr: "localhost:8080"},
		{name: "wildcard requires token", addr: ":8080", wantErr: true},
		{name: "IPv4 wildcard requires token", addr: "0.0.0.0:8080", token: "short", wantErr: true},
		{name: "IPv6 wildcard requires token", addr: "[::]:8080", wantErr: true},
		{name: "public host requires token", addr: "example.com:8080", wantErr: true},
		{name: "public host rejects short token", addr: "example.com:8080", token: "short", wantErr: true},
		{name: "remote with strong token", addr: "0.0.0.0:8080", token: "0123456789abcdef"},
		{name: "bounded whitespace rejected", addr: "0.0.0.0:8080", token: " 0123456789abcdef ", wantErr: true},
		{name: "loopback token whitespace rejected", addr: "127.0.0.1:8080", token: " secret ", wantErr: true},
		{name: "malformed address", addr: "127.0.0.1", wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateWebSecurity(test.addr, test.token)
			if (err != nil) != test.wantErr {
				t.Fatalf("validateWebSecurity() error = %v, wantErr %v", err, test.wantErr)
			}
		})
	}
}

func TestWebHandlerRoutesHealthToAPI(t *testing.T) {
	called := false
	handler := webHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		if r.URL.Path != "/healthz" {
			t.Errorf("path = %q", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
	}))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if !called || recorder.Code != http.StatusOK {
		t.Fatalf("health route did not reach API handler: called=%v status=%d", called, recorder.Code)
	}
}

func TestWebHandlerRoutesAPIRootToAPI(t *testing.T) {
	called := false
	handler := webHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		if r.URL.Path != "/api" {
			t.Errorf("path = %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
	}))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api", nil))
	if !called || recorder.Code != http.StatusNotFound {
		t.Fatalf("API root did not reach API handler: called=%v status=%d", called, recorder.Code)
	}
}
