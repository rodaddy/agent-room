import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { createRoomEvent } from "@agent-room/room-events";
import { SqliteStore, createContextAttachedEvent } from "./index";

describe("SqliteStore", () => {
  test("persists and replays room events in order", () => {
    const store = createTempStore();
    const context = createContextAttachedEvent({
      roomId: "demo",
      from: "human:rico",
      contextId: "ctx_1",
      name: "Brief",
      kind: "snippet",
      preview: "Keep receipts visible.",
    });
    const message = createRoomEvent({
      id: "evt_message",
      roomId: "demo",
      kind: "message.created",
      from: "human:rico",
      payload: { text: "@bilby use the brief", contextIds: ["ctx_1"] },
    });

    store.appendEvent(context);
    store.appendEvent(message);

    expect(store.getRoomHistory("demo").map((event) => event.id)).toEqual([
      context.id,
      "evt_message",
    ]);
    expect(store.listContextItems("demo")).toMatchObject([
      { contextId: "ctx_1", name: "Brief", kind: "snippet" },
    ]);
    store.close();
  });

  test("duplicate event ids do not re-project different payloads", () => {
    const store = createTempStore();
    const first = createContextAttachedEvent({
      roomId: "demo",
      from: "human:rico",
      contextId: "ctx_1",
      name: "Original",
      kind: "snippet",
      preview: "first",
    });
    const duplicate = {
      ...first,
      payload: {
        ...first.payload,
        name: "Changed",
        preview: "second",
      },
    };

    store.appendEvent(first);
    store.appendEvent(duplicate);

    expect(store.getRoomHistory("demo")).toHaveLength(1);
    expect(store.listContextItems("demo")).toMatchObject([
      { contextId: "ctx_1", name: "Original", preview: "first" },
    ]);
    store.close();
  });

  test("stores only hashed api keys and secret references", () => {
    const store = createTempStore();
    const record = store.registerApiKey({
      id: "admin",
      name: "Local Admin",
      secretRef: "secret://agent-room/admin-api-key",
      token: "secret-token",
      scopes: ["admin"],
    });

    expect(record.secretRef).toBe("secret://agent-room/admin-api-key");
    expect(record.tokenHash).not.toContain("secret-token");
    expect(store.verifyApiKey("secret-token")?.scopes).toEqual(["admin"]);
    expect(store.verifyApiKey("wrong")).toBeUndefined();
    store.close();
  });

  test("exports a local markdown transcript from persisted events", () => {
    const store = createTempStore();
    store.appendEvent(
      createRoomEvent({
        id: "evt_1",
        roomId: "demo",
        kind: "message.created",
        from: "human:rico",
        payload: { text: "@skippy summarize" },
      }),
    );

    const transcript = store.exportTranscript("demo");
    expect(transcript.markdown).toContain("Agent Room Transcript: demo");
    expect(transcript.markdown).toContain("@skippy summarize");
    expect(transcript.artifactPath).toContain("demo-");
    store.close();
  });
});

function createTempStore(): SqliteStore {
  const tempRoot = tmpdir();
  const dir = mkdtempSync(join(tempRoot, "agent-room-store-"));
  return new SqliteStore({
    databasePath: join(dir, "agent-room.sqlite"),
    artifactDir: join(dir, "artifacts"),
  });
}
