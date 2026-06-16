import {
  AgentRuntime,
  fallbackPersonas,
  loadHermesPersonasSync,
} from "@agent-room/agents-sdk";
import {
  createLiteLlmProvider,
  createLocalHttpLlmProvider,
  createMockLlmProvider,
  createMockVoiceRoomProvider,
  createOpenAiResponsesLlmProvider,
  createOpenAiRealtimeVoiceRoomProvider,
  createLiveKitVoiceRoomProvider,
  type VoiceRoomProvider,
} from "@agent-room/provider-adapters";
import {
  createContextAttachedEvent,
  SqliteStore,
  type ContextItemRecord,
} from "@agent-room/persistence";
import {
  createRoomEvent,
  participantSchema,
  type Participant,
} from "@agent-room/room-events";
import { createLogger } from "./logger";
import {
  createDemoRoutingConfig,
  RoomHub,
  type RoomEventStore,
} from "./room-hub";

export interface OrchestratorOptions {
  host?: string;
  port?: number;
  voiceProvider?: VoiceRoomProvider;
  store?: RoomEventStore & {
    close?(): void;
    exportTranscript?(roomId: string): {
      artifactPath: string;
      markdown: string;
    };
    upsertProviderConfig?(input: ProviderConfigInput): void;
  };
  personaRoot?: string;
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
  const personas = loadPersonas(
    options.personaRoot ?? process.env.AGENT_ROOM_PERSONA_ROOT,
  );
  const storeOptions: { databasePath?: string; artifactDir?: string } = {};
  if (process.env.AGENT_ROOM_DB_PATH)
    storeOptions.databasePath = process.env.AGENT_ROOM_DB_PATH;
  if (process.env.AGENT_ROOM_ARTIFACT_DIR)
    storeOptions.artifactDir = process.env.AGENT_ROOM_ARTIFACT_DIR;
  const store = options.store ?? new SqliteStore(storeOptions);
  seedProviderReferences(store);
  const voiceProvider =
    options.voiceProvider ?? createConfiguredVoiceRoomProvider();
  const hub = new RoomHub({
    routingConfig: createDemoRoutingConfig(personas),
    personas,
    store,
    agentRuntime: new AgentRuntime({
      personas,
      llmProvider: createConfiguredLlmProvider(),
    }),
  });
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
        if (url.pathname.match(/^\/rooms\/[^/]+\/voice\/session$/)) {
          const auth = authorizeLocalRequest(request, url, { bindHost: host });
          if (!auth.ok) {
            return Response.json(
              { ok: false, error: auth.reason },
              { status: 401 },
            );
          }
          return startVoiceSession(request, url, hub, voiceProvider);
        }
        if (
          url.pathname.match(/^\/rooms\/[^/]+\/voice\/session\/[^/]+\/end$/)
        ) {
          const auth = authorizeLocalRequest(request, url, { bindHost: host });
          if (!auth.ok) {
            return Response.json(
              { ok: false, error: auth.reason },
              { status: 401 },
            );
          }
          return endVoiceSession(request, url, hub, voiceProvider);
        }
        if (url.pathname.match(/^\/rooms\/[^/]+\/context$/)) {
          const auth = authorizeLocalRequest(request, url, { bindHost: host });
          if (!auth.ok) {
            return Response.json(
              { ok: false, error: auth.reason },
              { status: 401 },
            );
          }
          return attachContext(request, url, hub);
        }
        if (url.pathname.match(/^\/rooms\/[^/]+\/transcript$/)) {
          const auth = authorizeLocalRequest(request, url, { bindHost: host });
          if (!auth.ok) {
            return Response.json(
              { ok: false, error: auth.reason },
              { status: 401 },
            );
          }
          const roomId = roomIdFromPath(url);
          const transcript =
            "exportTranscript" in store &&
            typeof store.exportTranscript === "function"
              ? store.exportTranscript(roomId)
              : {
                  artifactPath: "",
                  markdown: renderTranscript(roomId, hub.history(roomId)),
                };
          const handoff = createRoomEvent({
            id: crypto.randomUUID(),
            roomId,
            kind: "handoff.created",
            from: "system:orchestrator",
            payload: {
              target: "local",
              summary: `Local transcript exported for ${roomId}.`,
              actionItems: [],
              blockers: [],
              artifactPath: transcript.artifactPath,
            },
          });
          hub.publishSystem(roomId, handoff);
          return Response.json({ ok: true, ...transcript });
        }
        if (url.pathname.startsWith("/rooms/")) {
          const auth = authorizeLocalRequest(request, url, { bindHost: host });
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
        void (async () => {
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
            await hub.ingest(socket.data.roomId, stamped);
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
        })();
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
      store.close?.();
    },
  };
}

