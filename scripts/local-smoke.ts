import { existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { SqliteStore } from "../packages/persistence/src";
import { createRoomEvent, type RoomEvent } from "../packages/room-events/src";
import { createOrchestratorServer } from "../services/orchestrator/src/server";

const tempRoot =
  process.env.AGENT_ROOM_SMOKE_ROOT ?? "/Volumes/ThunderBolt/_tmp";

if (!existsSync(tempRoot)) {
  throw new Error(
    `Smoke temp root ${tempRoot} does not exist. Set AGENT_ROOM_SMOKE_ROOT to a writable temp directory.`,
  );
}

const runtimeDir = mkdtempSync(join(tempRoot, "agent-room-local-smoke-"));
const store = new SqliteStore({
  databasePath: join(runtimeDir, "agent-room.sqlite"),
  artifactDir: join(runtimeDir, "artifacts"),
});
const orchestrator = createOrchestratorServer({
  host: "127.0.0.1",
  port: 0,
  store,
  personaRoot: join(runtimeDir, "missing-personas"),
});

try {
  const baseUrl = `http://127.0.0.1:${orchestrator.server.port}`;
  const client = await connect(
    `ws://127.0.0.1:${orchestrator.server.port}/rooms/demo?participantId=smoke`,
  );
  await waitForEvent(client, "participant.joined");

  await expectOk(fetch(`${baseUrl}/health`), "health");
  await expectOk(
    fetch(`${baseUrl}/rooms/demo/context`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contextId: "ctx_smoke",
        name: "Smoke Context",
        kind: "snippet",
        preview: "Smoke validation context for the local demo.",
      }),
    }),
    "context attach",
  );
  await waitForEvent(client, "context.attached");

  client.socket.send(
    JSON.stringify(
      createRoomEvent({
        id: "evt_smoke_text",
        roomId: "demo",
        kind: "message.created",
        from: "human:smoke",
        payload: {
          text: "@bilby status with context",
          contextIds: ["ctx_smoke"],
        },
      }),
    ),
  );
  await waitForEvent(client, "routing.resolved");
  await waitForEvent(client, "agent.dispatch");
  await waitForEvent(client, "agent.completed");
  await waitForEvent(client, "receipt.created");

  const voiceStart = (await expectJson(
    fetch(`${baseUrl}/rooms/demo/voice/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantId: "smoke" }),
    }),
    "voice start",
  )) as { session: { sessionId: string } };
  await waitForEvent(client, "voice.session_started");

  client.socket.send(
    JSON.stringify(
      createRoomEvent({
        id: "evt_smoke_voice",
        roomId: "demo",
        kind: "message.transcript_final",
        from: "human:smoke",
        payload: {
          text: "@skippy summarize this spoken smoke checkpoint",
          source: "voice",
          confidence: 0.91,
          contextIds: ["ctx_smoke"],
        },
      }),
    ),
  );
  await waitForEvent(client, "message.transcript_final");
  await waitForEvent(client, "routing.resolved");
  await waitForEvent(client, "agent.dispatch");
  await waitForEvent(client, "agent.completed");
  await waitForEvent(client, "receipt.created");

  await expectOk(
    fetch(
      `${baseUrl}/rooms/demo/voice/session/${encodeURIComponent(voiceStart.session.sessionId)}/end`,
      { method: "POST" },
    ),
    "voice end",
  );
  await waitForEvent(client, "voice.session_ended");

  const transcript = (await expectJson(
    fetch(`${baseUrl}/rooms/demo/transcript`),
    "transcript export",
  )) as { markdown?: string; artifactPath?: string };
  await waitForEvent(client, "handoff.created");
  if (!transcript.markdown?.includes("@skippy summarize this spoken smoke")) {
    throw new Error("transcript export did not include voice transcript");
  }

  client.socket.close();
  console.log(
    JSON.stringify(
      {
        ok: true,
        runtimeDir,
        artifactPath: transcript.artifactPath,
        checks: [
          "health",
          "context",
          "text-routing",
          "voice-session",
          "voice-transcript-routing",
          "transcript-export",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await orchestrator.stop();
}

interface SmokeClient {
  socket: WebSocket;
  events: RoomEvent[];
}

async function connect(url: string): Promise<SmokeClient> {
  const socket = new WebSocket(url);
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

async function waitForEvent(
  client: SmokeClient,
  kind: string,
): Promise<RoomEvent> {
  const deadline = Date.now() + 2_000;
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

async function expectOk(
  responsePromise: Promise<Response>,
  label: string,
): Promise<void> {
  const response = await responsePromise;
  if (!response.ok) {
    throw new Error(`${label} failed with HTTP ${response.status}`);
  }
}

async function expectJson(
  responsePromise: Promise<Response>,
  label: string,
): Promise<unknown> {
  const response = await responsePromise;
  if (!response.ok) {
    throw new Error(`${label} failed with HTTP ${response.status}`);
  }
  return response.json();
}
