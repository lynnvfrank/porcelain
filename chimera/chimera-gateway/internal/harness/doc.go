// Package harness runs the virtual-model chat turn pipeline as ordered stages
// with a shared turn envelope.
//
// Fail-safe defaults by stage kind (normative for v0.4):
//
//   - Transform (tool router): fail-open — on disable, misconfig, or error, pass
//     the full request body upstream unchanged.
//   - Retrieval (RAG): fail-open — on disable, empty query, or retrieve error,
//     proceed without injected context.
//   - Policy / initial pick: fail-closed — when no upstream model resolves,
//     return 503 to the client.
//   - Fallback proxy: retriable upstream errors advance the chain; non-retriable
//     errors stop the walk per chat.WithVirtualModelFallback rules.
package harness
