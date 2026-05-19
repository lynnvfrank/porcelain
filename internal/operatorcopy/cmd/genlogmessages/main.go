// Command genlogmessages writes internal/naming/log_messages.go from operatorcopy/messages.yaml.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/lynn/porcelain/internal/operatorcopy"
	"github.com/lynn/porcelain/internal/operatorcopy/genlogmessages"
)

func main() {
	out := flag.String("out", "", "output path (default: repo "+genlogmessages.DefaultLogMessagesGoPath+")")
	flag.Parse()

	root, err := findRepoRoot()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	reg, err := operatorcopy.LoadEmbedded()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	target := *out
	if target == "" {
		target = filepath.Join(root, filepath.FromSlash(genlogmessages.DefaultLogMessagesGoPath))
	} else if !filepath.IsAbs(target) {
		target = filepath.Join(root, target)
	}

	f, err := os.Create(target)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer f.Close()

	if err := genlogmessages.WriteLogMessagesGo(f, reg); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("genlogmessages: wrote %s (%d slugs)\n", target, len(reg.Messages))
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
			return "", fmt.Errorf("genlogmessages: go.mod not found")
		}
		dir = parent
	}
}
