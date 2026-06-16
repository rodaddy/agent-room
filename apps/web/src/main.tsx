import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Download,
  Mic,
  Paperclip,
  Pause,
  Plus,
  Radio,
  Send,
  Square,
  Volume2,
} from "lucide-react";
import {
  createRoomEvent,
  safeParseRoomEvent,
  type ReceiptVerification,
  type RoomEvent,
} from "@agent-room/room-events";
import "./styles.css";

type AgentState =
  | "idle"
  | "reading"
  | "thinking"
  | "speaking"
  | "blocked"
  | "offline";

interface ParticipantView {
  id: string;
  name: string;
  role: string;
  state: AgentState;
  color: string;
  voice: boolean;
}

interface ContextItemView {
  contextId: string;
  name: string;
  kind: "snippet" | "file" | "url" | "note";
  preview: string;
  bytes?: number;
  artifactPath?: string;
}

const baseParticipants: ParticipantView[] = [
  {
    id: "rico",
    name: "Rico",
    role: "controller",
    state: "idle",
    color: "#5ee787",
    voice: true,
  },
  {
    id: "moderator",
    name: "Moderator",
    role: "routing",
    state: "thinking",
    color: "#9aa4b2",
    voice: false,
  },
  {
    id: "bilby",
    name: "Bilby",
    role: "builder",
    state: "reading",
    color: "#ffb454",
    voice: true,
  },
  {
    id: "skippy",
    name: "Skippy",
    role: "scout",
    state: "speaking",
    color: "#7cc7ff",
    voice: true,
  },
  {
    id: "scribe",
    name: "Scribe",
    role: "scribe",
    state: "blocked",
    color: "#ef7fbd",
    voice: false,
  },
  {
    id: "tester",
    name: "Tester",
    role: "tester",
    state: "offline",
    color: "#8de4af",
    voice: false,
  },
];

const initialEvents: RoomEvent[] = [
  createRoomEvent({
    id: "mock_context_1",
    roomId: "demo",
    kind: "context.attached",
    from: "human:rico",
    payload: {
      contextId: "ctx_prd",
      name: "docs/PRD.md",
      kind: "file",
      preview: "Room events are the product core; voice is a transport.",
    },
  }),
  createRoomEvent({
    id: "mock_human_1",
    roomId: "demo",
    kind: "message.created",
    from: "human:rico",
    to: ["agent:bilby", "agent:skippy"],
    payload: {
      text: "@bilby @skippy sketch the MVP pass and keep receipts visible.",
      contextIds: ["ctx_prd"],
    },
  }),
  createRoomEvent({
    id: "mock_route_1",
    roomId: "demo",
    kind: "routing.resolved",
    from: "moderator:room",
    to: ["agent:bilby", "agent:skippy"],
    payload: {
      mode: "dispatch",
      targets: ["agent:bilby", "agent:skippy"],
      warnings: [],
      normalizedText:
        "@bilby @skippy sketch the MVP pass and keep receipts visible.",
    },
  }),
  createRoomEvent({
    id: "mock_agent_1",
    roomId: "demo",
    kind: "agent.progress",
    from: "agent:bilby",
    to: ["human:rico"],
    payload: {
      agentId: "agent:bilby",
      status: "progress",
      text: "Drafting room event contracts and mock provider paths.",
    },
  }),
  createRoomEvent({
    id: "mock_receipt_1",
    roomId: "demo",
    kind: "receipt.created",
    from: "agent:bilby",
    payload: {
      label: "room.event.v1",
      summary: "Mock receipt rendered from the shared event contract.",
      verification: "filesystem-verified",
      artifactId: "ctx_prd",
    },
  }),
  createRoomEvent({
    id: "mock_receipt_2",
    roomId: "demo",
    kind: "receipt.created",
    from: "agent:scribe",
    payload: {
      label: "docs/issue-backlog.md",
      summary: "Scribe claim waiting for file receipt verification.",
      verification: "unverified",
    },
  }),
  createRoomEvent({
    id: "mock_participant_1",
    roomId: "demo",
    kind: "participant.state_changed",
    from: "system:orchestrator",
    payload: {
      participantId: "agent:skippy",
      state: "speaking",
    },
  }),
  createRoomEvent({
    id: "mock_warning_1",
    roomId: "demo",
    kind: "routing.warning",
    from: "moderator:room",
    payload: {
      mode: "warning",
      targets: [],
      warnings: ["Unknown route target @nobody. No dispatch sent."],
      normalizedText: "@nobody status",
    },
  }),
];

