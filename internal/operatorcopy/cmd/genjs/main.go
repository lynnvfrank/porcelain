// Command genjs writes adminui/embed/embedui/settings/operator_copy.js from internal/operatorcopy/messages.yaml.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/lynn/porcelain/internal/operatorcopy"
	"github.com/lynn/porcelain/internal/operatorcopy/genoperatorcopy"
)

func main() {
	out := flag.String("out", "", "output path (default: repo "+genoperatorcopy.DefaultOperatorCopyJSPath+")")
	flag.Parse()

	root, err := findRepoRoot()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	data, err := os.ReadFile(filepath.Join(root, "internal", "operatorcopy", "messages.yaml"))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	reg, err := operatorcopy.ParseRegistry(data)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	target := *out
	if target == "" {
		target = filepath.Join(root, filepath.FromSlash(genoperatorcopy.DefaultOperatorCopyJSPath))
	} else if !filepath.IsAbs(target) {
		target = filepath.Join(root, target)
	}

	f, err := os.Create(target)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer f.Close()

	if err := genoperatorcopy.WriteOperatorCopyJS(f, reg); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("genjs: wrote %s\n", target)
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
			return "", fmt.Errorf("genjs: go.mod not found")
		}
		dir = parent
	}
}
