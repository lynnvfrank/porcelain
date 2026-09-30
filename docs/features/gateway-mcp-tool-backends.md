# Feature: Gateway MCP tool backends

| Field | Value |
|-------|-------|
| **Doc kind** | `platform-contract` |
| **Areas** | `chimera-gateway` harness, operator store (Phase 2c), observability |
| **Status** | `draft` |
| **Introduced** | Not shipped — contract draft for v0.5 |
| **Originated from** | [`plans/gateway-mcp-tool-backends.md`](../plans/gateway-mcp-tool-backends.md) |
| **Related features** | [Gateway chat routing pipeline](gateway-chat-routing-pipeline.md), [Operator assistants](operator-assistants.md), [Operator log message registry](operator-log-message-registry.md) |
| **Depends on** | v0.4 `ToolExecutor` / `tool_executor` stage |
| **Last updated** | See git history |

## At a glance

**Draft contract only — no MCP client in gateway yet.** When implemented, the assistant harness will merge native workspace tools with tools from configured MCP servers, dispatching through a composite `ToolExecutor` inside the existing `tool_executor` stage. Operator model-assist **must not** use this profile ([`operator-model-assist-tools` plan](../plans/operator-model-assist-tools.md)).

## System behavior and contracts

**Invariants (target)**

- MCP execution stays in **`tool_executor`**; no new harness stage calls upstream LLM providers.
- **Native tool names are reserved**; MCP never overrides `read_file`, `write_file`, `list_dir`, `search`, or expansion tool names once registered.
- **No silent last-wins** when two MCP servers expose the same MCP tool name.
- **Gateway-injected tools do not pass through `tool_router`** (client-tool slimming only).
- **No human-in-the-loop** inside the tool round loop; policy is pre-authorized via assistant profile and per-tool toggles.
- Phase 1: **gateway-owned** stdio/HTTP MCP clients — not chimera-supervisor generic spawn.

**Slug mapping (normative)**

| Concept | Rule |
|---------|------|
| `toolKey` | Stable internal dispatch key (unique) |
| OpenAI `function.name` | Derived slug: `[a-zA-Z0-9_]{1,64}` |
| MCP name collision (two servers) | Distinct slugs; map to `(serverId, mcpToolName)` |
| MCP vs native name collision | Rename MCP; native wins dispatch |

**Example (illustrative)**

| serverId | mcpToolName | toolKey | openaiName (model sees) |
|----------|-------------|---------|-------------------------|
| `git_local` | `status` | `mcp:git_local:status` | `git_local__status` |
| `extra` | `read_file` | `mcp:extra:read_file` | `extra__read_file` |
| — | `read_file` (native) | `native:read_file` | `read_file` |

Long `serverId` values must hash or abbreviate so `openaiName` ≤ 64 characters (exact algorithm TBD in implementation; must be deterministic).

**Catalog limits**

| Topic | Default (until operator overrides) |
|-------|--------------------------------------|
| Max merged tools injected | Configurable N — **fail closed or** emit `tools.mcp.catalog_truncated` (close in Phase 0 implementation) |
| `tools/list` partial failure | Soft-fail per server; other servers’ tools still inject |
| Per `tools/call` deadline | Independent of client HTTP timeout; error envelope on timeout |

**Manager lifecycle**

| State | Meaning |
|-------|---------|
| `stopped` | No client |
| `starting` | Transport connecting |
| `running` | `tools/list` / `tools/call` allowed |
| `error` | Last start or call failed; operator-visible when UI exists |

`autoStart` default **off**. Gateway shutdown **must not** leave orphan stdio children.

**Env and secrets**

- MCP child env: **deny-by-default allowlist** per server record.
- Inherited gateway/supervisor env may contain provider keys — allowlist is required before spawning untrusted MCP CLIs.

**Observability (registry slugs — finalize in messages.yaml)**

- `tools.mcp.invoke`
- `tools.mcp.error`
- `tools.policy.denied`
- `tools.mcp.catalog_truncated`

**Decisions**

| Topic | Decision |
|-------|----------|
| Manager placement (Phase 1) | Gateway process owns stdio children and HTTP clients |
| Config (Phase 1) | `chimera.yaml` seed; SQLite + UI in Phase 2c |
| Third-party MCP CLIs | Not `chimera-*` wrappers; wrapper contract optional later |
| Workflow domain | task-orchestrator remains external MCP (Phase 3 deferred) |

## Interfaces

| Surface | Detail |
|---------|--------|
| Harness | `tools.ToolExecutor.Invoke`; composite behind `tool_executor` stage |
| Config | YAML `servers[]` (Phase 1); operator SQLite (Phase 2c) |
| HTTP | No public MCP facade in Phase 1 (Phase 4 deferred) |

## Code map (target)

| Area | Path (illustrative) |
|------|---------------------|
| Manager | `chimera/chimera-gateway/internal/mcpmgr/` |
| Catalog | `chimera/chimera-gateway/internal/mcptools/catalog/` |
| MCP adapter | `chimera/chimera-gateway/internal/harness/tools/mcp/` |
| Native tools | `chimera/chimera-gateway/internal/harness/tools/tools.go` |
| Tool loop | `chimera/chimera-gateway/internal/harness/tools_stage.go` |

## Out of scope / known gaps

- Gateway-injected tools skip `tool_router`; large MCP catalogs need cap or Phase 4 meta-tools.
- SSE upstream MCP unsupported in v0.5 unless transport spike proves otherwise.
- Resources/prompts aggregation not in Phase 1–2.
