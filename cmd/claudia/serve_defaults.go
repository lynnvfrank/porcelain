package main

import (
	"os"
	"path/filepath"
	"runtime"
)

func defaultSupervisorIndexerBin() string {
	dir := executableDir()
	names := []string{"claudia-index"}
	if runtime.GOOS == "windows" {
		names = []string{"claudia-index.exe", "claudia-index"}
	}
	if p := firstExistingInSearchDirs(dir, names); p != "" {
		return p
	}
	if dir == "" {
		if runtime.GOOS == "windows" {
			return "claudia-index.exe"
		}
		return "claudia-index"
	}
	if runtime.GOOS == "windows" {
		return "claudia-index.exe"
	}
	return "claudia-index"
}

func defaultSupervisorBifrostBin() string {
	dir := executableDir()
	names := []string{"bifrost-http", "bifrost"}
	if runtime.GOOS == "windows" {
		names = []string{"bifrost-http.exe", "bifrost.exe", "bifrost-http", "bifrost"}
	}
	if p := firstExistingInSearchDirs(dir, names); p != "" {
		return p
	}
	return "bifrost"
}

func defaultSupervisorQdrantBin() string {
	dir := executableDir()
	names := []string{"qdrant"}
	if runtime.GOOS == "windows" {
		names = []string{"qdrant.exe", "qdrant"}
	}
	return firstExistingInSearchDirs(dir, names)
}

func executableDir() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	return filepath.Dir(exe)
}

func firstExistingFile(dir string, names []string) string {
	for _, n := range names {
		p := filepath.Join(dir, n)
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p
		}
	}
	return ""
}

// firstExistingInSearchDirs checks the executable directory, then <exeDir>/bin,
// matching how `make install` / `make desktop-run` lay out ./bin/bifrost-http and ./bin/qdrant
// next to claudia-desktop at the repo root (Explorer launch uses no CLI flags).
func firstExistingInSearchDirs(exeDir string, names []string) string {
	for _, d := range supervisorBinSearchDirs(exeDir) {
		if p := firstExistingFile(d, names); p != "" {
			return p
		}
	}
	return ""
}

func supervisorBinSearchDirs(exeDir string) []string {
	if exeDir == "" {
		return nil
	}
	return []string{exeDir, filepath.Join(exeDir, "bin")}
}

// defaultSupervisorDataSubdir chooses a stable default data path for supervised
// services even when launched from inside a bin/ folder via double-click.
//
// Priority:
// 1) If executable has sibling ../config/gateway.yaml (bundle layout), use ../data/<subdir>.
// 2) Otherwise fall back to data/<subdir> relative to current working directory.
func defaultSupervisorDataSubdir(subdir string) string {
	subdir = filepath.Clean(subdir)
	exeDir := executableDir()
	if exeDir != "" {
		cfgNearExe := filepath.Join(exeDir, "..", "config", "gateway.yaml")
		if st, err := os.Stat(cfgNearExe); err == nil && !st.IsDir() {
			return filepath.Join(exeDir, "..", "data", subdir)
		}
	}
	return filepath.Join("data", subdir)
}