function App() {
  const [message, setMessage] = useState(
    "@bilby summarize the current workspace receipts",
  );
  const [events, setEvents] = useState<RoomEvent[]>(initialEvents);
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([
    "ctx_prd",
  ]);
  const [contextDraft, setContextDraft] = useState(
    "SQLite should store room events and Vaultwarden secret references only.",
  );
  const [selectedContextId, setSelectedContextId] = useState("ctx_prd");
  const [spokenReplies, setSpokenReplies] = useState(true);
  const routeChips = useMemo(() => extractRouteChips(message), [message]);
  const contextItems = useMemo(() => deriveContextItems(events), [events]);
  const contextById = useMemo(
    () => new Map(contextItems.map((item) => [item.contextId, item])),
    [contextItems],
  );
  const participants = useMemo(
    () => deriveParticipantViews(baseParticipants, events),
    [events],
  );
  const voiceState = useMemo(() => deriveVoiceState(events), [events]);
  const selectedContext = contextById.get(selectedContextId) ?? contextItems[0];

  function appendEvent(event: RoomEvent): void {
    setEvents((current) =>
      current.some((candidate) => candidate.id === event.id)
        ? current
        : [...current, event],
    );
  }

  function sendMessage(): void {
    const event = createRoomEvent({
      id: crypto.randomUUID(),
      roomId: "demo",
      kind: "message.created",
      from: "human:rico",
      payload: { text: message, contextIds: selectedContextIds },
    });
    appendEvent(event);
    sendToOrchestrator(event, appendEvent);
  }

  function attachSnippet(): void {
    const event = createRoomEvent({
      id: crypto.randomUUID(),
      roomId: "demo",
      kind: "context.attached",
      from: "human:rico",
      payload: {
        contextId: crypto.randomUUID(),
        name: "Scratch note",
        kind: "snippet",
        preview: contextDraft,
        bytes: contextDraft.length,
      },
    });
    appendEvent(event);
    setSelectedContextIds((current) => [
      ...current,
      String(event.payload.contextId),
    ]);
    setSelectedContextId(String(event.payload.contextId));
    sendContextToOrchestrator(event, appendEvent);
  }

  function toggleContext(contextId: string): void {
    setSelectedContextIds((current) =>
      current.includes(contextId)
        ? current.filter((candidate) => candidate !== contextId)
        : [...current, contextId],
    );
    setSelectedContextId(contextId);
  }

  function exportTranscript(): void {
    void exportTranscriptForRoom(events);
  }

  function startVoice(): void {
    startVoiceSession(appendEvent);
  }

  function endVoice(): void {
    endVoiceSession(voiceState.sessionId, appendEvent);
  }

  function sendMockVoiceTranscript(): void {
    const event = createRoomEvent({
      id: crypto.randomUUID(),
      roomId: "demo",
      kind: "message.transcript_final",
      from: "human:rico",
      payload: {
        text: "@bilby summarize this spoken checkpoint",
        source: "voice",
        confidence: 0.91,
        contextIds: selectedContextIds,
      },
    });
    appendEvent(event);
    sendToOrchestrator(event, appendEvent);
  }

  function simulateVoiceFailure(): void {
    appendEvent(
      createRoomEvent({
        id: crypto.randomUUID(),
        roomId: "demo",
        kind: "voice.session_ended",
        from: "system:voice",
        payload: {
          sessionId: voiceState.sessionId ?? "mock-voice-session",
          provider: voiceState.provider,
          state: "blocked",
          reason: "Mock microphone failure; retry is available.",
        },
      }),
    );
  }

  return (
    <main className="app-shell">
      <aside className="roster">
        <div className="brand">
          <span className="brand-dot" />
          <div>
            <h1>Agent Room</h1>
            <p>roster {participants.length}/6</p>
          </div>
        </div>
        <div className="participant-list">
          {participants.map((participant) => (
            <section className="participant" key={participant.id}>
              <span
                className="avatar"
                style={{ background: participant.color }}
              />
              <div>
                <strong>{participant.name}</strong>
                <p>{participant.role}</p>
              </div>
              <span className={`state state-${participant.state}`}>
                {participant.state}
              </span>
            </section>
          ))}
        </div>
      </aside>

      <section className="room">
        <header className="room-header">
          <div>
            <h2>Voice Workroom</h2>
            <p>local · mock providers · room.event.v1</p>
          </div>
          <span className={`voice-state voice-${voiceState.state}`}>
            {voiceState.label}
          </span>
          <div className="voice-bar" aria-label="voice controls">
            <button
              aria-label={
                voiceState.state === "started" ? "Retry voice" : "Connect voice"
              }
              className={voiceState.state === "started" ? "active" : "inactive"}
              onClick={startVoice}
              type="button"
            >
              <Radio size={17} />
              <span>{voiceState.state === "started" ? "Live" : "Connect"}</span>
            </button>
            <button
              aria-label="Send mock voice transcript"
              className="inactive"
              onClick={sendMockVoiceTranscript}
              type="button"
            >
              <Mic size={17} />
              <span>Transcript</span>
            </button>
            <button
              aria-label="Toggle spoken replies"
              aria-pressed={spokenReplies}
              className={spokenReplies ? "active" : "inactive"}
              onClick={() => setSpokenReplies((current) => !current)}
              type="button"
            >
              <Volume2 size={17} />
              <span>{spokenReplies ? "Spoken on" : "Spoken off"}</span>
            </button>
            <button
              aria-label="Simulate voice failure"
              className="inactive"
              onClick={simulateVoiceFailure}
              type="button"
            >
              <Pause size={17} />
              <span>Fail</span>
            </button>
            <button
              aria-label="Stop voice"
              className="danger"
              onClick={endVoice}
              type="button"
            >
              <Square size={17} />
              <span>Stop</span>
            </button>
            <button
              className="inactive"
              title="Export transcript"
              onClick={exportTranscript}
            >
              <Download size={17} />
            </button>
          </div>
        </header>

        <div className="timeline">
          {events.map((event) => (
            <article
              className={`event event-${classForKind(event.kind)}`}
              key={event.id}
            >
              <div className="event-meta">
                <span>{titleForKind(event.kind)}</span>
                <small>{event.from}</small>
              </div>
              <p>{describeRoomEvent(event)}</p>
              {contextIdsFor(event).map((contextId) => (
                <button
                  className="context-chip"
                  key={contextId}
                  type="button"
                  onClick={() => setSelectedContextId(contextId)}
                >
                  <Paperclip size={12} />
                  {contextById.get(contextId)?.name ?? contextId}
                </button>
              ))}
              {receiptVerificationFor(event) ? (
                <span
                  className={`receipt-chip receipt-${receiptVerificationFor(event)}`}
                >
                  {receiptVerificationLabel(receiptVerificationFor(event))}
                </span>
              ) : null}
              {artifactIdFor(event) ? (
                <button
                  className="context-chip"
                  type="button"
                  onClick={() =>
                    setSelectedContextId(artifactIdFor(event) ?? "")
                  }
                >
                  artifact{" "}
                  {contextById.get(artifactIdFor(event) ?? "")?.name ??
                    artifactIdFor(event)}
                </button>
              ) : null}
              {event.to.length > 0 ? (
                <span className="target-chip">to {event.to.join(", ")}</span>
              ) : null}
            </article>
          ))}
        </div>

        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage();
          }}
        >
          <div className="route-preview">
            {routeChips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
            {selectedContextIds.map((contextId) => (
              <span key={contextId}>
                ctx:{contextById.get(contextId)?.name ?? contextId}
              </span>
            ))}
          </div>
          <label htmlFor="message">Message</label>
          <div className="composer-row">
            <textarea
              id="message"
              value={message}
              onChange={(event) => setMessage(event.currentTarget.value)}
            />
            <button type="submit" title="Send message">
              <Send size={18} />
            </button>
          </div>
        </form>
      </section>

      <aside className="workspace">
        <header>
          <h2>Workspace</h2>
          <p>/app/workspace · persisted context</p>
        </header>
        <section className="context-editor">
          <textarea
            aria-label="New context snippet"
            value={contextDraft}
            onChange={(event) => setContextDraft(event.currentTarget.value)}
          />
          <button type="button" onClick={attachSnippet}>
            <Plus size={15} />
            Attach
          </button>
        </section>
        {contextItems.map((item) => (
          <section
            className={`context-item ${selectedContextIds.includes(item.contextId) ? "context-selected" : ""}`}
            key={item.contextId}
          >
            <strong>{item.name}</strong>
            <span>{item.kind}</span>
            <small>{item.bytes ? `${item.bytes}B` : item.contextId}</small>
            <button type="button" onClick={() => toggleContext(item.contextId)}>
              {selectedContextIds.includes(item.contextId)
                ? "attached"
                : "attach"}
            </button>
          </section>
        ))}
        <section className="preview">
          <h3>Selected Preview</h3>
          <pre>{selectedContext?.preview ?? "No context selected."}</pre>
        </section>
      </aside>
    </main>
  );
}

