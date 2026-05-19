// Command validate checks internal/operatorcopy/messages.yaml (embedded copy when run via go generate).
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/lynn/porcelain/internal/operatorcopy"
)

func main() {
	root, err := findRepoRoot()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	path := filepath.Join(root, "internal", "operatorcopy", "messages.yaml")
	data, err := os.ReadFile(path)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	r, err := operatorcopy.ParseRegistry(data)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("operatorcopy: OK - %d messages, locale=%s\n", len(r.Messages), r.Locale)
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
			return "", fmt.Errorf("validate: go.mod not found")
		}
		dir = parent
	}
}
