import { describe, expect, test } from "bun:test";
import { createRoomEvent } from "@agent-room/room-events";
import { RoomHub, type ClientSession } from "./room-hub";

describe("RoomHub", () => {
  test("fans out routed dispatch events for a message", async () => {
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
    await hub.ingest(
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

  test("invalid events fail at the boundary", async () => {
    const hub = new RoomHub();
    await expect(
      hub.ingest("demo", { kind: "message.created" }),
    ).rejects.toThrow();
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

  test("rejects room id spoofing", async () => {
    const hub = new RoomHub();
    const event = createRoomEvent({
      id: "evt_spoof",
      roomId: "other",
      kind: "message.created",
      from: "human:rico",
      payload: { text: "@bilby status" },
    });

    await expect(hub.ingest("demo", event)).rejects.toThrow("room mismatch");
  });
});
