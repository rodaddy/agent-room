## Goal

Build the context/workspace panel for snippets, files, attached references, and receipt-linked artifacts.

## Deliverables

- Side panel UI for context items and workspace file references.
- Support for pasted code blocks and lightweight file attachments.
- Message composer can attach selected context entries.
- Room messages can reference attached context entries.
- Receipt rows can link to context/workspace artifacts.
- Truncation and expansion UX for long snippets.

## Acceptance Criteria

- User can attach context before sending a message.
- Agents receive structured context metadata, not only pasted prose.
- Room timeline shows which context entries were referenced or used.
- Code snippets remain readable on desktop screens.
- Agent claims about files/artifacts can be marked verified or unverified through receipts.

## Validation

```bash
bun run test
bun run typecheck
bun run dev
```

Manual check: attach a snippet, send a routed message, and verify timeline/context linkage.

## Notes For Codex

Start with local uploads or text snippets. Keep repo browsing and write actions out of MVP unless a later issue explicitly scopes them.

## MVP Pass 2 Implementation Notes

- The workspace panel supports local snippet attachment and selected context chips.
- Message events carry `contextIds`; agent dispatch context is assembled from persisted context records.
- Timeline rows render context links and receipt artifact chips.
- File browsing/write actions remain out of scope for this MVP slice.
