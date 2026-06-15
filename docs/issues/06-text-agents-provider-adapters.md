## Goal

Add config-driven text agents through a provider adapter boundary.

## Deliverables

- Agent adapter layer in `packages/agents-sdk`.
- Provider interfaces for OpenAI, LiteLLM, and local model lanes.
- OpenAI Responses API implementation as one adapter.
- LiteLLM-compatible adapter shape, with mocked/local test path if no live key is approved.
- Persona config for at least Rico, Moderator, Bilby, Skippy, builder, scribe, scout, and tester metadata.
- Streaming or incremental room updates while an agent is answering.
- Server-side environment handling for provider keys.

## Acceptance Criteria

- Addressed agents can answer a human message through the configured provider.
- Provider failures, timeouts, or missing credentials surface as room-visible blocked/error receipts.
- Persona config is easy to extend without code changes.
- No API secrets leak to the client, logs, docs, or test fixtures.
- OpenAI is not hardwired as the only possible text provider.

## Validation

```bash
bun run test
bun run typecheck
```

Optional live validation requires explicit approval and configured secrets.

## Notes For Codex

Keep adapter boundaries clean so provider implementations can change without rewriting routing, UI, or persistence.
