import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { createRoomEvent } from "@agent-room/room-events";
import { AgentRuntime, loadHermesPersonas } from "./index";

describe("Hermes persona loading", () => {
  test("normalizes current Hermes-style files without exposing prompt bodies", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-room-personas-"));
    const bilbyDir = join(root, "bilby");
    await Bun.$`mkdir -p ${bilbyDir}`;
    writeFileSync(
      join(bilbyDir, "agent.yaml"),
      "agent: bilby\nrole: builder\n",
    );
    writeFileSync(
      join(bilbyDir, "config.yaml"),
      "model: test\nproviders:\n  - mock\nvoice:\n  enabled: false\n",
    );
    writeFileSync(join(bilbyDir, "agent.md"), "# Bilby\nFull prompt body");

    const personas = await loadHermesPersonas(root);

    expect(personas).toHaveLength(1);
    expect(personas[0]).toMatchObject({
      id: "bilby",
      participantId: "agent:bilby",
      displayName: "Bilby",
      routeNames: expect.arrayContaining(["bilby", "builder"]),
      providerHints: expect.arrayContaining(["model", "providers"]),
      voiceHints: expect.arrayContaining(["voice"]),
    });
    expect(JSON.stringify(personas[0])).not.toContain("Full prompt body");
  });
});

describe("AgentRuntime", () => {
  test("turns a dispatch into lifecycle, completion, and receipt events", async () => {
    const runtime = new AgentRuntime({
      personas: [
        {
          id: "bilby",
          participantId: "agent:bilby",
          displayName: "Bilby",
          routeNames: ["bilby"],
          role: "builder",
          providerHints: ["mock"],
          voiceHints: [],
          toolHints: [],
          safetyHints: [],
        },
      ],
    });
    const dispatch = createRoomEvent({
      id: "dispatch_1",
      roomId: "demo",
      kind: "agent.dispatch",
      from: "moderator:room",
      to: ["agent:bilby"],
      payload: {
        agentId: "agent:bilby",
        status: "dispatch",
        text: "@bilby summarize",
      },
    });

    const events = await runtime.runDispatch({
      roomId: "demo",
      dispatch,
      context: [{ id: "ctx_1", text: "receipt rules" }],
    });

    expect(events.map((event) => event.kind)).toEqual([
      "agent.started",
      "agent.progress",
      "agent.completed",
      "receipt.created",
    ]);
    expect(events[2]?.payload.text).toContain("agent:bilby received");
  });
});
