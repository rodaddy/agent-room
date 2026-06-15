import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Mic, Pause, Radio, Send, Square, Volume2 } from "lucide-react";
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
    id: "mock_human_1",
    roomId: "demo",
    kind: "message.created",
    from: "human:rico",
    to: ["agent:bilby", "agent:skippy"],
    payload: {
      text: "@bilby @skippy sketch the MVP pass and keep receipts visible.",
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
    id: "mock_voice_1",
    roomId: "demo",
    kind: "voice.session_started",
    from: "system:voice",
    payload: {
      sessionId: "mock-voice-session",
      provider: "mock",
      state: "started",
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
    id: "mock_voice_2",
    roomId: "demo",
    kind: "message.transcript_final",
    from: "human:rico",
    payload: {
      text: "both pause for a second",
      source: "voice",
      confidence: 0.86,
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

const contextItems = [
  { name: "docs/PRD.md", type: "source", size: "room events core" },
  {
    name: "docs/goal-mvp-pass-1.md",
    type: "run contract",
    size: "issues #1-#5",
  },
  {
    name: "sample-interface.png",
    type: "visual ref",
    size: "dense room layout",
  },
];

function App() {
  const [message, setMessage] = useState(
    "@bilby summarize the current workspace receipts",
  );
  const [events, setEvents] = useState<RoomEvent[]>(initialEvents);
  const routeChips = useMemo(() => extractRouteChips(message), [message]);
  const participants = useMemo(
    () => deriveParticipantViews(baseParticipants, events),
    [events],
  );
  const voiceState = useMemo(() => deriveVoiceState(events), [events]);

  function appendEvent(event: RoomEvent): void {
    setEvents((current) => [...current, event]);
  }

  function sendMessage(): void {
    const event = createRoomEvent({
      id: crypto.randomUUID(),
      roomId: "demo",
      kind: "message.created",
      from: "human:rico",
      payload: { text: message },
    });
    appendEvent(event);
    sendToOrchestrator(event, appendEvent);
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
            <button className="inactive" title="Connect voice">
              <Radio size={17} />
            </button>
            <button className="inactive" title="Push to talk">
              <Mic size={17} />
            </button>
            <button className="active" title="Spoken replies">
              <Volume2 size={17} />
            </button>
            <button className="inactive" title="Hold">
              <Pause size={17} />
            </button>
            <button className="danger" title="Stop">
              <Square size={17} />
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
              {receiptVerificationFor(event) ? (
                <span
                  className={`receipt-chip receipt-${receiptVerificationFor(event)}`}
                >
                  {receiptVerificationLabel(receiptVerificationFor(event))}
                </span>
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
          <p>/app/workspace · mock</p>
        </header>
        {contextItems.map((item) => (
          <section className="context-item" key={item.name}>
            <strong>{item.name}</strong>
            <span>{item.type}</span>
            <small>{item.size}</small>
          </section>
        ))}
        <section className="preview">
          <h3>Selected Preview</h3>
          <pre>{`receipt.created
label: room.event.v1
verification: filesystem-verified
status: visible in room timeline`}</pre>
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
} {
  const latestVoiceEvent = [...events]
    .reverse()
    .find(
      (event) =>
        event.kind === "voice.session_started" ||
        event.kind === "voice.session_ended",
    );
  if (!latestVoiceEvent) {
    return { state: "ended", label: "voice disconnected · transcript mock" };
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
  if (state === "started") {
    return { state, label: `voice connected · ${provider}` };
  }
  if (state === "blocked") {
    return { state, label: `voice blocked · ${provider}` };
  }
  return { state, label: `voice disconnected · ${provider}` };
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
