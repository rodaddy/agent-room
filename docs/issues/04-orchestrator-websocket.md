## Goal

Create the orchestrator service and WebSocket room event protocol.

## Deliverables

- TypeScript service in `services/orchestrator`.
- WebSocket connect/disconnect flow.
- Room event ingestion, validation, and broadcast path.
- Participant presence events.
- Message event fanout.
- Local dev instructions to run web and orchestrator together.
- Typed client/server protocol shared with the web app.

## Acceptance Criteria

- Two browser clients can join the same room.
- A sent message appears in both clients in realtime.
- Participant join/leave state updates correctly.
- Invalid protocol messages fail closed with visible/sanitized errors.
- Protocol messages use shared room event types rather than ad hoc strings.

## Validation

```bash
bun run typecheck
bun run test
bun run dev
```

Manual check: open two clients, join the same room, send one message, and verify both timelines and roster state update.

## Notes For Codex

Keep transport simple. Fastify plus WebSocket or a similarly lightweight stack is fine.
