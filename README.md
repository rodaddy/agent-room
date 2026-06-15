# Agent Room

Realtime multi-agent chat workspace for humans and AI agents to work together in one room.

## What it is

Agent Room is a web app where a human can chat with multiple specialized agents in the same thread, route work with `@agent` and `@all`, inspect code or attached context, and optionally talk over voice.

The whole point is visible collaboration:
- human messages stay in the room
- agent actions and receipts stay in the room
- routing is explicit
- DAP handles agent-to-agent coordination behind the scenes
- voice is first-class, not bolted on later

## MVP goals

- Shared room timeline with human + agent messages
- `@all` broadcast and `@agent-name` direct routing
- visible agent states: idle, reading, thinking, answering, blocked
- file/context panel for pasted code, uploaded files, and repo snippets
- text agents via OpenAI Responses API
- voice sessions via OpenAI Realtime API
- DAP envelopes and receipts for inter-agent work
- persistent rooms, messages, and participants

## Suggested stack

### Frontend
- Next.js 16
- TypeScript
- Tailwind
- shadcn/ui
- Zustand or TanStack Query for client state

### Backend
- Node.js + TypeScript
- Fastify or Hono for the orchestrator service
- WebSocket gateway for room events
- Postgres for persistence
- Redis for presence, fanout, and transient coordination

### AI + voice
- OpenAI Responses API for text turns
- OpenAI Realtime API for voice streaming
- DAP transport over NATS or Redis Streams

## Monorepo shape

```text
apps/
  web/                  Next.js app
services/
  orchestrator/         room logic, agent routing, tool broker
packages/
  dap-contracts/        schemas for DAP envelopes and receipts
  ui/                   shared UI components
  agents-sdk/           agent adapter helpers
docs/
  architecture.md
  issue-backlog.md
  issues/
```

## Core product behaviors

### Routing
- `@all summarize this file` sends one human message and fans out agent tasks
- `@frontend` or `@research` targets one agent directly
- agent replies include receipts showing what they touched or read

### Observable collaboration
- timeline shows dispatch, started, tool-use receipt, answer, blocked state
- agents can hand work to each other through DAP messages
- humans can see why an answer took time

### Voice
- push-to-talk or hold-to-talk
- live transcript in room
- optional spoken agent replies
- voice session links to the same room state as text

## DAP envelope sketch

```json
{
  "id": "msg_123",
  "roomId": "room_abc",
  "kind": "task.dispatch",
  "from": "human:rico",
  "to": ["agent:frontend", "agent:backend"],
  "replyTo": "msg_122",
  "body": {
    "text": "@frontend @backend figure out why auth breaks in Safari"
  },
  "context": {
    "attachments": [],
    "codeRefs": []
  },
  "createdAt": "2026-06-15T13:30:46-04:00"
}
```

## Fast Codex build strategy

Build in vertical slices, not layers:
1. room UI + local mock transport
2. real WebSocket timeline
3. orchestrator routing for `@agent` and `@all`
4. OpenAI text agents
5. DAP receipts and handoff flow
6. voice room
7. persistence and auth

That keeps each issue independently Codex-able.

## Local setup target

Use bun for workspace tasks.

```bash
bun install
bun run dev
```

Planned apps/services will define the actual scripts as they land.

## Repo workflow for implementation

- start from `main`
- create one branch per issue
- let Codex work issue-by-issue with the issue body as the prompt seed
- keep PRs vertical and demoable

## Initial issue set

See `docs/issue-backlog.md` and `docs/issues/`.
