//go:build windows
// +build windows

package main

import (
	"context"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

var (
	kernel32        = syscall.NewLazyDLL("kernel32.dll")
	user32          = syscall.NewLazyDLL("user32.dll")
	getConsole      = kernel32.NewProc("GetConsoleWindow")
	showWindow      = user32.NewProc("ShowWindow")
	enumWindows     = user32.NewProc("EnumWindows")
	getWindowTextW  = user32.NewProc("GetWindowTextW")
	isWindowVisible = user32.NewProc("IsWindowVisible")
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
	// Get repo root by looking for locus_api.py
	exePath, err := os.Executable()
	if err != nil {
		exePath, _ = os.Getwd()
	}

	// Start from exe directory and go up until we find the repo
	repoRoot := filepath.Dir(filepath.Dir(filepath.Dir(exePath)))

	// Verify we found the right directory by checking for locus_api.py
	for i := 0; i < 5; i++ {
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

	// Wait for interrupt or PWA window close
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go monitorPWAWindow(sigChan)

	<-sigChan

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

	// Start Moto X Receiver (Python, port 9001) - optional if file exists
	receiverPath := filepath.Join(repoRoot, "Moto X", "receiver.py")
	if _, err := os.Stat(receiverPath); err == nil {
		receiverLogPath := filepath.Join(repoRoot, ".data", "logs", "receiver.log")
		receiverLog, _ := os.OpenFile(receiverLogPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
		receiverCmd := exec.Command("python", "Moto X/receiver.py")
		receiverCmd.Dir = repoRoot
		receiverCmd.Stdout = receiverLog
		receiverCmd.Stderr = receiverLog
		receiverCmd.SysProcAttr = &syscall.SysProcAttr{
			CreationFlags: 0x08000000,
		}
		receiverCmd.Start()
		services = append(services, Service{"receiver", receiverCmd})
		defer receiverLog.Close()
	}

	// Start llama-server chat (port 8081) — local inference, GPU accelerated
	chatModelPath := filepath.Join(repoRoot, "models", "chat.gguf")
	if _, err := os.Stat(chatModelPath); err == nil {
		llamaChatLogPath := filepath.Join(repoRoot, ".data", "logs", "llama-chat.log")
		llamaChatLog, _ := os.OpenFile(llamaChatLogPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
		llamaChatCmd := exec.Command("chimera/bin/llama-server.exe",
			"-m", chatModelPath,
			"--port", "8081",
			"--host", "127.0.0.1",
			"-ngl", "99",
			"--alias", "chat",
			"--ctx-size", "8192",
		)
		llamaChatCmd.Dir = repoRoot
		llamaChatCmd.Stdout = llamaChatLog
		llamaChatCmd.Stderr = llamaChatLog
		llamaChatCmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000}
		llamaChatCmd.Start()
		services = append(services, Service{"llama-chat", llamaChatCmd})
		defer llamaChatLog.Close()
	}

	// Start llama-server embed (port 8082) — local embeddings for RAG
	embedModelPath := filepath.Join(repoRoot, "models", "nomic-embed-text-v1.5.Q8_0.gguf")
	if _, err := os.Stat(embedModelPath); err == nil {
		llamaEmbedLogPath := filepath.Join(repoRoot, ".data", "logs", "llama-embed.log")
		llamaEmbedLog, _ := os.OpenFile(llamaEmbedLogPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
		llamaEmbedCmd := exec.Command("chimera/bin/llama-server.exe",
			"-m", embedModelPath,
			"--port", "8082",
			"--host", "127.0.0.1",
			"--embedding",
			"-ngl", "99",
			"--alias", "nomic-embed-text",
		)
		llamaEmbedCmd.Dir = repoRoot
		llamaEmbedCmd.Stdout = llamaEmbedLog
		llamaEmbedCmd.Stderr = llamaEmbedLog
		llamaEmbedCmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000}
		llamaEmbedCmd.Start()
		services = append(services, Service{"llama-embed", llamaEmbedCmd})
		defer llamaEmbedLog.Close()
	}

	// Start BiFrost (HTTP transport, port 8080) — Chimera upstream
	bifrostLogPath := filepath.Join(repoRoot, ".data", "logs", "bifrost.log")
	bifrostLog, _ := os.OpenFile(bifrostLogPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	bifrostAppDir := filepath.Join(repoRoot, "chimera", "data", "bifrost")
	bifrostCmd := exec.Command("chimera/bin/bifrost-http.exe", "-app-dir", bifrostAppDir)
	bifrostCmd.Dir = repoRoot
	bifrostCmd.Stdout = bifrostLog
	bifrostCmd.Stderr = bifrostLog
	bifrostCmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x08000000,
	}
	bifrostCmd.Start()
	services = append(services, Service{"bifrost", bifrostCmd})
	defer bifrostLog.Close()

	// Start Chimera (gateway mode — webview is opened separately via Edge PWA)
	chimeraLogPath := filepath.Join(repoRoot, ".data", "logs", "chimera.log")
	chimeraLog, _ := os.OpenFile(chimeraLogPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	configPath := filepath.Join(repoRoot, "chimera", "config", "gateway.yaml")
	chimeraCmd := exec.Command("chimera/bin/chimera.exe", "gateway", "-config", configPath)
	chimeraCmd.Dir = repoRoot
	chimeraCmd.Stdout = chimeraLog
	chimeraCmd.Stderr = chimeraLog
	chimeraCmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x08000000,
	}
	chimeraCmd.Start()
	services = append(services, Service{"chimera", chimeraCmd})
	defer chimeraLog.Close()

	// Open Locus and Chimera shell as Edge PWA windows
	go openPWAs()

	return services
}

func openPWAs() {
	edgePaths := []string{
		`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
		`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
	}
	edgeBin := ""
	for _, p := range edgePaths {
		if _, err := os.Stat(p); err == nil {
			edgeBin = p
			break
		}
	}

	// Kill any existing Porcelain Edge app window so we always get a fresh load
	exec.Command("powershell", "-Command",
		`Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*Porcelain*" } | Stop-Process -Force`,
	).Run()
	time.Sleep(500 * time.Millisecond)

	// Poll Locus until ready (up to 30s), then open as frameless PWA window
	locusURL := "http://127.0.0.1:11435/web"
	deadline := time.Now().Add(30 * time.Second)
	for time.Now().Before(deadline) {
		if resp, err := http.Get(locusURL); err == nil {
			resp.Body.Close()
			break
		}
		time.Sleep(500 * time.Millisecond)
	}

	if edgeBin != "" {
		cmd := exec.Command(edgeBin, "--app="+locusURL)
		cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000}
		if cmd.Start() == nil {
			return
		}
	}
	exec.Command("cmd", "/c", "start", locusURL).Start()
}

// monitorPWAWindow polls for the Locus Edge PWA window and triggers shutdown when it closes.
func monitorPWAWindow(sigChan chan<- os.Signal) {
	// Wait for the window to appear before we start watching for it to disappear
	time.Sleep(10 * time.Second)

	misses := 0
	for {
		time.Sleep(4 * time.Second)
		found := false

		cb := syscall.NewCallback(func(hwnd uintptr, _ uintptr) uintptr {
			vis, _, _ := isWindowVisible.Call(hwnd)
			if vis == 0 {
				return 1
			}
			buf := make([]uint16, 512)
			getWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
			title := strings.ToLower(syscall.UTF16ToString(buf))
			if strings.Contains(title, "11435") || strings.Contains(title, "locus") || strings.Contains(title, "porcelain") {
				found = true
				return 0
			}
			return 1
		})
		enumWindows.Call(cb, 0)

		if found {
			misses = 0
		} else {
			misses++
			if misses >= 2 {
				sigChan <- syscall.SIGTERM
				return
			}
		}
	}
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
