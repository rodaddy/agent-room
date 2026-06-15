## Goal

Finish the MVP plan with end-to-end coverage, deployment-mode docs, and a demo script.

## Deliverables

- Playwright smoke flow for room join, message send, route dispatch, agent reply, receipt rendering, and transcript/handoff path.
- Basic service health checks.
- Deployment docs for cloud/API, Mac mini M4 local/hybrid, and homelab LiveKit/LiteLLM modes.
- Production env var checklist with names only.
- MVP demo script.
- Architecture/deployment sketch in docs.

## Acceptance Criteria

- One command runs the smoke suite locally.
- Deploy docs are sufficient for a fresh operator to understand mode choices and prerequisites.
- Health checks expose obvious failures.
- README links to final docs.
- Docs do not hard-code OpenAI Realtime as the only voice path.
- Live homelab, credential, or paid-provider validation steps are clearly marked as approval-gated.

## Validation

```bash
bun run test:e2e
bun run typecheck
bun run lint
```

## Notes For Codex

Keep deployment assumptions explicit. No hidden platform magic and no live infra mutation without approval.
