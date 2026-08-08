package harness

import (
	"context"
	"encoding/json"
	"fmt"
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
			writeBufferedResponse(tc.W, buffer, tc.Stream)
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
	writeBufferedResponse(tc.W, buffer, tc.Stream)
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
	msgRaw := completion.Choices[0].Message
	calls, assistant := parseMessageToolCalls(msgRaw)
	if len(calls) == 0 {
		return nil, nil
	}
	if len(assistant) == 0 {
		assistant = msgRaw
	}
	return calls, assistant
}

func parseMessageToolCalls(msgRaw json.RawMessage) ([]tools.ToolCall, json.RawMessage) {
	var message struct {
		Role      string `json:"role"`
		Content   string `json:"content"`
		ToolCalls []struct {
			ID       string `json:"id"`
			Type     string `json:"type"`
			Function struct {
				Name      string `json:"name"`
				Arguments string `json:"arguments"`
			} `json:"function"`
		} `json:"tool_calls"`
	}
	if json.Unmarshal(msgRaw, &message) != nil {
		return nil, nil
	}
	out := make([]tools.ToolCall, 0, len(message.ToolCalls))
	for _, call := range message.ToolCalls {
		if call.Type != "" && call.Type != "function" {
			continue
		}
		out = append(out, tools.ToolCall{ID: call.ID, Name: call.Function.Name, Arguments: json.RawMessage(call.Function.Arguments)})
	}
	if len(out) > 0 {
		return out, msgRaw
	}
	parsed := parseToolCallsFromContent(message.Content)
	if len(parsed) == 0 {
		return nil, nil
	}
	assistant, err := buildAssistantToolCallMessage(parsed)
	if err != nil {
		return parsed, msgRaw
	}
	return parsed, assistant
}

func parseToolCallsFromContent(content string) []tools.ToolCall {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil
	}
	for _, block := range toolCallContentCandidates(content) {
		if calls := decodeToolCallObjects(block); len(calls) > 0 {
			return calls
		}
	}
	return nil
}

func toolCallContentCandidates(content string) []string {
	var out []string
	if strings.Contains(content, "<tool_call>") {
		for _, block := range extractTaggedBlocks(content, "tool_call") {
			out = append(out, block)
		}
	}
	if stripped := stripMarkdownJSONFence(content); stripped != content {
		out = append(out, stripped)
	}
	out = append(out, content)
	return out
}

func extractTaggedBlocks(content, tag string) []string {
	open := "<" + tag + ">"
	close := "</" + tag + ">"
	var blocks []string
	for {
		start := strings.Index(content, open)
		if start < 0 {
			break
		}
		start += len(open)
		end := strings.Index(content[start:], close)
		if end < 0 {
			break
		}
		blocks = append(blocks, strings.TrimSpace(content[start:start+end]))
		content = content[start+end+len(close):]
	}
	return blocks
}

func stripMarkdownJSONFence(content string) string {
	c := strings.TrimSpace(content)
	for _, fence := range []string{"```json", "```"} {
		if strings.HasPrefix(c, fence) {
			c = strings.TrimPrefix(c, fence)
			c = strings.TrimSpace(c)
			if idx := strings.LastIndex(c, "```"); idx >= 0 {
				c = strings.TrimSpace(c[:idx])
			}
			return c
		}
	}
	return content
}

func decodeToolCallObjects(block string) []tools.ToolCall {
	block = strings.TrimSpace(block)
	if block == "" {
		return nil
	}
	var single struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if json.Unmarshal([]byte(block), &single) == nil && strings.TrimSpace(single.Name) != "" {
		return []tools.ToolCall{{Name: strings.TrimSpace(single.Name), Arguments: single.Arguments}}
	}
	var many []struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if json.Unmarshal([]byte(block), &many) == nil {
		out := make([]tools.ToolCall, 0, len(many))
		for _, item := range many {
			if strings.TrimSpace(item.Name) == "" {
				continue
			}
			out = append(out, tools.ToolCall{Name: strings.TrimSpace(item.Name), Arguments: item.Arguments})
		}
		if len(out) > 0 {
			return out
		}
	}
	return nil
}

func buildAssistantToolCallMessage(calls []tools.ToolCall) (json.RawMessage, error) {
	toolCalls := make([]map[string]any, 0, len(calls))
	for i, call := range calls {
		id := strings.TrimSpace(call.ID)
		if id == "" {
			id = fmt.Sprintf("call_%d", i)
		}
		args := strings.TrimSpace(string(call.Arguments))
		if args == "" {
			args = "{}"
		}
		toolCalls = append(toolCalls, map[string]any{
			"id":   id,
			"type": "function",
			"function": map[string]string{
				"name":      call.Name,
				"arguments": args,
			},
		})
	}
	return json.Marshal(map[string]any{
		"role":       "assistant",
		"content":    "",
		"tool_calls": toolCalls,
	})
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
