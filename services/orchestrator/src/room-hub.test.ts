import { describe, expect, test } from "bun:test";
import { createRoomEvent } from "@agent-room/room-events";
import { RoomHub, type ClientSession } from "./room-hub";

describe("RoomHub", () => {
  test("fans out routed dispatch events for a message", () => {
    const sent: string[] = [];
    const hub = new RoomHub();
    const session = {
      participant: {
        id: "human:rico",
        kind: "human",
        displayName: "Rico",
        routeNames: ["rico"],
        state: "idle",
        voiceEnabled: false,
      },
      socket: {
        readyState: 1,
        send: (payload: string) => sent.push(payload),
      },
    } satisfies ClientSession;

    hub.connect("demo", session);
    hub.ingest(
      "demo",
      createRoomEvent({
        id: "evt_1",
        roomId: "demo",
        kind: "message.created",
        from: "human:rico",
        payload: { text: "@bilby status" },
      }),
    );

    const events = sent.map(
      (payload) => JSON.parse(payload) as { kind: string; to: string[] },
    );
    expect(events.some((event) => event.kind === "routing.resolved")).toBe(
      true,
    );
    expect(
      events.some(
        (event) =>
          event.kind === "agent.dispatch" && event.to.includes("agent:bilby"),
      ),
    ).toBe(true);
  });

  test("invalid events fail at the boundary", () => {
    const hub = new RoomHub();
    expect(() => hub.ingest("demo", { kind: "message.created" })).toThrow();
  });

  test("disconnect removes the stored client session", () => {
    const sent: string[] = [];
    const hub = new RoomHub();
    const session = {
      participant: {
        id: "human:rico",
        kind: "human",
        displayName: "Rico",
        routeNames: ["rico"],
        state: "idle",
        voiceEnabled: false,
      },
      socket: {
        readyState: 1,
        send: (payload: string) => sent.push(payload),
      },
    } satisfies ClientSession;

    hub.connect("demo", session);
    expect(hub.clientCount("demo")).toBe(1);
    hub.disconnect("demo", session);
    expect(hub.clientCount("demo")).toBe(0);
  });

  test("rejects room id spoofing", () => {
    const hub = new RoomHub();
    const event = createRoomEvent({
      id: "evt_spoof",
      roomId: "other",
      kind: "message.created",
      from: "human:rico",
      payload: { text: "@bilby status" },
    });

    expect(() => hub.ingest("demo", event)).toThrow("room mismatch");
  });
});
