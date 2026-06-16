import {
  AgentRuntime,
  fallbackPersonas,
  type AgentContextItem,
  type AgentPersona,
} from "@agent-room/agents-sdk";
import {
  createRoomEvent,
  parseRoomEvent,
  type Participant,
  type RoomEvent,
} from "@agent-room/room-events";
import { type ContextItemRecord } from "@agent-room/persistence";
import {
  applyModeratorInput,
  createModeratorState,
  type ModeratorState,
  type RoutingConfig,
} from "@agent-room/routing";
import { createLogger } from "./logger";

const logger = createLogger("room-hub");

export interface ClientSession {
  socket: RoomSocket;
  participant: Participant;
}

export interface RoomSocket {
  readonly readyState: number;
  send(payload: string): void;
}

export interface RoomEventStore {
  appendEvent(event: RoomEvent): void;
  getRoomHistory(roomId: string): RoomEvent[];
  listContextItems(roomId: string): ContextItemRecord[];
}

export interface RoomHubOptions {
  routingConfig?: RoutingConfig;
  store?: RoomEventStore;
  agentRuntime?: AgentRuntime;
  personas?: AgentPersona[];
}

export class RoomHub {
  private readonly clients = new Map<string, Map<RoomSocket, ClientSession>>();
  private readonly events = new Map<string, RoomEvent[]>();
  private readonly moderatorState = new Map<string, ModeratorState>();
  private readonly routingConfig: RoutingConfig;
  private readonly store: RoomEventStore | undefined;
  private readonly agentRuntime: AgentRuntime;

  constructor(options: RoomHubOptions = {}) {
    this.routingConfig =
      options.routingConfig ?? createDemoRoutingConfig(options.personas);
    this.store = options.store;
    this.agentRuntime =
      options.agentRuntime ??
      new AgentRuntime({ personas: options.personas ?? fallbackPersonas() });
  }

  connect(roomId: string, session: ClientSession): void {
    const clients =
      this.clients.get(roomId) ?? new Map<RoomSocket, ClientSession>();
    clients.set(session.socket, session);
    this.clients.set(roomId, clients);
    for (const event of this.history(roomId)) {
      if (session.socket.readyState === 1) {
        session.socket.send(JSON.stringify(event));
      }
    }
    this.publish(
      roomId,
      createRoomEvent({
        id: crypto.randomUUID(),
        roomId,
        kind: "participant.joined",
        from: "system:orchestrator",
        to: [session.participant.id],
        payload: { participant: session.participant },
      }),
    );
    logger.info("participant joined", {
      roomId,
      participantId: session.participant.id,
    });
  }

  disconnect(roomId: string, session: ClientSession): void {
    const clients = this.clients.get(roomId);
    clients?.delete(session.socket);
    this.publish(
      roomId,
      createRoomEvent({
        id: crypto.randomUUID(),
        roomId,
        kind: "participant.left",
        from: "system:orchestrator",
        to: [session.participant.id],
        payload: { participantId: session.participant.id },
      }),
    );
    logger.info("participant left", {
      roomId,
      participantId: session.participant.id,
    });
  }

