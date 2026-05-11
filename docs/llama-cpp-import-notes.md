# llama.cpp import notes (from Lynn's assistants-main)

## What is reusable right now

From `D:/assistants-main/assistants-main`, the strongest reusable pattern is:

1. Two local inference backends:
   - chat (`llama-server` chat model)
   - embeddings (`llama-server --embedding`)
2. One OpenAI-compatible gateway in front:
   - unified `/v1/models`
   - routes `/v1/chat/completions` to chat upstream
   - routes `/v1/embeddings` to embed upstream
3. Stable model-id aliasing in a registry file.

This maps cleanly to Porcelain's architecture where Chimera stays the single user-facing interface.

## Recommended adoption path for Porcelain

1. Keep Chimera as the front door.
2. Keep BiFrost as Chimera's upstream.
3. Configure BiFrost to include local OpenAI-compatible backends:
   - vLLM endpoint
   - llama.cpp endpoint
4. Use hosted-first + local-backup `routing.fallback_chain`.

## Files to reference from assistants-main

- `README-llmservice.md`
- `docker/llmservice-gateway/main.py`
- `docker/llmservice-llamacpp/Dockerfile.cuda`
- `docker/llmservice-llamacpp/entrypoint-chat.sh`
- `docker/llmservice-llamacpp/entrypoint-embed.sh`
- `docker-compose.llmservice.windows.yml`

## What we should not copy directly

- Full compose stack as-is (different repo assumptions, ports, and service names).
- Directly hardcoded model paths/ids from Lynn's tree.

Instead, copy the pattern and adapt names/ports to Porcelain conventions.

## Immediate Porcelain artifacts added

- `config/bifrost.local-backends.example.json`:
  starter config showing how to wire local OpenAI-compatible backends.

## Next implementation steps

1. Add a Porcelain-specific local runtime launcher profile (vLLM + llama.cpp).
2. Add startup health checks for local chat and local embeddings endpoints.
3. Add one "Local Backups" panel section in the Chimera UI:
   - endpoint status
   - active model ids
   - last fallback event
