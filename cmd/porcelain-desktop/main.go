//go:build windows
// +build windows

package main

import (
	"context"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
)

var (
	kernel32   = syscall.NewLazyDLL("kernel32.dll")
	user32     = syscall.NewLazyDLL("user32.dll")
	getConsole = kernel32.NewProc("GetConsoleWindow")
	showWindow = user32.NewProc("ShowWindow")
)

func init() {
	hideConsole()
}

func hideConsole() {
	hwnd, _, _ := getConsole.Call()
	if hwnd != 0 {
		showWindow.Call(hwnd, 0) // SW_HIDE = 0
	}
}

type Service struct {
	Name string
	Cmd  *exec.Cmd
}

func main() {
	// Get repo root by looking for locus_api.py.
	exePath, err := os.Executable()
	if err != nil {
		exePath, _ = os.Getwd()
	}

	repoRoot := filepath.Dir(exePath)
	for i := 0; i < 6; i++ {
		if _, err := os.Stat(filepath.Join(repoRoot, "locus_api.py")); err == nil {
			break
		}
		repoRoot = filepath.Dir(repoRoot)
	}

	// Ensure .data/logs exists
	logsDir := filepath.Join(repoRoot, ".data", "logs")
	os.MkdirAll(logsDir, 0o755)

	// Start all services
	services := startAllServices(repoRoot)

	// Wait for interrupt (Ctrl+C, window close, or Chimera exit)
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	chimeraExitChan := make(chan error, 1)
	for _, svc := range services {
		if svc.Name == "chimera" {
			go func(cmd *exec.Cmd) {
				chimeraExitChan <- cmd.Wait()
			}(svc.Cmd)
			break
		}
	}

	select {
	case <-sigChan:
	case <-chimeraExitChan:
	}

	// Gracefully shutdown all
	shutdownTimeout := time.Second * 10
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	shutdownAllServices(ctx, services)
}

func startAllServices(repoRoot string) []Service {
	var services []Service

	// Start Relay (Python, port 9999)
	relayLogPath := filepath.Join(repoRoot, ".data", "logs", "relay.log")
	relayLog, _ := os.OpenFile(relayLogPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	relayCmd := exec.Command("python", "locus/relay_server.py")
	relayCmd.Dir = repoRoot
	relayCmd.Stdout = relayLog
	relayCmd.Stderr = relayLog
	relayCmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
	relayCmd.Start()
	services = append(services, Service{"relay", relayCmd})
	defer relayLog.Close()

	// Start Locus (Python, port 11435)
	locusLogPath := filepath.Join(repoRoot, ".data", "logs", "locus.log")
	locusLog, _ := os.OpenFile(locusLogPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	locusCmd := exec.Command("python", "locus_api.py")
	locusCmd.Dir = repoRoot
	locusCmd.Stdout = locusLog
	locusCmd.Stderr = locusLog
	locusCmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x08000000,
	}
	locusCmd.Start()
	services = append(services, Service{"locus", locusCmd})
	defer locusLog.Close()

	// Start Chimera (Go, port 3000) - with webview
	chimeraLogPath := filepath.Join(repoRoot, ".data", "logs", "chimera.log")
	chimeraLog, _ := os.OpenFile(chimeraLogPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	configPath := filepath.Join(repoRoot, "chimera", "config", "gateway.yaml")
	chimeraDir := filepath.Join(repoRoot, "chimera")
	chimeraCmd := exec.Command("bin/chimera.exe", "desktop", "-config", configPath)
	chimeraCmd.Dir = chimeraDir
	chimeraCmd.Stdout = chimeraLog
	chimeraCmd.Stderr = chimeraLog
	// Chimera desktop mode should open webview, not console
	chimeraCmd.Start()
	services = append(services, Service{"chimera", chimeraCmd})
	defer chimeraLog.Close()

	return services
}

func shutdownAllServices(ctx context.Context, services []Service) {
	for _, svc := range services {
		if svc.Cmd.Process != nil {
			svc.Cmd.Process.Signal(syscall.SIGTERM)
		}
	}

	// Wait up to timeout for graceful exit
	done := make(chan error, len(services))
	for _, svc := range services {
		go func(s Service) {
			done <- s.Cmd.Wait()
		}(svc)
	}

	// Collect results with timeout
	for i := 0; i < len(services); i++ {
		select {
		case <-done:
		case <-ctx.Done():
			// Timeout, force kill
			for _, svc := range services {
				if svc.Cmd.Process != nil {
					svc.Cmd.Process.Kill()
				}
			}
			return
		}
	}
}
