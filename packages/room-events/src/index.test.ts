import { describe, expect, test } from "bun:test";
import {
  createRoomEvent,
  receiptPayloadSchema,
  roomEventSchemaVersion,
  safeParseRoomEvent,
} from "./index";

describe("room event contracts", () => {
  test("creates a versioned room event", () => {
    const event = createRoomEvent({
      id: "evt_1",
      roomId: "room_demo",
      kind: "message.created",
      from: "human:rico",
      to: ["agent:bilby"],
      payload: { text: "@bilby status" },
    });

    expect(event.schemaVersion).toBe(roomEventSchemaVersion);
    expect(event.kind).toBe("message.created");
  });

  test("rejects invalid event kinds", () => {
    const result = safeParseRoomEvent({
      id: "evt_bad",
      schemaVersion: roomEventSchemaVersion,
      roomId: "room_demo",
      kind: "unknown",
      from: "human:rico",
      createdAt: new Date().toISOString(),
      payload: {},
    });

    expect(result.success).toBe(false);
  });

  test("rejects malformed payloads for known event kinds", () => {
    const result = safeParseRoomEvent({
      id: "evt_bad_payload",
      schemaVersion: roomEventSchemaVersion,
      roomId: "room_demo",
      kind: "message.created",
      from: "human:rico",
      to: [],
      createdAt: new Date().toISOString(),
      payload: {},
    });

    expect(result.success).toBe(false);
  });

  test("rejects malformed receipt payloads", () => {
    const result = safeParseRoomEvent({
      id: "evt_bad_receipt",
      schemaVersion: roomEventSchemaVersion,
      roomId: "room_demo",
      kind: "receipt.created",
      from: "agent:bilby",
      to: [],
      createdAt: new Date().toISOString(),
      payload: { label: "x" },
    });

    expect(result.success).toBe(false);
  });

  test("validates receipt verification states", () => {
    const receipt = receiptPayloadSchema.parse({
      label: "NOTES.md",
      summary: "File write verified",
      verification: "filesystem-verified",
    });

    expect(receipt.metadata).toEqual({});
  });

  test("accepts voice session metadata for swappable transports", () => {
    const result = safeParseRoomEvent({
      id: "evt_voice",
      schemaVersion: roomEventSchemaVersion,
      roomId: "room_demo",
      kind: "voice.session_started",
      from: "system:voice",
      to: [],
      createdAt: new Date().toISOString(),
      payload: {
        sessionId: "mock-room_demo-rico",
        provider: "mock-voice-room",
        state: "started",
        transport: "mock",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        capabilities: ["transcript-final", "spoken-response-toggle"],
      },
    });

    expect(result.success).toBe(true);
  });
});
