## Goal
Create the orchestrator service and wire a room WebSocket protocol.

## Deliverables
- TypeScript service in `services/orchestrator`
- room connect/disconnect events
- message broadcast path
- participant presence events
- local dev instructions to run web + orchestrator together

## Acceptance criteria
- two browser clients can join the same room
- a sent message appears in both clients in realtime
- participant join/leave state updates correctly
- protocol messages are typed

## Notes for Codex
Keep transport simple. Fastify + ws or a similarly lightweight stack is fine.
