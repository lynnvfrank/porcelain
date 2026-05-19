package operatorcopy

import (
	"fmt"

	"gopkg.in/yaml.v3"
)

// ParseRegistry decodes and validates YAML registry bytes.
func ParseRegistry(data []byte) (*Registry, error) {
	var r Registry
	if err := yaml.Unmarshal(data, &r); err != nil {
		return nil, fmt.Errorf("operatorcopy: decode: %w", err)
	}
	if err := r.Validate(); err != nil {
		return nil, err
	}
	return &r, nil
}

// MustLoadEmbedded parses the embedded messages.yaml and panics on error (tests/init only).
func MustLoadEmbedded() *Registry {
	r, err := LoadEmbedded()
	if err != nil {
		panic(err)
	}
	return r
}

// LoadEmbedded parses messages.yaml from the embed FS.
func LoadEmbedded() (*Registry, error) {
	data, err := registryFS.ReadFile("messages.yaml")
	if err != nil {
		return nil, fmt.Errorf("operatorcopy: read embedded messages.yaml: %w", err)
	}
	return ParseRegistry(data)
}
