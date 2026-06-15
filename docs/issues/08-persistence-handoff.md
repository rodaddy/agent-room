## Goal

Persist room history and add lightweight access control.

## Deliverables

- Persistence schema and migrations for rooms, participants, room events, messages, dispatches, receipts, context items, voice sessions, and handoffs.
- Room/message/event persistence write path.
- Room list and resume UX.
- Lightweight auth or local-dev identity strategy.
- Basic ownership/access rules for room state.
- Local transcript artifact and handoff payload generation.
- Hermes/Discord handoff payload shape without requiring live posting in tests.

## Acceptance Criteria

- Refreshing the page preserves room history.
- Authenticated or local-dev user identity is shown in the room.
- Unauthorized room access is blocked or explicitly out-of-scope for local-only mode.
- Full transcript can be exported locally.
- Handoff payload includes participants, start/end, action items, blockers, and artifact path.
- Live Hermes/Discord posting is behind an explicit adapter and not required for local tests.

## Validation

```bash
bun run test
bun run typecheck
```

Manual check: create a room, send messages, refresh, and verify history remains.

## Notes For Codex

Prefer the least magical auth path that works cleanly with the selected app structure. Do not invent credentials.

## MVP Pass 2 Implementation Notes

- SQLite is the MVP local store for room replay and projections.
- `room_events` is the canonical event log; messages, dispatches, receipts, context, voice sessions, handoffs, provider configs, identities, room membership, and API keys are projections/supporting tables.
- API keys are stored as SHA-256 hashes plus Vaultwarden refs only.
- Duplicate event ids do not re-project different payloads over the canonical event log.
- Local transcript export emits `handoff.created` and writes markdown artifacts.
- Live Hermes/Discord posting remains behind future adapter work.
