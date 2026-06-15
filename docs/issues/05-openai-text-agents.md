## Goal
Integrate OpenAI text agents for room responses.

## Deliverables
- agent adapter layer in `packages/agents-sdk`
- OpenAI Responses API integration
- persona config for at least 3 starter agents
- streaming or incremental room updates while an agent is answering
- server-side environment handling for API keys

## Acceptance criteria
- addressed agents can answer a human message
- agent errors surface as room-visible blocked/error receipts
- persona config is easy to extend
- no API secrets leak to the client

## Notes for Codex
Keep the adapter boundary clean so providers can change later.