  async ingest(roomId: string, raw: unknown): Promise<RoomEvent[]> {
    const event = parseRoomEvent(raw);
    if (event.roomId !== roomId) {
      throw new Error("room mismatch");
    }
    this.publish(roomId, event);

    if (!isRoutableMessage(event)) {
      return [event];
    }

    const currentState =
      this.moderatorState.get(roomId) ?? createModeratorState();
    const moderator = applyModeratorInput(
      event.payload.text,
      this.routingConfig,
      currentState,
    );
    this.moderatorState.set(roomId, moderator.state);
    const routing = moderator.decision;
    const routingEvent = createRoomEvent({
      id: crypto.randomUUID(),
      roomId,
      kind: routing.mode === "warning" ? "routing.warning" : "routing.resolved",
      from: "moderator:room",
      to: routing.targets,
      replyTo: event.id,
      payload: { ...routing },
    });
    this.publish(roomId, routingEvent);

    const cancelled = moderator.cancelled.map((entry) =>
      createRoomEvent({
        id: crypto.randomUUID(),
        roomId,
        kind: "agent.cancelled",
        from: "moderator:room",
        to: [entry.target],
        replyTo: event.id,
        payload: {
          agentId: entry.target,
          status: "cancelled",
          text: entry.text,
          reason: "interrupted by human",
        },
      }),
    );
    cancelled.forEach((cancelledEvent) => this.publish(roomId, cancelledEvent));

    const dispatches = moderator.queued.map((entry) =>
      createRoomEvent({
        id: crypto.randomUUID(),
        roomId,
        kind: "agent.dispatch",
        from: "moderator:room",
        to: [entry.target],
        replyTo: event.id,
        payload: {
          agentId: entry.target,
          status: "dispatch",
          text: entry.text,
        },
      }),
    );
    dispatches.forEach((dispatch) => this.publish(roomId, dispatch));
    const agentEvents: RoomEvent[] = [];
    for (const dispatch of dispatches) {
      const produced = await this.agentRuntime.runDispatch({
        roomId,
        dispatch,
        context: this.contextForMessage(roomId, event),
      });
      produced.forEach((producedEvent) => this.publish(roomId, producedEvent));
      agentEvents.push(...produced);
    }
    return [event, routingEvent, ...cancelled, ...dispatches, ...agentEvents];
  }

  history(roomId: string): RoomEvent[] {
    return this.store?.getRoomHistory(roomId) ?? this.events.get(roomId) ?? [];
  }

  clientCount(roomId: string): number {
    return this.clients.get(roomId)?.size ?? 0;
  }

  sendWarning(roomId: string, socket: RoomSocket, message: string): void {
    const warning = createRoomEvent({
      id: crypto.randomUUID(),
      roomId,
      kind: "routing.warning",
      from: "system:orchestrator",
      payload: {
        mode: "warning",
        targets: [],
        warnings: [message],
        normalizedText: "",
      },
    });
    socket.send(JSON.stringify(warning));
  }

  publishSystem(roomId: string, event: RoomEvent): void {
    this.publish(roomId, event);
  }

  private publish(roomId: string, event: RoomEvent): void {
    this.store?.appendEvent(event);
    const history = this.events.get(roomId) ?? [];
    if (!history.some((candidate) => candidate.id === event.id)) {
      history.push(event);
    }
    this.events.set(roomId, history);

    const payload = JSON.stringify(event);
    this.clients.get(roomId)?.forEach((session) => {
      if (session.socket.readyState === 1) {
        session.socket.send(payload);
      }
    });
  }

  private contextForMessage(
    roomId: string,
    event: RoomEvent,
  ): AgentContextItem[] {
    const contextIds = Array.isArray(event.payload.contextIds)
      ? event.payload.contextIds.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    if (contextIds.length === 0) {
      return [];
    }
    const contextItems = this.store?.listContextItems(roomId) ?? [];
    return contextItems
      .filter((item) => contextIds.includes(item.contextId))
      .map((item) => ({
        id: item.contextId,
        name: item.name,
        text: item.preview ?? item.name,
      }));
  }
}

type RoutableMessageEvent = RoomEvent & {
  payload: RoomEvent["payload"] & { text: string };
};

function isRoutableMessage(event: RoomEvent): event is RoutableMessageEvent {
  return (
    (event.kind === "message.created" ||
      event.kind === "message.transcript_final") &&
    typeof event.payload.text === "string"
  );
}

export function createDemoRoutingConfig(
  personas: AgentPersona[] = fallbackPersonas(),
): RoutingConfig {
  const activePersonas = personas.filter((persona) =>
    persona.participantId.startsWith("agent:"),
  );
  return {
    participants: activePersonas.map((persona) => ({
      id: persona.participantId,
      displayName: persona.displayName,
      routeNames: persona.routeNames,
      active: true,
    })),
    bothOrder: activePersonas
      .filter((persona) => persona.id === "bilby" || persona.id === "skippy")
      .map((persona) => persona.participantId),
    defaultTargets: [activePersonas[0]?.participantId ?? "agent:bilby"],
  };
}
