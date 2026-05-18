package adminui

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestClassifyBrokerProviderResult_states(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		provider  string
		body      []byte
		status    int
		err       error
		wantState string
		wantKeys  int
		wantCfg   bool
		wantBase  string
	}{
		{
			name:      "groq up with one key",
			provider:  "groq",
			body:      []byte(`{"name":"groq","keys":[{"name":"k","value":"env.GROQ_API_KEY"}]}`),
			status:    200,
			wantState: "up",
			wantKeys:  1,
			wantCfg:   true,
		},
		{
			name:      "gemini key_missing when keys array empty",
			provider:  "gemini",
			body:      []byte(`{"name":"gemini","keys":[]}`),
			status:    200,
			wantState: "key_missing",
			wantKeys:  0,
			wantCfg:   false,
		},
		{
			name:      "ollama up via base_url even without keys",
			provider:  "ollama",
			body:      []byte(`{"name":"ollama","keys":[],"network_config":{"base_url":"http://127.0.0.1:11434"}}`),
			status:    200,
			wantState: "up",
			wantKeys:  0,
			wantBase:  "http://127.0.0.1:11434",
		},
		{
			name:      "ollama key_missing when no base_url and no keys",
			provider:  "ollama",
			body:      []byte(`{"name":"ollama","keys":[]}`),
			status:    200,
			wantState: "key_missing",
		},
		{
			name:      "unknown when provider missing 404",
			provider:  "groq",
			body:      []byte(`{"is_chimera_broker_error":false,"status_code":404,"error":{"message":"Provider not found"}}`),
			status:    200,
			wantState: "unknown",
		},
		{
			name:      "down when chimera broker transport error",
			provider:  "gemini",
			err:       errors.New("dial tcp 127.0.0.1:8080: connect: connection refused"),
			wantState: "down",
		},
		{
			name:      "down when chimera broker returns 5xx",
			provider:  "gemini",
			body:      []byte(`{"error":"internal"}`),
			status:    503,
			wantState: "down",
		},
		{
			name:      "unknown when chimera broker returns 4xx (other than missing)",
			provider:  "gemini",
			body:      []byte(`{"error":"bad request"}`),
			status:    400,
			wantState: "unknown",
		},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := ClassifyBrokerProviderResult(tc.provider, tc.body, tc.status, tc.err, nil)
			if got.State != tc.wantState {
				t.Fatalf("state=%q want %q (entry=%+v)", got.State, tc.wantState, got)
			}
			if got.KeyCount != tc.wantKeys {
				t.Fatalf("key_count=%d want %d", got.KeyCount, tc.wantKeys)
			}
			if got.KeyConfigured != tc.wantCfg {
				t.Fatalf("key_configured=%v want %v", got.KeyConfigured, tc.wantCfg)
			}
			if got.OllamaBaseURL != tc.wantBase {
				t.Fatalf("ollama_base_url=%q want %q", got.OllamaBaseURL, tc.wantBase)
			}
		})
	}
}

func TestFetchBrokerProviderHealth_emptyBaseURL(t *testing.T) {
	t.Parallel()
	resp := FetchBrokerProviderHealth(context.Background(), nil, []string{"groq", "ollama"}, nil)
	if resp.BrokerUp {
		t.Fatalf("chimera_broker_up should be false with nil client")
	}
	if !strings.Contains(resp.Error, "not configured") {
		t.Fatalf("error: %q", resp.Error)
	}
	if len(resp.Providers) != 2 {
		t.Fatalf("providers len=%d", len(resp.Providers))
	}
	for _, p := range resp.Providers {
		if p.State != "down" {
			t.Fatalf("provider %q state=%q want down", p.ID, p.State)
		}
	}
}
