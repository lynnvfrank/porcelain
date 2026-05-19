package line

import "testing"

func TestParseSlogTextLine_conversationSample(t *testing.T) {
	line := `time=2026-05-09T12:00:00.000Z level=INFO msg=conversation.received request_id=lc-req-1 conversation_id=lc-conv-1 principal_id=lc-principal-1 turn_index=1`
	kv := ParseSlogTextLine(line)
	if kv["conversation_id"] != "lc-conv-1" {
		t.Fatalf("conversation_id=%q", kv["conversation_id"])
	}
	if kv["msg"] != "conversation.received" {
		t.Fatalf("msg=%q", kv["msg"])
	}
}

func TestLooksLikeSlogText(t *testing.T) {
	if !LooksLikeSlogText(`time=2026-05-09T12:00:00Z level=INFO msg=conversation.received`) {
		t.Fatal("expected slog text")
	}
	if LooksLikeSlogText(`gateway startup seed`) {
		t.Fatal("plain banner should not match")
	}
}