function sendToOrchestrator(
  event: RoomEvent,
  appendEvent: (event: RoomEvent) => void,
): void {
  const socket = new WebSocket(
    import.meta.env.VITE_ORCHESTRATOR_WS_URL ??
      "ws://127.0.0.1:4000/rooms/demo",
  );
  socket.addEventListener("open", () => socket.send(JSON.stringify(event)), {
    once: true,
  });
  socket.addEventListener("message", (incoming) =>
    appendParsedSocketEvent(String(incoming.data), appendEvent),
  );
  socket.addEventListener("error", () => {
    appendEvent(
      createRoomEvent({
        id: crypto.randomUUID(),
        roomId: "demo",
        kind: "routing.warning",
        from: "system:web",
        payload: {
          mode: "warning",
          targets: [],
          warnings: ["Orchestrator is unavailable; mock message kept locally."],
          normalizedText: String(event.payload.text ?? ""),
        },
      }),
    );
  });
}

function sendContextToOrchestrator(
  event: RoomEvent,
  appendEvent: (event: RoomEvent) => void,
): void {
  fetch(`${orchestratorHttpUrl()}/rooms/demo/context`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event.payload),
  })
    .then((response) => (response.ok ? response.json() : undefined))
    .then((result) => {
      const echoed = (result as { event?: unknown } | undefined)?.event;
      if (echoed) {
        const parsed = safeParseRoomEvent(echoed);
        if (parsed.success) {
          appendEvent(parsed.data);
        }
      }
    })
    .catch(() => {
      appendEvent(
        createRoomEvent({
          id: crypto.randomUUID(),
          roomId: "demo",
          kind: "routing.warning",
          from: "system:web",
          payload: {
            mode: "warning",
            targets: [],
            warnings: [
              "Context kept locally; orchestrator context API is unavailable.",
            ],
            normalizedText: "",
          },
        }),
      );
    });
}

