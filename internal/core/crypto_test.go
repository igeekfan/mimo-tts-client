package core

import (
	"bytes"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

// isolateSecretKey makes key-file tests independent of a developer's real
// settings directory and resets the process-wide lazy key cache afterwards.
func isolateSecretKey(t *testing.T, configRoot string) string {
	t.Helper()
	t.Setenv("APPDATA", configRoot)
	t.Setenv("XDG_CONFIG_HOME", configRoot)
	t.Setenv("HOME", configRoot)
	encKeyOnce = sync.Once{}
	encKey = nil
	encKeyErr = nil
	t.Cleanup(func() {
		encKeyOnce = sync.Once{}
		encKey = nil
		encKeyErr = nil
	})
	return filepath.Join(configRoot, "mimo-tts-client", "secret.key")
}

func TestDecryptSecretRejectsUnsupportedFormats(t *testing.T) {
	for _, stored := range []string{"sk-plaintext", "enc:v0:payload", "enc:v2:payload"} {
		got, err := decryptSecret(stored)
		if err == nil || got != "" {
			t.Fatal("unsupported secret format was accepted")
		}
	}
	if got, err := decryptSecret(""); err != nil || got != "" {
		t.Fatal("empty secret must remain empty")
	}
}
func TestEncryptDecryptRoundTrip(t *testing.T) {
	const secret = "sk-super-secret-api-key"

	enc, err := encryptSecret(secret)
	if err != nil {
		t.Fatalf("encryptSecret: %v", err)
	}
	if enc == secret {
		t.Fatal("ciphertext must differ from plaintext")
	}

	dec, err := decryptSecret(enc)
	if err != nil {
		t.Fatalf("decryptSecret: %v", err)
	}
	if dec != secret {
		t.Fatalf("round trip mismatch: got %q want %q", dec, secret)
	}
}

func TestEncryptSecretEmpty(t *testing.T) {
	enc, err := encryptSecret("")
	if err != nil {
		t.Fatalf("encryptSecret: %v", err)
	}
	if enc != "" {
		t.Fatalf("empty input should yield empty output, got %q", enc)
	}
}

func TestSecretKeyRejectsCorruptFileWithoutReplacingIt(t *testing.T) {
	root := t.TempDir()
	keyPath := isolateSecretKey(t, root)
	if err := os.MkdirAll(filepath.Dir(keyPath), 0700); err != nil {
		t.Fatalf("create config dir: %v", err)
	}
	original := []byte("corrupt-key")
	if err := os.WriteFile(keyPath, original, 0600); err != nil {
		t.Fatalf("write corrupt key: %v", err)
	}
	if _, err := encryptSecret("sk-secret"); err == nil {
		t.Fatal("encryptSecret accepted a corrupt key file")
	}
	got, err := os.ReadFile(keyPath)
	if err != nil {
		t.Fatalf("read key after rejection: %v", err)
	}
	if !bytes.Equal(got, original) {
		t.Fatalf("corrupt key file was replaced: %q", got)
	}
}

func TestSecretKeyReadErrorDoesNotReplaceExistingPath(t *testing.T) {
	root := t.TempDir()
	keyPath := isolateSecretKey(t, root)
	if err := os.MkdirAll(filepath.Dir(keyPath), 0700); err != nil {
		t.Fatalf("create config dir: %v", err)
	}
	// A directory at the key path produces a read error on every supported
	// platform while allowing us to verify that the path is left untouched.
	if err := os.Mkdir(keyPath, 0700); err != nil {
		t.Fatalf("create unreadable key path: %v", err)
	}
	if _, err := encryptSecret("sk-secret"); err == nil {
		t.Fatal("encryptSecret accepted a key read error")
	}
	info, err := os.Stat(keyPath)
	if err != nil {
		t.Fatalf("stat key path after rejection: %v", err)
	}
	if !info.IsDir() {
		t.Fatal("key path was replaced after a read error")
	}
}
