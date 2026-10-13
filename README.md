# Agent Room

Agent Room is a browser workroom where a person types (or, later, speaks) to several named AI agents at once. You address agents with `@name` or `@all`, watch each one's dispatch, progress, receipts and errors in one timeline, and export the transcript when you are done.

## Why it exists

Most multi-agent chat tools hide routing inside a model prompt and blur what an agent did with what it said it did. Agent Room makes both explicit:

- Room events are the core. Text, voice transcripts, dispatches, receipts and errors are typed events (zod schemas) in one replayable log.
- Routing is deterministic. `@agent`, `@all`, explicit names, `both`, and interrupt commands have tested behaviour, not model guesses.
- Receipts are separate from claims. An agent's statement about a file or tool is either backed by a receipt event or shown as unverified.
- Providers are swappable. LLM, speech-to-text, text-to-speech and voice-room transport each sit behind an interface.
- Voice is a transport, not a separate app. A final voice transcript goes through the same routing path as a typed message.

## Status

This is an MVP built for one to three people and one to three agents on one machine. It is not production-proven and has no hosted deployment.

What works today (covered by the test suite and the local smoke script):

- the room UI (React + Vite) and the orchestrator (Bun HTTP + WebSocket)
- deterministic routing and the moderator turn flow
- text agents through mock, OpenAI Responses, LiteLLM, or a local HTTP model endpoint (chosen from env)
- SQLite persistence: event log replay, context snippets, receipts, transcript export to markdown
- a mock voice session lifecycle and voice-transcript routing

What it does not do yet:

- live voice. The OpenAI Realtime and LiveKit/WebRTC adapters are fail-closed slots; no real token minting or audio pipeline is wired.
- multi-user auth beyond a local bearer token, or any hosted/SaaS deployment
- handoff to Hermes or Discord beyond the local transcript artifact
- browser end-to-end tests (the smoke script exercises the HTTP/WebSocket path only)

## Run it

Requires [Bun](https://bun.sh) 1.3 or newer.

```bash
bun install
cp .env.example .env   # optional; every value has a local default
bun run dev            # orchestrator on 127.0.0.1:4000, web UI on localhost:3000
```

With no provider keys set, agents answer through a mock provider, so the whole room works offline. Set `OPENAI_API_KEY`, `LITELLM_BASE_URL` or `LOCAL_MODEL_BASE_URL` to use a real model.

Checks:

```bash
bun run typecheck
bun run test       # unit and integration tests
bun run test:e2e   # local smoke: health, context, text and voice-transcript routing, transcript export
bun run build
```

The tests and the smoke script write their SQLite files and artifacts under the system temp directory (`AGENT_ROOM_SMOKE_ROOT` overrides it for the smoke).

## Configuration and security

- The orchestrator accepts unauthenticated WebSocket connections only when both the bind host and the request URL are loopback. Set `ORCHESTRATOR_LOCAL_TOKEN` before binding to anything else; non-loopback clients must send a bearer token, and the `sessionToken` query parameter is accepted on loopback only.
- Room state lives in SQLite at `AGENT_ROOM_DB_PATH`; transcripts go to `AGENT_ROOM_ARTIFACT_DIR`.
- Secret values never go into SQLite. Rows hold one-way API-key hashes and non-secret references such as `secret://agent-room/admin-api-key`; the value itself belongs in an external secret manager.
- `AGENT_ROOM_PERSONA_ROOT` can point at a directory of Hermes-style persona folders. Only prompt previews and source paths reach the UI. Left empty, the room uses built-in demo personas.

## Layout

```text
apps/web                     room UI
services/orchestrator        routing, turn state, agent lifecycle, WebSocket fanout
packages/room-events         typed event schemas
packages/routing             deterministic @mention routing
packages/agents-sdk          persona loading and agent runtime
packages/provider-adapters   LLM / STT / TTS / voice-room interfaces and adapters
packages/persistence         SQLite store and transcript export
scripts/local-smoke.ts       end-to-end smoke without a browser
docs/                        PRD, architecture, decisions, issue specs, progress log
```

[docs/PRD.md](docs/PRD.md) is the product plan, [docs/architecture.md](docs/architecture.md) the design, [docs/deployment.md](docs/deployment.md) the deployment modes (cloud/API, local/hybrid, self-hosted LiveKit/LiteLLM), and [docs/demo-script.md](docs/demo-script.md) the demo path. The docs were written as build briefs for coding agents and still read that way.

## License

MIT. See [LICENSE](LICENSE).
