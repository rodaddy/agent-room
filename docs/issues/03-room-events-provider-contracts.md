## Goal

Create room event contracts, receipt contracts, and verification states.

## Deliverables

- Shared schemas for the `room.event.v1` envelope.
- Event payload schemas for messages, transcripts, routing, dispatch, lifecycle, receipts, context, workspace, voice, and handoff.
- Receipt verification states: `filesystem-verified`, `provider-reported`, `manual`, `unverified`, and `failed`.
- UI rendering for receipt rows in the room timeline.
- Contract tests or schema fixtures.
- One demo flow where an agent claim is shown with a receipt and one unverified claim is visually distinct.

## Acceptance Criteria

- Receipt payloads are versioned and typed.
- Room timeline shows agent lifecycle and receipt events in order.
- UI distinguishes verified receipts from unverified natural-language claims.
- Contracts live in a shared package, not copied strings.
- Invalid events fail schema validation.

## Validation

```bash
bun run test
bun run typecheck
```

## Notes For Codex

This issue makes the app feel like cooperative agents instead of a single chatbot. It also prevents agent claims from becoming implicit truth.
