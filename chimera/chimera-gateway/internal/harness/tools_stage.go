package harness

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"

	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/chat"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/harness/tools"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/operatorstore"
)

// ToolExecutorStage replaces client tool declarations with the fixed,
// gateway-owned workspace tool contract for enabled virtual models.
type ToolExecutorStage struct{}

func (ToolExecutorStage) Name() string   { return "tool_executor" }
func (ToolExecutorStage) Module() string { return operatorstore.HarnessModuleToolExecutor }

func (ToolExecutorStage) Run(_ context.Context, tc *TurnContext, env *TurnEnvelope, body Body) error {
	if tc == nil || tc.Stack.VM == nil || !tc.Stack.VM.HarnessEnabled(operatorstore.HarnessModuleToolExecutor) {
		return nil
	}
	decls, err := json.Marshal(tools.OpenAITools())
	if err != nil {
		return err
	}
	body["tools"] = decls
	// Client-supplied selection may refer to a removed client tool.
	delete(body, "tool_choice")
	if env != nil && env.Response.Metadata != nil {
		env.Response.Metadata["workspace_tools_enabled"] = true
	}
	return nil
}

func toolExecutorEnabled(tc *TurnContext) bool {
	return tc != nil && tc.Stack.VM != nil &&
		tc.Stack.VM.HarnessEnabled(operatorstore.HarnessModuleToolExecutor) &&
		tc.ToolExecutor != nil
}

func toolRounds(tc *TurnContext) int {
	const defaultRounds = 5
	if tc == nil || tc.Stack.VM == nil {
		return defaultRounds
	}
	module, ok := tc.Stack.VM.HarnessModules[operatorstore.HarnessModuleToolExecutor]
	if !ok {
		return defaultRounds
	}
	var cfg struct {
		MaxToolRounds int `json:"max_tool_rounds"`
	}
	if json.Unmarshal([]byte(module.ConfigJSON), &cfg) != nil || cfg.MaxToolRounds < 1 {
		return defaultRounds
	}
	if cfg.MaxToolRounds > 10 {
		return 10
	}
	return cfg.MaxToolRounds
}

// runWorkspaceToolLoop buffers internal completions so no partial tool-call
// response reaches the client. The final completion is delivered through the
// existing fallback and evaluator capture hooks.
func runWorkspaceToolLoop(ctx context.Context, tc *TurnContext, env *TurnEnvelope, body Body, opts *chat.ProxyOpts) {
	if tc == nil || opts == nil {
		return
	}
	lastModel := tc.InitialModel
	baseOpts := *opts
	baseOpts.OnResponseCaptured = nil
	baseOpts.OnFallbackAttempt = func(model string, attempt int) {
		lastModel = model
		if opts.OnFallbackAttempt != nil {
			opts.OnFallbackAttempt(model, attempt)
		}
	}
	for round := 0; round < toolRounds(tc); round++ {
		buffer := httptest.NewRecorder()
		chat.WithVirtualModelFallback(ctx, buffer, tc.InitialModel, tc.Stack.Fallback, tc.Resolved.UpstreamBaseURL,
			tc.APIKey, false, body, tc.Timeout, tc.RouteLog, tc.Metrics, tc.LimitsGuard, &baseOpts)
		raw := buffer.Body.Bytes()
		calls, assistant := completionToolCalls(raw)
		if len(calls) == 0 {
			if opts.OnResponseCaptured != nil {
				opts.OnResponseCaptured(buffer.Code, lastModel, false, raw)
			}
			writeBufferedResponse(tc.W, buffer)
			return
		}
		appendToolMessages(body, assistant, calls, tc.ToolExecutor, env, ctx)
	}
	// The model repeatedly requested tools. A final completion gives it the
	// bounded-loop result without executing another call.
	buffer := httptest.NewRecorder()
	chat.WithVirtualModelFallback(ctx, buffer, tc.InitialModel, tc.Stack.Fallback, tc.Resolved.UpstreamBaseURL,
		tc.APIKey, false, body, tc.Timeout, tc.RouteLog, tc.Metrics, tc.LimitsGuard, &baseOpts)
	if opts.OnResponseCaptured != nil {
		opts.OnResponseCaptured(buffer.Code, lastModel, false, buffer.Body.Bytes())
	}
	writeBufferedResponse(tc.W, buffer)
}

func completionToolCalls(raw []byte) ([]tools.ToolCall, json.RawMessage) {
	var completion struct {
		Choices []struct {
			Message json.RawMessage `json:"message"`
		} `json:"choices"`
	}
	if json.Unmarshal(raw, &completion) != nil || len(completion.Choices) == 0 || len(completion.Choices[0].Message) == 0 {
		return nil, nil
	}
	var message struct {
		ToolCalls []struct {
			ID       string `json:"id"`
			Type     string `json:"type"`
			Function struct {
				Name      string `json:"name"`
				Arguments string `json:"arguments"`
			} `json:"function"`
		} `json:"tool_calls"`
	}
	if json.Unmarshal(completion.Choices[0].Message, &message) != nil {
		return nil, nil
	}
	out := make([]tools.ToolCall, 0, len(message.ToolCalls))
	for _, call := range message.ToolCalls {
		if call.Type != "" && call.Type != "function" {
			continue
		}
		out = append(out, tools.ToolCall{ID: call.ID, Name: call.Function.Name, Arguments: json.RawMessage(call.Function.Arguments)})
	}
	return out, completion.Choices[0].Message
}

func appendToolMessages(body Body, assistant json.RawMessage, calls []tools.ToolCall, executor tools.ToolExecutor, env *TurnEnvelope, ctx context.Context) {
	var messages []json.RawMessage
	_ = json.Unmarshal(body["messages"], &messages)
	messages = append(messages, assistant)
	for _, call := range calls {
		result, err := executor.Invoke(ctx, call)
		if err != nil {
			result.IsError = true
			if strings.TrimSpace(result.Content) == "" {
				result.Content = "tool failed"
			}
		}
		if env != nil {
			env.Execution.ToolCalls = append(env.Execution.ToolCalls, ToolCallRecord{Name: call.Name, ID: call.ID})
		}
		content, _ := json.Marshal(map[string]any{"content": result.Content, "is_error": result.IsError})
		msg, _ := json.Marshal(map[string]any{
			"role": "tool", "tool_call_id": call.ID, "name": call.Name, "content": string(content),
		})
		messages = append(messages, msg)
	}
	body["messages"], _ = json.Marshal(messages)
}
