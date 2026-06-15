# Architecture

## System view

```text
Browser UI
  -> Next.js web app
  -> WebSocket room connection
  -> optional Realtime voice session

Web app
  -> orchestrator service
  -> auth provider
  -> Postgres
  -> Redis

Orchestrator
  -> OpenAI Responses API
  -> OpenAI Realtime API session bootstrap
  -> DAP transport
  -> agent adapters
```

## Main bounded pieces

### apps/web
Owns room UX:
- room timeline
- composer with mention parsing
- participants rail
- context panel
- voice controls

### services/orchestrator
Owns workflow:
- room event ingestion
- mention parsing
- task routing
- agent lifecycle state
- DAP dispatch and receipts
- persistence write path

### packages/dap-contracts
Owns schemas:
- message envelope
- receipt types
- task states
- room event payloads

### packages/ui
Owns reusable UI primitives for:
- message cards
- agent badges
- receipt rows
- voice widgets

### packages/agents-sdk
Owns adapters/helpers for:
- sending agent turns
- normalizing model responses
- converting tool receipts into room-visible events

## Event flow

1. human sends message
2. web app posts `room.message.create`
3. orchestrator parses mentions
4. orchestrator emits room receipt and agent dispatch events
5. targeted agent adapter runs
6. adapter emits progress receipts
7. final answer is written back into room timeline

## Voice flow

1. client requests voice session token
2. orchestrator creates Realtime session
3. client streams audio
4. transcript events are mirrored into room timeline
5. final spoken or text response is attached to same thread context

## Persistence

Minimum tables:
- rooms
- participants
- messages
- attachments
- agent_dispatches
- agent_receipts
- voice_sessions

## Non-goals for MVP

- multi-org enterprise RBAC
- arbitrary third-party tool execution
- full repo cloning inside browser worker sandboxes
- long-running autonomous jobs