async function attachContext(
  request: Request,
  url: URL,
  hub: RoomHub,
): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      { ok: false, error: "method not allowed" },
      { status: 405 },
    );
  }
  const body = (await request.json()) as Partial<ContextItemRecord>;
  const roomId = roomIdFromPath(url);
  const contextInput: Parameters<typeof createContextAttachedEvent>[0] = {
    roomId,
    from: "human:rico",
    contextId: body.contextId ?? crypto.randomUUID(),
    name: body.name ?? "Untitled context",
    kind: body.kind ?? "snippet",
  };
  if (body.preview) contextInput.preview = body.preview;
  if (typeof body.bytes === "number") contextInput.bytes = body.bytes;
  const event = createContextAttachedEvent(contextInput);
  hub.publishSystem(roomId, event);
  return Response.json({ ok: true, event });
}

async function startVoiceSession(
  request: Request,
  url: URL,
  hub: RoomHub,
  voiceProvider: VoiceRoomProvider,
): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      { ok: false, error: "method not allowed" },
      { status: 405 },
    );
  }
  const roomId = roomIdFromPath(url);
  const body = (await request.json().catch(() => ({}))) as {
    participantId?: string;
  };
  const result = await voiceProvider.createSession({
    roomId,
    participantId: body.participantId ?? "human:rico",
  });
  if (
    result.status === "blocked" ||
    result.status === "error" ||
    !result.value
  ) {
    const event = createRoomEvent({
      id: crypto.randomUUID(),
      roomId,
      kind: "voice.session_ended",
      from: "system:voice",
      payload: {
        sessionId: `blocked-${crypto.randomUUID()}`,
        provider: result.provider,
        state: "blocked",
        reason: result.issue?.message ?? "Voice provider unavailable.",
      },
    });
    hub.publishSystem(roomId, event);
    return Response.json(
      { ok: false, event, issue: result.issue },
      { status: 503 },
    );
  }
  const event = createRoomEvent({
    id: crypto.randomUUID(),
    roomId,
    kind: "voice.session_started",
    from: "system:voice",
    payload: {
      sessionId: result.value.sessionId,
      provider: result.provider,
      state: "started",
      transport: result.value.transport,
      expiresAt: result.value.expiresAt,
      capabilities: result.value.capabilities,
    },
  });
  hub.publishSystem(roomId, event);
  return Response.json({
    ok: true,
    event,
    session: safeVoiceSessionConfig(result.value),
  });
}

async function endVoiceSession(
  request: Request,
  url: URL,
  hub: RoomHub,
  voiceProvider: VoiceRoomProvider,
): Promise<Response> {
  if (request.method !== "POST" && request.method !== "DELETE") {
    return Response.json(
      { ok: false, error: "method not allowed" },
      { status: 405 },
    );
  }
  const roomId = roomIdFromPath(url);
  const sessionId = url.pathname.split("/")[5] ?? "unknown";
  const result = await voiceProvider.endSession({ sessionId });
  const event = createRoomEvent({
    id: crypto.randomUUID(),
    roomId,
    kind: "voice.session_ended",
    from: "system:voice",
    payload: {
      sessionId,
      provider: result.provider,
      state: result.status === "error" ? "blocked" : "ended",
      reason: result.issue?.message,
    },
  });
  hub.publishSystem(roomId, event);
  return Response.json({ ok: result.status !== "error", event });
}

function safeVoiceSessionConfig<T extends { token?: string; joinUrl?: string }>(
  value: T,
): Omit<T, "token"> {
  const { token: _token, ...safe } = value;
  if (safe.joinUrl && hasCredentialBearingUrl(safe.joinUrl)) {
    delete safe.joinUrl;
  }
  return safe;
}

function hasCredentialBearingUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["token", "access_token", "jwt", "key", "secret"].some((name) =>
      url.searchParams.has(name),
    );
  } catch {
    return true;
  }
}

function roomIdFromPath(url: URL): string {
  return url.pathname.split("/")[2] ?? "demo";
}

function loadPersonas(root: string | undefined) {
  if (!root) {
    return fallbackPersonas();
  }
  try {
    const personas = loadHermesPersonasSync(root);
    if (personas.length === 0) {
      return fallbackPersonas();
    }
    const configuredIds = new Set(
      personas.map((persona) => persona.participantId),
    );
    return [
      ...personas,
      ...fallbackPersonas().filter(
        (persona) => !configuredIds.has(persona.participantId),
      ),
    ];
  } catch {
    return fallbackPersonas();
  }
}

interface ProviderConfigInput {
  id: string;
  provider: string;
  mode: "mock" | "openai" | "litellm" | "local";
  secretRef?: string;
  baseUrl?: string;
  enabled?: boolean;
}

function seedProviderReferences(store: {
  upsertProviderConfig?: (input: ProviderConfigInput) => void;
}): void {
  store.upsertProviderConfig?.({
    id: "openai",
    provider: "openai",
    mode: "openai",
    secretRef: "vaultwarden://agent-room/openai-api-key",
    enabled: Boolean(process.env.OPENAI_API_KEY),
  });
  const litellmConfig: ProviderConfigInput = {
    id: "litellm",
    provider: "litellm",
    mode: "litellm",
    secretRef: "vaultwarden://agent-room/litellm-api-key",
    enabled: Boolean(process.env.LITELLM_BASE_URL),
  };
  if (process.env.LITELLM_BASE_URL)
    litellmConfig.baseUrl = process.env.LITELLM_BASE_URL;
  store.upsertProviderConfig?.(litellmConfig);
}

function createConfiguredLlmProvider() {
  const explicitProvider = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicitProvider === "openai" || process.env.OPENAI_API_KEY) {
    return createOpenAiResponsesLlmProvider();
  }
  if (explicitProvider === "litellm" || process.env.LITELLM_BASE_URL) {
    return createLiteLlmProvider();
  }
  if (explicitProvider === "local" || process.env.LOCAL_MODEL_BASE_URL) {
    return createLocalHttpLlmProvider();
  }
  return createMockLlmProvider("mock-llm");
}

function createConfiguredVoiceRoomProvider(): VoiceRoomProvider {
  const provider = process.env.VOICE_ROOM_PROVIDER ?? "mock";
  const liveEnabled = process.env.LIVE_VOICE_PROVIDERS_ENABLED === "1";
  if (provider === "openai-realtime") {
    return liveEnabled
      ? createOpenAiRealtimeVoiceRoomProvider()
      : createOpenAiRealtimeVoiceRoomProvider();
  }
  if (provider === "livekit-webrtc" || provider === "livekit") {
    return liveEnabled
      ? createLiveKitVoiceRoomProvider()
      : createLiveKitVoiceRoomProvider();
  }
  return createMockVoiceRoomProvider("mock-voice-room");
}

function renderTranscript(
  roomId: string,
  history: {
    from: string;
    createdAt: string;
    payload: Record<string, unknown>;
  }[],
): string {
  return [
    `# Agent Room Transcript: ${roomId}`,
    "",
    ...history.map(
      (event) =>
        `- ${event.createdAt} ${event.from}: ${typeof event.payload.text === "string" ? event.payload.text : JSON.stringify(event.payload)}`,
    ),
    "",
  ].join("\n");
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
  options: { bindHost?: string } = {},
): { ok: true } | { ok: false; reason: string } {
  const configuredToken = process.env.ORCHESTRATOR_LOCAL_TOKEN;
  const allowUnauthenticatedLocal =
    process.env.ALLOW_UNAUTHENTICATED_LOCAL !== "0";
  if (!configuredToken && allowUnauthenticatedLocal) {
    return isLoopbackHost(options.bindHost ?? url.hostname) &&
      isLoopbackHost(url.hostname)
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
  const allowQueryToken =
    isLoopbackHost(options.bindHost ?? url.hostname) &&
    isLoopbackHost(url.hostname);
  if (
    bearer === configuredToken ||
    (allowQueryToken && queryToken === configuredToken)
  ) {
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
