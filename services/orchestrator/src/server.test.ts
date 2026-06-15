import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteStore } from "@agent-room/persistence";
import { createRoomEvent, type RoomEvent } from "@agent-room/room-events";
import {
  authorizeLocalRequest,
  createOrchestratorServer,
  type OrchestratorServer,
} from "./server";

let orchestrator: OrchestratorServer | undefined;
let store: SqliteStore | undefined;

beforeEach(() => {
  const tempRoot = existsSync("/Volumes/ThunderBolt/_tmp")
    ? "/Volumes/ThunderBolt/_tmp"
    : tmpdir();
  const dir = mkdtempSync(join(tempRoot, "agent-room-orchestrator-"));
  store = new SqliteStore({
    databasePath: join(dir, "agent-room.sqlite"),
    artifactDir: join(dir, "artifacts"),
  });
  orchestrator = createOrchestratorServer({
    host: "127.0.0.1",
    port: 0,
    store,
    personaRoot: join(dir, "missing-personas"),
  });
});

afterEach(async () => {
  await orchestrator?.stop();
  orchestrator = undefined;
  store = undefined;
});

describe("orchestrator websocket rooms", () => {
  test("fans out message, routing, and dispatch events to two clients", async () => {
    const first = await connect("demo", "rico");
    const second = await connect("demo", "observer");
    await waitForEvent(first, "participant.joined");
    await waitForEvent(second, "participant.joined");
    first.socket.send(
      JSON.stringify(
        createRoomEvent({
          id: "evt_test",
          roomId: "demo",
          kind: "message.created",
          from: "human:rico",
          payload: { text: "@bilby status" },
        }),
      ),
    );

    expect((await waitForEvent(first, "message.created")).id).toBe("evt_test");
    expect((await waitForEvent(second, "message.created")).id).toBe("evt_test");
    expect((await waitForEvent(second, "routing.resolved")).to).toEqual([
      "agent:bilby",
    ]);
    expect((await waitForEvent(second, "agent.dispatch")).to).toEqual([
      "agent:bilby",
    ]);
    expect(
      (await waitForEvent(second, "agent.completed")).payload.text,
    ).toContain("agent:bilby received");
    expect(await waitForEvent(second, "receipt.created")).toMatchObject({
      kind: "receipt.created",
      from: "agent:bilby",
    });
    first.socket.close();
    second.socket.close();
  });

  test("invalid input returns a sanitized visible warning", async () => {
    const client = await connect("demo", "rico");
    await waitForEvent(client, "participant.joined");
    client.socket.send(
      JSON.stringify({ kind: "receipt.created", payload: { label: "forged" } }),
    );
    const warning = await waitForEvent(client, "routing.warning");
    expect(warning.payload.warnings).toEqual([
      "Invalid room event was rejected.",
    ]);
    client.socket.close();
  });

  test("health endpoint stays available for local smoke checks", async () => {
    if (!orchestrator) {
      throw new Error("test server not started");
    }
    const response = await fetch(
      `http://127.0.0.1:${orchestrator.server.port}/health`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      service: "orchestrator",
    });
  });

  test("context API persists context and transcript export emits handoff", async () => {
    if (!orchestrator) {
      throw new Error("test server not started");
    }
    const client = await connect("demo", "rico");
    await waitForEvent(client, "participant.joined");

    const contextResponse = await fetch(
      `http://127.0.0.1:${orchestrator.server.port}/rooms/demo/context`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contextId: "ctx_test",
          name: "Test Context",
          kind: "snippet",
          preview: "Context for the test agent.",
        }),
      },
    );
    expect(contextResponse.status).toBe(200);
    expect(await waitForEvent(client, "context.attached")).toMatchObject({
      payload: { contextId: "ctx_test" },
    });

    const transcriptResponse = await fetch(
      `http://127.0.0.1:${orchestrator.server.port}/rooms/demo/transcript`,
    );
    expect(transcriptResponse.status).toBe(200);
    expect(await transcriptResponse.json()).toMatchObject({ ok: true });
    expect(await waitForEvent(client, "handoff.created")).toMatchObject({
      payload: { target: "local" },
    });
    client.socket.close();
  });
});

