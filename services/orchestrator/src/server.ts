import { participantSchema, type Participant } from "@agent-room/room-events";
import { createLogger } from "./logger";
import { RoomHub } from "./room-hub";

export interface OrchestratorOptions {
  host?: string;
  port?: number;
}

export interface OrchestratorServer {
  server: Bun.Server<SocketData>;
  stop(): Promise<void>;
}

interface SocketData {
  roomId: string;
  participant: Participant;
}

const clientWritableKinds = new Set([
  "message.created",
  "message.transcript_final",
]);

export function createOrchestratorServer(
  options: OrchestratorOptions = {},
): OrchestratorServer {
  const logger = createLogger("orchestrator");
  const host = options.host ?? process.env.ORCHESTRATOR_HOST ?? "127.0.0.1";
  const port =
    options.port ??
    Number.parseInt(process.env.ORCHESTRATOR_PORT ?? "4000", 10);
  const hub = new RoomHub();
  let websocketConnections = 0;
  let invalidEvents = 0;

  const server = Bun.serve<SocketData>({
    hostname: host,
    port,
    fetch(request, bunServer) {
      try {
        const url = new URL(request.url);
        if (url.pathname === "/health") {
          return Response.json({ ok: true, service: "orchestrator" });
        }
        if (url.pathname === "/metrics") {
          return new Response(
            renderMetrics(websocketConnections, invalidEvents),
            {
              headers: { "content-type": "text/plain; version=0.0.4" },
            },
          );
        }
        if (url.pathname.startsWith("/rooms/")) {
          const auth = authorizeLocalRequest(request, url);
          if (!auth.ok) {
            logger.warn("local auth rejected websocket upgrade", {
              reason: auth.reason,
              path: url.pathname,
            });
            return Response.json(
              { ok: false, error: auth.reason },
              { status: 401 },
            );
          }
          const participant = participantSchema.parse({
            id: `human:${url.searchParams.get("participantId") ?? crypto.randomUUID()}`,
            kind: "human",
            displayName: url.searchParams.get("displayName") ?? "Rico",
            routeNames: ["rico"],
            voiceEnabled: false,
          });
          const upgraded = bunServer.upgrade(request, {
            data: {
              roomId: url.pathname.split("/")[2] ?? "demo",
              participant,
            },
          });
          if (!upgraded) {
            logger.warn("websocket upgrade failed", { path: url.pathname });
            return new Response("Upgrade failed", { status: 400 });
          }
          return undefined;
        }
        return new Response("Not found", { status: 404 });
      } catch (error) {
        logger.error("http boundary failure", {
          error: error instanceof Error ? error.message : String(error),
        });
        return new Response("Internal server error", { status: 500 });
      }
    },
    websocket: {
      open(socket) {
        websocketConnections += 1;
        hub.connect(socket.data.roomId, {
          socket,
          participant: socket.data.participant,
        });
      },
      message(socket, message) {
        try {
          const raw = JSON.parse(String(message)) as Record<string, unknown>;
          if (!clientWritableKinds.has(String(raw.kind))) {
            throw new Error("unsupported client event kind");
          }
          const payload = raw.payload;
          if (!payload || typeof payload !== "object") {
            throw new Error("invalid client payload");
          }
          const stamped = {
            ...raw,
            id: typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
            roomId: socket.data.roomId,
            from: socket.data.participant.id,
            to: [],
            createdAt: new Date().toISOString(),
            payload,
          };
          hub.ingest(socket.data.roomId, stamped);
        } catch (error) {
          invalidEvents += 1;
          logger.warn("invalid websocket message", {
            error: error instanceof Error ? error.message : String(error),
          });
          hub.sendWarning(
            socket.data.roomId,
            socket,
            "Invalid room event was rejected.",
          );
        }
      },
      close(socket) {
        hub.disconnect(socket.data.roomId, {
          socket,
          participant: participantSchema.parse(socket.data.participant),
        });
      },
    },
  });

  logger.info("orchestrator listening", { host, port: server.port });

  return {
    server,
    async stop() {
      server.stop(true);
    },
  };
}

function renderMetrics(
  websocketConnections: number,
  invalidEvents: number,
): string {
  return [
    "# HELP agent_room_websocket_connections_total WebSocket connections opened.",
    "# TYPE agent_room_websocket_connections_total counter",
    `agent_room_websocket_connections_total ${websocketConnections}`,
    "# HELP agent_room_invalid_events_total Invalid WebSocket event payloads.",
    "# TYPE agent_room_invalid_events_total counter",
    `agent_room_invalid_events_total ${invalidEvents}`,
  ].join("\n");
}

export function authorizeLocalRequest(
  request: Request,
  url: URL,
): { ok: true } | { ok: false; reason: string } {
  const configuredToken = process.env.ORCHESTRATOR_LOCAL_TOKEN;
  const allowUnauthenticatedLocal =
    process.env.ALLOW_UNAUTHENTICATED_LOCAL !== "0";
  if (!configuredToken && allowUnauthenticatedLocal) {
    return isLoopbackHost(url.hostname)
      ? { ok: true }
      : { ok: false, reason: "local session token required" };
  }
  if (!configuredToken) {
    return { ok: false, reason: "local session token required" };
  }

  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const queryToken = url.searchParams.get("sessionToken");
  if (bearer === configuredToken || queryToken === configuredToken) {
    return { ok: true };
  }

  return { ok: false, reason: "invalid local session" };
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

if (import.meta.main) {
  createOrchestratorServer();
}
