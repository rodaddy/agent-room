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

## MVP Pass 2 Implementation Notes

- `packages/agents-sdk` loads Hermes-backed persona metadata and fallback generic agents.
- `packages/provider-adapters` exposes mock, OpenAI Responses, LiteLLM/OpenAI-compatible, and local HTTP LLM constructors.
- The orchestrator selects mock/OpenAI/LiteLLM/local LLM providers from env without hardwiring one provider.
- HTTP LLM provider calls use a configurable timeout and return room-visible blocked/error lifecycle events through the agent runtime.
- Live provider calls are not required for local tests; mocked fetch tests cover request/response behavior.