describe("local auth boundary", () => {
  const originalToken = process.env.ORCHESTRATOR_LOCAL_TOKEN;
  const originalAllow = process.env.ALLOW_UNAUTHENTICATED_LOCAL;

  afterEach(() => {
    restoreEnv("ORCHESTRATOR_LOCAL_TOKEN", originalToken);
    restoreEnv("ALLOW_UNAUTHENTICATED_LOCAL", originalAllow);
  });

  test("no-token mode is limited to loopback URLs", () => {
    process.env.ORCHESTRATOR_LOCAL_TOKEN = "";
    process.env.ALLOW_UNAUTHENTICATED_LOCAL = "1";

    expect(
      authorizeLocalRequest(
        new Request("http://127.0.0.1/rooms/demo"),
        new URL("http://127.0.0.1/rooms/demo"),
        { bindHost: "127.0.0.1" },
      ),
    ).toEqual({
      ok: true,
    });
    expect(
      authorizeLocalRequest(
        new Request("http://agent-room.local/rooms/demo"),
        new URL("http://agent-room.local/rooms/demo"),
        { bindHost: "0.0.0.0" },
      ),
    ).toEqual({
      ok: false,
      reason: "local session token required",
    });
    expect(
      authorizeLocalRequest(
        new Request("http://127.0.0.1/rooms/demo", {
          headers: { host: "127.0.0.1" },
        }),
        new URL("http://127.0.0.1/rooms/demo"),
        { bindHost: "0.0.0.0" },
      ),
    ).toEqual({
      ok: false,
      reason: "local session token required",
    });
  });

  test("configured local token accepts bearer and limits query token to loopback dev", () => {
    process.env.ORCHESTRATOR_LOCAL_TOKEN = "test-token";
    process.env.ALLOW_UNAUTHENTICATED_LOCAL = "0";

    expect(
      authorizeLocalRequest(
        new Request("http://agent-room.local/rooms/demo", {
          headers: { authorization: "Bearer test-token" },
        }),
        new URL("http://agent-room.local/rooms/demo"),
        { bindHost: "0.0.0.0" },
      ),
    ).toEqual({ ok: true });
    expect(
      authorizeLocalRequest(
        new Request("http://127.0.0.1/rooms/demo?sessionToken=test-token"),
        new URL("http://127.0.0.1/rooms/demo?sessionToken=test-token"),
        { bindHost: "127.0.0.1" },
      ),
    ).toEqual({ ok: true });
    expect(
      authorizeLocalRequest(
        new Request(
          "http://agent-room.local/rooms/demo?sessionToken=test-token",
        ),
        new URL("http://agent-room.local/rooms/demo?sessionToken=test-token"),
        { bindHost: "0.0.0.0" },
      ),
    ).toEqual({ ok: false, reason: "invalid local session" });
    expect(
      authorizeLocalRequest(
        new Request("http://127.0.0.1/rooms/demo?sessionToken=bad"),
        new URL("http://127.0.0.1/rooms/demo?sessionToken=bad"),
        { bindHost: "127.0.0.1" },
      ),
    ).toEqual({ ok: false, reason: "invalid local session" });
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

async function connect(
  roomId: string,
  participantId: string,
): Promise<TestClient> {
  if (!orchestrator) {
    throw new Error("test server not started");
  }
  const socket = new WebSocket(
    `ws://127.0.0.1:${orchestrator.server.port}/rooms/${roomId}?participantId=${participantId}`,
  );
  const events: RoomEvent[] = [];
  socket.addEventListener("message", (message) => {
    events.push(JSON.parse(String(message.data)) as RoomEvent);
  });
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("websocket connection failed")),
      { once: true },
    );
  });
  return { socket, events };
}

interface TestClient {
  socket: WebSocket;
  events: RoomEvent[];
}

async function waitForEvent(
  client: TestClient,
  kind: string,
): Promise<RoomEvent> {
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    const event = client.events.find((candidate) => candidate.kind === kind);
    if (event) {
      client.events.splice(client.events.indexOf(event), 1);
      return event;
    }
    await Bun.sleep(10);
  }
  throw new Error(`timed out waiting for ${kind}`);
}
