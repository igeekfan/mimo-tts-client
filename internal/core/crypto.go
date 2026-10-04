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

// encPrefix identifies the supported encrypted secret format.
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
		if data, err := os.ReadFile(keyPath); err == nil {
			if len(data) != 32 {
				encKeyErr = fmt.Errorf("secret key has invalid length %d", len(data))
				return
			}
			encKey = data
			return
		} else if !os.IsNotExist(err) {
			// Never replace a key that exists but cannot be read. Doing so would
			// make all previously encrypted settings permanently undecryptable.
			encKeyErr = fmt.Errorf("read secret key: %w", err)
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

// decryptSecret accepts only the current encrypted format or an empty value.
func decryptSecret(stored string) (string, error) {
	if stored == "" {
		return "", nil
	}
	if !strings.HasPrefix(stored, encPrefix) {
		return "", fmt.Errorf("unsupported secret format")
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
