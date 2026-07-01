package core

import "testing"

func TestDecryptSecretPassesThroughLegacyPlaintext(t *testing.T) {
	// Values without the encryption prefix are legacy plaintext and must be
	// returned unchanged (no key access required).
	got, err := decryptSecret("sk-legacy-plaintext")
	if err != nil {
		t.Fatalf("decryptSecret: %v", err)
	}
	if got != "sk-legacy-plaintext" {
		t.Fatalf("expected passthrough, got %q", got)
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
