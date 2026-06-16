# Agent Room / Voice Workroom

Agent Room is a browser workroom where Rico can type or speak with multiple named AI agents, route work explicitly, watch progress and receipts, preserve transcripts, and hand off outcomes to Hermes, Discord, or local artifacts.

The canonical product plan is [docs/PRD.md](docs/PRD.md). Current implementation work should follow the PRD, [docs/architecture.md](docs/architecture.md), and the issue specs in [docs/issues/](docs/issues/).

## Product Principles

- Room events are the product core.
- Voice is an input/output transport attached to the same room state as text.
- Agents are config-driven participants, not hard-coded branches.
- Routing is deterministic: `@agent`, `@all`, explicit names, `both`, and interrupt commands have testable behavior.
- Receipts and verification are separate from natural-language claims.
- Provider adapters are swappable across OpenAI, LiteLLM, local model, Whisper, Edge/Kokoro/macOS TTS, OpenAI Realtime, and LiveKit/WebRTC paths.

## MVP UX

The first useful screen is the room:

- roster rail for Rico, Moderator, Bilby/Skippy, and generic roles like builder/scribe/scout/tester
- transcript timeline with human messages, agent replies, voice transcripts, moderator events, receipts, and errors
- mention-aware composer with context attachments and routing preview
- voice controls for connect, push/hold-to-talk, spoken response, and interrupt/hold
- context/workspace panel for snippets, files, references, and receipt-linked artifacts

## Deployment Modes

Cloud/API mode uses hosted OpenAI text, STT/TTS, and optionally Realtime behind the same room-event interfaces.

Mac mini M4 local/hybrid mode runs the app locally with local/browser STT, Edge/macOS/Kokoro TTS, LiteLLM or local model routing, and no hard dependency on homelab LiveKit.

Homelab mode uses LiveKit/WebRTC, LiteLLM-first reasoning, local STT/TTS, transcript storage, and Hermes/Discord handoff. Live host/IP/credential changes require separate approval and verification.

## Suggested Stack

- Bun workspace
- TypeScript
- `apps/web` for the room UI
- `services/orchestrator` for routing, room events, agent lifecycle, and provider brokering
- shared packages for event schemas, provider interfaces, agents, voice, persistence, UI, and workspace receipts
- SQLite for MVP local durable state, with a clean path to Postgres if multi-user/server deployment later needs it
- Redis or equivalent for presence/fanout when needed

## Planned Monorepo Shape

```text
apps/
  web/
services/
  orchestrator/
packages/
  room-events/
  provider-adapters/
  agents-sdk/
  voice/
  persistence/
  workspace/
  ui/
docs/
  PRD.md
  architecture.md
  issue-backlog.md
  issues/
```

## Local Setup

Use Bun for workspace tasks.

```bash
bun install
bun run dev
bun run typecheck
bun run lint
bun run test
bun run test:e2e
```

`bun run dev` starts the orchestrator and web UI together. For split terminals, use `bun run dev:orchestrator` and `bun run dev:web`.

`bun run test:e2e` runs the local smoke flow in [scripts/local-smoke.ts](scripts/local-smoke.ts). It starts the orchestrator on loopback, uses SQLite and transcript artifacts under `/Volumes/ThunderBolt/_tmp` by default, attaches context, sends text and voice transcript turns through the room, starts/ends a mock voice session, and exports a local transcript.

Copy `.env.example` when local configuration is needed. The orchestrator allows unauthenticated WebSocket upgrades only when both the bind host and request URL are loopback by default; set `ORCHESTRATOR_LOCAL_TOKEN` before exposing it beyond `127.0.0.1`/`localhost`. Bearer auth is required for exposed/non-loopback use; `sessionToken` query auth is restricted to loopback development only.

The local MVP persists room state to SQLite at `AGENT_ROOM_DB_PATH` and writes transcript artifacts under `AGENT_ROOM_ARTIFACT_DIR`. Persona metadata is loaded from Hermes backups through `AGENT_ROOM_PERSONA_ROOT`; only prompt previews and source paths are exposed to the app. Secret values belong in Vaultwarden, while SQLite stores only hashes and `vaultwarden://agent-room/...` references.

See [docs/deployment.md](docs/deployment.md) for mode-specific operator notes and [docs/demo-script.md](docs/demo-script.md) for the current MVP demo path.

## Implementation Strategy

Build vertical slices:

1. scaffold, room event contracts, and mock providers
2. room UI with mock event timeline
3. orchestrator WebSocket protocol and deterministic routing
4. config-driven text agents through provider adapters
5. context/workspace receipts and transcript persistence
6. voice transport adapter path
7. handoff, E2E validation, and deployment docs

See [docs/issue-backlog.md](docs/issue-backlog.md) for the MVP issue map.