function startVoiceSession(appendEvent: (event: RoomEvent) => void): void {
  fetch(`${orchestratorHttpUrl()}/rooms/demo/voice/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ participantId: "human:rico" }),
  })
    .then((response) => response.json())
    .then((result) => appendResultEvent(result, appendEvent))
    .catch(() => {
      appendEvent(
        createRoomEvent({
          id: crypto.randomUUID(),
          roomId: "demo",
          kind: "voice.session_started",
          from: "system:voice",
          payload: {
            sessionId: `local-${crypto.randomUUID()}`,
            provider: "mock-browser",
            state: "started",
            transport: "mock",
            capabilities: ["transcript-final", "local-recovery"],
          },
        }),
      );
    });
}

function endVoiceSession(
  sessionId: string | undefined,
  appendEvent: (event: RoomEvent) => void,
): void {
  const resolvedSessionId = sessionId ?? "local-mock-session";
  fetch(
    `${orchestratorHttpUrl()}/rooms/demo/voice/session/${encodeURIComponent(resolvedSessionId)}/end`,
    { method: "POST" },
  )
    .then((response) => response.json())
    .then((result) => appendResultEvent(result, appendEvent))
    .catch(() => {
      appendEvent(
        createRoomEvent({
          id: crypto.randomUUID(),
          roomId: "demo",
          kind: "voice.session_ended",
          from: "system:voice",
          payload: {
            sessionId: resolvedSessionId,
            provider: "mock-browser",
            state: "ended",
            transport: "mock",
          },
        }),
      );
    });
}

function appendResultEvent(
  result: unknown,
  appendEvent: (event: RoomEvent) => void,
): void {
  const candidate =
    result && typeof result === "object"
      ? (result as { event?: unknown }).event
      : undefined;
  if (!candidate) {
    return;
  }
  const parsed = safeParseRoomEvent(candidate);
  if (parsed.success) {
    appendEvent(parsed.data);
  }
}

async function exportTranscriptForRoom(events: RoomEvent[]): Promise<void> {
  try {
    const response = await fetch(
      `${orchestratorHttpUrl()}/rooms/demo/transcript`,
    );
    if (response.ok) {
      const body = (await response.json()) as { markdown?: string };
      downloadText(
        "agent-room-demo-transcript.md",
        body.markdown ?? renderLocalTranscript(events),
      );
      return;
    }
  } catch {
    // Local browser export remains available without the orchestrator.
  }
  downloadText("agent-room-demo-transcript.md", renderLocalTranscript(events));
}

function orchestratorHttpUrl(): string {
  return (
    import.meta.env.VITE_ORCHESTRATOR_HTTP_URL ?? "http://127.0.0.1:4000"
  ).replace(/\/+$/, "");
}

function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderLocalTranscript(events: RoomEvent[]): string {
  return [
    "# Agent Room Transcript: demo",
    "",
    ...events
      .filter(
        (event) =>
          event.kind === "message.created" ||
          event.kind === "message.transcript_final" ||
          event.kind === "agent.completed" ||
          event.kind === "agent.blocked",
      )
      .map(
        (event) =>
          `- ${event.createdAt} ${event.from}: ${describeRoomEvent(event)}`,
      ),
    "",
  ].join("\n");
}

function appendParsedSocketEvent(
  payload: string,
  appendEvent: (event: RoomEvent) => void,
): void {
  try {
    const parsed = safeParseRoomEvent(JSON.parse(payload));
    if (parsed.success) {
      appendEvent(parsed.data);
      return;
    }
  } catch {
    // Fall through to a visible room warning.
  }

  appendEvent(
    createRoomEvent({
      id: crypto.randomUUID(),
      roomId: "demo",
      kind: "routing.warning",
      from: "system:web",
      payload: {
        mode: "warning",
        targets: [],
        warnings: ["Malformed orchestrator event ignored by web client."],
        normalizedText: "",
      },
    }),
  );
}

function deriveContextItems(events: RoomEvent[]): ContextItemView[] {
  const items = new Map<string, ContextItemView>();
  for (const event of events) {
    if (
      event.kind !== "context.attached" &&
      event.kind !== "workspace.file_observed" &&
      event.kind !== "workspace.file_changed"
    ) {
      continue;
    }
    const contextId =
      typeof event.payload.contextId === "string"
        ? event.payload.contextId
        : "";
    const name =
      typeof event.payload.name === "string" ? event.payload.name : contextId;
    const kind = contextKindFor(event.payload.kind);
    if (!contextId || !name || !kind) {
      continue;
    }
    const item: ContextItemView = {
      contextId,
      name,
      kind,
      preview:
        typeof event.payload.preview === "string"
          ? event.payload.preview
          : "No preview available.",
    };
    if (typeof event.payload.bytes === "number") {
      item.bytes = event.payload.bytes;
    }
    if (typeof event.payload.artifactPath === "string") {
      item.artifactPath = event.payload.artifactPath;
    }
    items.set(contextId, item);
  }
  return [...items.values()];
}

function contextIdsFor(event: RoomEvent): string[] {
  const contextIds = event.payload.contextIds;
  return Array.isArray(contextIds)
    ? contextIds.filter((item): item is string => typeof item === "string")
    : [];
}

function artifactIdFor(event: RoomEvent): string | undefined {
  return typeof event.payload.artifactId === "string"
    ? event.payload.artifactId
    : undefined;
}

function contextKindFor(value: unknown): ContextItemView["kind"] | undefined {
  if (
    value === "snippet" ||
    value === "file" ||
    value === "url" ||
    value === "note"
  ) {
    return value;
  }
  return undefined;
}

function extractRouteChips(value: string): string[] {
  const mentions = [...value.matchAll(/@([a-zA-Z0-9_-]+)/g)].map(
    (match) => `@${match[1]}`,
  );
  return mentions.length > 0 ? [...new Set(mentions)] : ["default route"];
}

function classForKind(kind: RoomEvent["kind"]): string {
  if (kind.startsWith("agent.")) return "agent";
  if (kind.startsWith("routing.")) return "moderator";
  if (kind.startsWith("message.transcript")) return "transcript";
  if (kind === "receipt.created") return "receipt";
  if (kind === "message.created") return "human";
  return "moderator";
}

function titleForKind(kind: RoomEvent["kind"]): string {
  if (kind === "message.created") return "Human";
  if (kind.startsWith("message.transcript")) return "Voice transcript";
  if (kind.startsWith("agent.")) return "Agent";
  if (kind.startsWith("routing.")) return "Moderator";
  if (kind === "receipt.created") return "Receipt";
  return kind;
}

function describeRoomEvent(event: RoomEvent): string {
  if ("text" in event.payload && typeof event.payload.text === "string") {
    return event.payload.text;
  }
  if ("summary" in event.payload && typeof event.payload.summary === "string") {
    return event.payload.summary;
  }
  if ("warnings" in event.payload && Array.isArray(event.payload.warnings)) {
    return event.payload.warnings.join(" ");
  }
  return JSON.stringify(event.payload);
}

function deriveParticipantViews(
  initialParticipants: ParticipantView[],
  events: RoomEvent[],
): ParticipantView[] {
  const participants = new Map(
    initialParticipants.map((participant) => [
      participant.id,
      { ...participant, state: "idle" as AgentState },
    ]),
  );

  for (const event of events) {
    const agentId =
      typeof event.payload.agentId === "string" ? event.payload.agentId : "";
    const agentStatus =
      typeof event.payload.status === "string" ? event.payload.status : "";
    if (event.kind.startsWith("agent.") && agentId) {
      const participantId = normalizeParticipantKey(agentId);
      const participant = participants.get(participantId);
      if (!participant) continue;
      participant.state = stateFromAgentStatus(agentStatus);
    }

    if (event.kind === "participant.joined") {
      const participant = participantViewFromPayload(event.payload.participant);
      if (participant) {
        participants.set(participant.id, participant);
      }
    }

    if (event.kind === "participant.left") {
      const participantId =
        typeof event.payload.participantId === "string"
          ? normalizeParticipantKey(event.payload.participantId)
          : "";
      const participant = participants.get(participantId);
      if (participant) {
        participant.state = "offline";
      }
    }

    if (event.kind === "participant.state_changed") {
      const participantId =
        typeof event.payload.participantId === "string"
          ? normalizeParticipantKey(event.payload.participantId)
          : "";
      const participantState =
        typeof event.payload.state === "string" ? event.payload.state : "";
      const participant = participants.get(participantId);
      if (participant) {
        participant.state = stateFromParticipantPayload(participantState);
      }
    }

    if (
      event.kind === "message.transcript_final" &&
      event.from === "human:rico"
    ) {
      const rico = participants.get("rico");
      if (rico) {
        rico.state = "speaking";
      }
    }

    if (event.kind === "routing.resolved") {
      const moderator = participants.get("moderator");
      if (moderator) {
        moderator.state = "idle";
      }
    }

    if (event.kind === "routing.warning") {
      const moderator = participants.get("moderator");
      if (moderator) {
        moderator.state = "blocked";
      }
    }
  }

  return [...participants.values()];
}

function deriveVoiceState(events: RoomEvent[]): {
  state: "started" | "ended" | "blocked";
  label: string;
  sessionId?: string;
  provider: string;
} {
  const latestVoiceEvent = [...events]
    .reverse()
    .find(
      (event) =>
        event.kind === "voice.session_started" ||
        event.kind === "voice.session_ended",
    );
  if (!latestVoiceEvent) {
    return {
      state: "ended",
      label: "voice disconnected · transcript mock",
      provider: "mock",
    };
  }

  const state =
    latestVoiceEvent.payload.state === "started" ||
    latestVoiceEvent.payload.state === "blocked"
      ? latestVoiceEvent.payload.state
      : "ended";
  const provider =
    typeof latestVoiceEvent.payload.provider === "string"
      ? latestVoiceEvent.payload.provider
      : "mock";
  const sessionId =
    typeof latestVoiceEvent.payload.sessionId === "string"
      ? latestVoiceEvent.payload.sessionId
      : undefined;
  const withSessionId = (value: {
    state: "started" | "ended" | "blocked";
    label: string;
    provider: string;
  }) => (sessionId ? { ...value, sessionId } : value);
  if (state === "started") {
    return withSessionId({
      state,
      label: `voice connected · ${provider}`,
      provider,
    });
  }
  if (state === "blocked") {
    return withSessionId({
      state,
      label: `voice blocked · ${provider}`,
      provider,
    });
  }
  return withSessionId({
    state,
    label: `voice disconnected · ${provider}`,
    provider,
  });
}

function participantViewFromPayload(
  value: unknown,
): ParticipantView | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const rawId = typeof record.id === "string" ? record.id : "";
  if (!rawId) {
    return undefined;
  }

  return {
    id: normalizeParticipantKey(rawId),
    name:
      typeof record.displayName === "string"
        ? record.displayName
        : normalizeParticipantKey(rawId),
    role: typeof record.kind === "string" ? record.kind : "participant",
    state: stateFromParticipantPayload(
      typeof record.state === "string" ? record.state : "idle",
    ),
    color: typeof record.color === "string" ? record.color : "#9aa4b2",
    voice: record.voiceEnabled === true,
  };
}

function stateFromParticipantPayload(value: string): AgentState {
  if (
    value === "idle" ||
    value === "reading" ||
    value === "thinking" ||
    value === "speaking" ||
    value === "blocked" ||
    value === "offline"
  ) {
    return value;
  }
  return "idle";
}

function normalizeParticipantKey(value: string): string {
  return value.replace(/^(agent|human|moderator|system):/, "");
}

function stateFromAgentStatus(status: string): AgentState {
  switch (status) {
    case "dispatch":
      return "reading";
    case "started":
    case "progress":
      return "thinking";
    case "blocked":
      return "blocked";
    case "completed":
    case "cancelled":
      return "idle";
    default:
      return "idle";
  }
}

function receiptVerificationFor(
  event: RoomEvent,
): ReceiptVerification | undefined {
  if (event.kind !== "receipt.created") {
    return undefined;
  }
  const verification = event.payload.verification;
  if (
    verification === "filesystem-verified" ||
    verification === "provider-reported" ||
    verification === "manual" ||
    verification === "unverified" ||
    verification === "failed"
  ) {
    return verification;
  }
  return undefined;
}

function receiptVerificationLabel(
  verification: ReceiptVerification | undefined,
): string {
  if (!verification) {
    return "unverified";
  }
  switch (verification) {
    case "filesystem-verified":
      return "filesystem verified";
    case "provider-reported":
      return "provider reported";
    case "manual":
      return "manual check";
    case "unverified":
      return "unverified";
    case "failed":
      return "verification failed";
  }
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing root element");
}

createRoot(root).render(<App />);
