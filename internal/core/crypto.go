package core

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// encPrefix marks a value as encrypted so legacy plaintext can be detected and
// migrated transparently on the next save.
const encPrefix = "enc:v1:"

var (
	encKeyOnce sync.Once
	encKey     []byte
	encKeyErr  error
)

// secretKey lazily loads (or creates) the 32-byte AES key used to encrypt
// secrets at rest. The key lives in a 0600 sidecar file next to the database so
// copying settings.db alone does not leak the API key.
func secretKey() ([]byte, error) {
	encKeyOnce.Do(func() {
		dir, err := os.UserConfigDir()
		if err != nil {
			encKeyErr = err
			return
		}
		appDir := filepath.Join(dir, "mimo-tts-client")
		if err := os.MkdirAll(appDir, 0700); err != nil {
			encKeyErr = err
			return
		}
		keyPath := filepath.Join(appDir, "secret.key")
		if data, err := os.ReadFile(keyPath); err == nil && len(data) == 32 {
			encKey = data
			return
		}
		key := make([]byte, 32)
		if _, err := io.ReadFull(rand.Reader, key); err != nil {
			encKeyErr = err
			return
		}
		if err := os.WriteFile(keyPath, key, 0600); err != nil {
			encKeyErr = err
			return
		}
		encKey = key
	})
	return encKey, encKeyErr
}

// encryptSecret encrypts plaintext with AES-256-GCM and returns a prefixed,
// base64-encoded string. Empty input yields empty output.
func encryptSecret(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	key, err := secretKey()
	if err != nil {
		return "", err
	}
	gcm, err := newGCM(key)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return encPrefix + base64.StdEncoding.EncodeToString(ciphertext), nil
}

// decryptSecret reverses encryptSecret. Values without the prefix are treated
// as legacy plaintext and returned unchanged.
func decryptSecret(stored string) (string, error) {
	if !strings.HasPrefix(stored, encPrefix) {
		return stored, nil
	}
	key, err := secretKey()
	if err != nil {
		return "", err
	}
	gcm, err := newGCM(key)
	if err != nil {
		return "", err
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(stored, encPrefix))
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", fmt.Errorf("ciphertext too short")
	}
	nonce, ciphertext := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

func newGCM(key []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
