## Goal

Build the first working room UI shell in `apps/web` using mock room events.

## Deliverables

- Dense workroom layout inspired by the provided sample: roster left, transcript center, context/workspace right.
- Timeline rows for human messages, agent messages, moderator notices, voice transcripts, receipts, and errors.
- Mention-aware composer UI with routing preview for `@agent`, `@all`, and multiple targets.
- Voice controls shell for connect, push/hold-to-talk, spoken response toggle, and interrupt/hold.
- Context/workspace panel shell for snippets, files, and selected previews.
- Agent state badges for idle, reading, thinking, speaking, blocked, and offline.
- Mock event data that exercises the visible states.

## Acceptance Criteria

- App renders the room as the first screen, not a marketing page.
- Mock messages distinguish human, agent, moderator, transcript, and receipt rows.
- Composer visually supports direct mentions, `@all`, and route preview.
- Voice controls are visible but can be mocked.
- Layout works on laptop screens without overlapping text or controls.
- No backend is required for the first render.

## Validation

```bash
bun run dev
bun run typecheck
bun run lint
```

Manual check: open the web app and verify roster, timeline, composer, voice controls, context/workspace panel, and receipts are all visible.

## Notes For Codex

Use stable dimensions for rails, transcript rows, and controls. Prefer a work-focused interface over decorative hero/page chrome.
