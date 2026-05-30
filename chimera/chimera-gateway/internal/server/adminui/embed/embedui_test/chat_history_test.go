package embedui_test

import (
	"strings"
	"testing"
)

func TestChatHTML_layoutIsMainOnly(t *testing.T) {
	html := mustReadFile(t, embeduiRoot(t)+"/chat.html")
	if !strings.Contains(html, `class="chat-main"`) {
		t.Fatal("chat.html missing chat-main")
	}
	if strings.Contains(html, `class="chat-history"`) {
		t.Fatal("chat.html should not include embedded chat-history sidebar")
	}
	if !strings.Contains(html, "historyClient.js") {
		t.Fatal("chat.html must load historyClient.js to open saved conversations")
	}
}

func TestChatApp_shellActiveOnlyWithTranscript(t *testing.T) {
	app := mustReadFile(t, embeduiRoot(t)+"/chat/app.js")
	if !strings.Contains(app, "state.messages.length > 0") {
		t.Fatal("chat app.js should only set-active when the viewport has transcript messages")
	}
	if !strings.Contains(app, "err.status === 404") {
		t.Fatal("chat app.js should fall back to new chat when restoring an unknown conversation id")
	}
}
