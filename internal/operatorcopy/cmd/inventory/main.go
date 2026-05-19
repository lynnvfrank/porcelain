// Command inventory compares UI operator slugs and Go emitters against messages.yaml.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/lynn/porcelain/internal/operatorcopy"
)

var (
	reCase = regexp.MustCompile(`case\s+"([^"]+)"`)
	reMsg  = regexp.MustCompile(`msg\s*===\s+"([^"]+)"`)
	reML   = regexp.MustCompile(`ml\s*===\s+"([^"]+)"`)
	reGo   = regexp.MustCompile(`"msg"\s*,\s*"([^"]+)"`)
)

func main() {
	writeReport := flag.Bool("write-report", false, "write internal/operatorcopy/inventory-report.txt")
	flag.Parse()

	root, err := findRepoRoot()
	if err != nil {
		fatal(err)
	}
	regPath := filepath.Join(root, "internal", "operatorcopy", "messages.yaml")
	data, err := os.ReadFile(regPath)
	if err != nil {
		fatal(err)
	}
	reg, err := operatorcopy.ParseRegistry(data)
	if err != nil {
		fatal(err)
	}
	regKeys := registryKeySet(reg)

	// Operator-copy switches only (Phases 2–4); card/metrics modules use additional slugs later.
	uiFiles := []string{
		filepath.Join(root, "chimera/chimera-gateway/internal/server/adminui/embed/embedui/logs_app.js"),
		filepath.Join(root, "chimera/chimera-gateway/internal/server/adminui/embed/embedui/logs/derive/chimeraBrokerMetrics.js"),
		filepath.Join(root, "chimera/chimera-gateway/internal/server/adminui/embed/embedui/logs/derive/vectorstoreCollection.js"),
		filepath.Join(root, "chimera/chimera-gateway/internal/server/adminui/embed/embedui/logs/derive/indexerPresent.js"),
	}
	ui := map[string]struct{}{}
	for _, f := range uiFiles {
		slugs, err := slugsFromJS(f)
		if err != nil {
			fatal(err)
		}
		for s := range slugs {
			ui[s] = struct{}{}
		}
	}
	goSlugs, err := slugsFromGo(filepath.Join(root, "chimera"), filepath.Join(root, "internal"), filepath.Join(root, "locus"))
	if err != nil {
		fatal(err)
	}

	var missingUI, missingGo []string
	for s := range ui {
		if !regKeys[s] {
			missingUI = append(missingUI, s)
		}
	}
	for s := range goSlugs {
		if !regKeys[s] {
			missingGo = append(missingGo, s)
		}
	}
	sortStrings(missingUI)
	sortStrings(missingGo)

	uiCov := pct(len(ui)-len(missingUI), len(ui))
	goIn := 0
	for s := range goSlugs {
		if regKeys[s] {
			goIn++
		}
	}
	goCov := pct(goIn, len(goSlugs))

	var b strings.Builder
	fmt.Fprintf(&b, "# operatorcopy inventory report\n")
	fmt.Fprintf(&b, "ui_operator_slugs: %d\n", len(ui))
	fmt.Fprintf(&b, "ui_coverage_pct: %.1f\n", uiCov)
	fmt.Fprintf(&b, "go_emitter_slugs: %d\n", len(goSlugs))
	fmt.Fprintf(&b, "go_coverage_pct: %.1f\n", goCov)
	fmt.Fprintf(&b, "registry_keys: %d\n", len(regKeys))
	fmt.Fprintf(&b, "missing_ui_in_registry: %d\n\n", len(missingUI))
	if len(missingUI) > 0 {
		b.WriteString("## Missing UI slugs\n")
		for _, s := range missingUI {
			b.WriteString(s)
			b.WriteByte('\n')
		}
		b.WriteByte('\n')
	}
	if len(missingGo) > 0 {
		b.WriteString("## Missing Go slugs (Phase 5)\n")
		for _, s := range missingGo {
			b.WriteString(s)
			b.WriteByte('\n')
		}
	}
	text := b.String()
	fmt.Print(text)

	if *writeReport {
		out := filepath.Join(root, "internal", "operatorcopy", "inventory-report.txt")
		if err := os.WriteFile(out, []byte(text), 0o644); err != nil {
			fatal(err)
		}
		fmt.Fprintf(os.Stderr, "Wrote %s\n", out)
	}

	if len(missingUI) > 0 || uiCov < 90 {
		fmt.Fprintf(os.Stderr, "operatorcopy-inventory: FAIL (ui coverage %.1f%%)\n", uiCov)
		os.Exit(1)
	}
	fmt.Fprintln(os.Stderr, "operatorcopy-inventory: OK")
}

func registryKeySet(reg *operatorcopy.Registry) map[string]bool {
	keys := make(map[string]bool)
	for _, m := range reg.Messages {
		keys[m.Slug] = true
		for _, a := range m.Aliases {
			keys[a] = true
		}
	}
	return keys
}

func slugsFromJS(path string) (map[string]struct{}, error) {
	out := map[string]struct{}{}
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return out, nil
		}
		return nil, err
	}
	content := string(b)
	for _, re := range []*regexp.Regexp{reCase, reMsg, reML} {
		for _, m := range re.FindAllStringSubmatch(content, -1) {
			v := m[1]
			if strings.Contains(v, ".") || strings.Contains(v, " ") {
				out[v] = struct{}{}
			}
		}
	}
	return out, nil
}

func slugsFromGo(roots ...string) (map[string]struct{}, error) {
	out := map[string]struct{}{}
	for _, root := range roots {
		if _, err := os.Stat(root); err != nil {
			continue
		}
		err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() || !strings.HasSuffix(path, ".go") {
				return nil
			}
			b, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			for _, m := range reGo.FindAllStringSubmatch(string(b), -1) {
				out[m[1]] = struct{}{}
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	return out, nil
}

func pct(hit, total int) float64 {
	if total == 0 {
		return 100
	}
	return 100 * float64(hit) / float64(total)
}

func sortStrings(s []string) {
	for i := 0; i < len(s); i++ {
		for j := i + 1; j < len(s); j++ {
			if s[j] < s[i] {
				s[i], s[j] = s[j], s[i]
			}
		}
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
			return "", fmt.Errorf("go.mod not found")
		}
		dir = parent
	}
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
