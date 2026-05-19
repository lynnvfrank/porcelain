// Command gencontracts writes operator logs contracts.js from internal/naming.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/lynn/porcelain/internal/naming/gencontracts"
)

func main() {
	out := flag.String("out", "", "output path (default: repo-relative "+gencontracts.DefaultContractsJSPath+")")
	flag.Parse()

	root, err := findRepoRoot()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	target := *out
	if target == "" {
		target = filepath.Join(root, filepath.FromSlash(gencontracts.DefaultContractsJSPath))
	} else if !filepath.IsAbs(target) {
		target = filepath.Join(root, target)
	}

	f, err := os.Create(target)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer f.Close()

	if err := gencontracts.WriteContractsJS(f); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
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
			return "", fmt.Errorf("gencontracts: go.mod not found (started at %s)", dir)
		}
		dir = parent
	}
}
