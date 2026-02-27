package config

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"

	"golang.org/x/crypto/pbkdf2"
)

const (
	vaultFileName  = ".vault"
	pbkdf2Iter     = 100_000
	saltSize       = 32
	nonceSize      = 12 // AES-GCM standard nonce size
	derivedKeySize = 32 // AES-256
)

// SecureVault provides encrypted storage for sensitive environment variables.
// Values are encrypted both on disk (AES-256-GCM with machine-bound key)
// and in memory (XOR with random session key).
type SecureVault struct {
	mu         sync.RWMutex
	dataDir    string
	sessionKey []byte            // random key generated per app session for memory encryption
	store      map[string][]byte // key -> XOR-encrypted value in memory
}

// NewSecureVault creates a new vault and loads existing secrets from disk.
func NewSecureVault(dataDir string) (*SecureVault, error) {
	sessionKey := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, sessionKey); err != nil {
		return nil, fmt.Errorf("generate session key: %w", err)
	}

	v := &SecureVault{
		dataDir:    dataDir,
		sessionKey: sessionKey,
		store:      make(map[string][]byte),
	}

	if err := v.loadFromDisk(); err != nil {
		return nil, err
	}

	return v, nil
}

// Get returns all decrypted environment variables.
// Values are decrypted from memory only at call time.
func (v *SecureVault) Get() map[string]string {
	v.mu.RLock()
	defer v.mu.RUnlock()

	result := make(map[string]string, len(v.store))
	for k, encrypted := range v.store {
		result[k] = string(v.xorWithSessionKey(encrypted))
	}
	return result
}

// GetKeys returns only the key names (no values) for safe display.
func (v *SecureVault) GetKeys() []string {
	v.mu.RLock()
	defer v.mu.RUnlock()

	keys := make([]string, 0, len(v.store))
	for k := range v.store {
		keys = append(keys, k)
	}
	return keys
}

// Set replaces all environment variables and persists to encrypted disk storage.
func (v *SecureVault) Set(vars map[string]string) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	// Clear old store
	v.store = make(map[string][]byte, len(vars))

	// Encrypt each value with session key for memory storage
	for k, val := range vars {
		v.store[k] = v.xorWithSessionKey([]byte(val))
	}

	return v.saveToDisk(vars)
}

// xorWithSessionKey XORs data with the session key (repeating key as needed).
func (v *SecureVault) xorWithSessionKey(data []byte) []byte {
	result := make([]byte, len(data))
	for i, b := range data {
		result[i] = b ^ v.sessionKey[i%len(v.sessionKey)]
	}
	return result
}

// machineKey derives a deterministic encryption key bound to this machine.
func (v *SecureVault) machineKey(salt []byte) []byte {
	hostname, _ := os.Hostname()
	homeDir, _ := os.UserHomeDir()

	// Combine machine-specific identifiers
	fingerprint := fmt.Sprintf("%s:%s:%s", hostname, homeDir, v.dataDir)
	seed := sha256.Sum256([]byte(fingerprint))

	return pbkdf2.Key(seed[:], salt, pbkdf2Iter, derivedKeySize, sha256.New)
}

// vaultFile is the on-disk format: salt + nonce + ciphertext.
type vaultFile struct {
	Salt       []byte `json:"s"`
	Nonce      []byte `json:"n"`
	Ciphertext []byte `json:"c"`
}

// saveToDisk encrypts vars with AES-256-GCM and writes to .vault file.
func (v *SecureVault) saveToDisk(vars map[string]string) error {
	if err := os.MkdirAll(v.dataDir, 0755); err != nil {
		return fmt.Errorf("create data dir: %w", err)
	}

	// Generate random salt
	salt := make([]byte, saltSize)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return fmt.Errorf("generate salt: %w", err)
	}

	// Derive encryption key from machine fingerprint + salt
	key := v.machineKey(salt)

	// Serialize plaintext
	plaintext, err := json.Marshal(vars)
	if err != nil {
		return fmt.Errorf("marshal vars: %w", err)
	}

	// Encrypt with AES-256-GCM
	block, err := aes.NewCipher(key)
	if err != nil {
		return fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return fmt.Errorf("generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)

	// Wipe plaintext from memory
	for i := range plaintext {
		plaintext[i] = 0
	}

	// Write vault file
	vf := vaultFile{Salt: salt, Nonce: nonce, Ciphertext: ciphertext}
	data, err := json.Marshal(vf)
	if err != nil {
		return fmt.Errorf("marshal vault: %w", err)
	}

	vaultPath := filepath.Join(v.dataDir, vaultFileName)
	return os.WriteFile(vaultPath, data, 0600)
}

// loadFromDisk reads and decrypts the .vault file into memory.
func (v *SecureVault) loadFromDisk() error {
	vaultPath := filepath.Join(v.dataDir, vaultFileName)

	data, err := os.ReadFile(vaultPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // no vault yet, start empty
		}
		return fmt.Errorf("read vault: %w", err)
	}

	var vf vaultFile
	if err := json.Unmarshal(data, &vf); err != nil {
		return fmt.Errorf("parse vault: %w", err)
	}

	// Derive key from stored salt
	key := v.machineKey(vf.Salt)

	// Decrypt
	block, err := aes.NewCipher(key)
	if err != nil {
		return fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("create GCM: %w", err)
	}

	plaintext, err := gcm.Open(nil, vf.Nonce, vf.Ciphertext, nil)
	if err != nil {
		return fmt.Errorf("decrypt vault: %w", err)
	}

	var vars map[string]string
	if err := json.Unmarshal(plaintext, &vars); err != nil {
		// Wipe plaintext before returning error
		for i := range plaintext {
			plaintext[i] = 0
		}
		return fmt.Errorf("parse decrypted data: %w", err)
	}

	// Wipe plaintext from memory
	for i := range plaintext {
		plaintext[i] = 0
	}

	// Store XOR-encrypted in memory
	for k, val := range vars {
		v.store[k] = v.xorWithSessionKey([]byte(val))
	}

	return nil
}
