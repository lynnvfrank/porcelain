// Command bootstrap writes internal/operatorcopy/messages.yaml from embedded catalog data.
// Run once when adding UI-handled slugs: go run ./internal/operatorcopy/cmd/bootstrap
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/lynn/porcelain/internal/operatorcopy"
	"gopkg.in/yaml.v3"
)

func main() {
	root, err := findRepoRoot()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	reg := operatorcopy.BootstrapRegistry()
	if err := reg.Validate(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	out := filepath.Join(root, "internal", "operatorcopy", "messages.yaml")
	f, err := os.Create(out)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer f.Close()
	enc := yaml.NewEncoder(f)
	enc.SetIndent(2)
	if err := enc.Encode(reg); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("wrote %s (%d messages)\n", out, len(reg.Messages))
}

func findRepoRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("bootstrap: go.mod not found")
		}
		dir = parent
	}
}
