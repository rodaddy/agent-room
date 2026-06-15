import {
  createRoomEvent,
  parseRoomEvent,
  type Participant,
  type RoomEvent,
} from "@agent-room/room-events";
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

export class RoomHub {
  private readonly clients = new Map<string, Map<RoomSocket, ClientSession>>();
  private readonly events = new Map<string, RoomEvent[]>();
  private readonly moderatorState = new Map<string, ModeratorState>();
  private readonly routingConfig: RoutingConfig;

  constructor(routingConfig: RoutingConfig = createDemoRoutingConfig()) {
    this.routingConfig = routingConfig;
  }

  connect(roomId: string, session: ClientSession): void {
    const clients =
      this.clients.get(roomId) ?? new Map<RoomSocket, ClientSession>();
    clients.set(session.socket, session);
    this.clients.set(roomId, clients);
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

  ingest(roomId: string, raw: unknown): RoomEvent[] {
    const event = parseRoomEvent(raw);
    if (event.roomId !== roomId) {
      throw new Error("room mismatch");
    }
    this.publish(roomId, event);

    if (
      event.kind !== "message.created" ||
      typeof event.payload.text !== "string"
    ) {
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
    return [event, routingEvent, ...cancelled, ...dispatches];
  }

  history(roomId: string): RoomEvent[] {
    return this.events.get(roomId) ?? [];
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

  private publish(roomId: string, event: RoomEvent): void {
    const history = this.events.get(roomId) ?? [];
    history.push(event);
    this.events.set(roomId, history);

    const payload = JSON.stringify(event);
    this.clients.get(roomId)?.forEach((session) => {
      if (session.socket.readyState === 1) {
        session.socket.send(payload);
      }
    });
  }
}

export function createDemoRoutingConfig(): RoutingConfig {
  return {
    participants: [
      {
        id: "agent:bilby",
        displayName: "Bilby",
        routeNames: ["bilby", "builder"],
        active: true,
      },
      {
        id: "agent:skippy",
        displayName: "Skippy",
        routeNames: ["skippy", "scout"],
        active: true,
      },
      {
        id: "agent:scribe",
        displayName: "Scribe",
        routeNames: ["scribe"],
        active: true,
      },
      {
        id: "agent:tester",
        displayName: "Tester",
        routeNames: ["tester"],
        active: true,
      },
    ],
    bothOrder: ["agent:bilby", "agent:skippy"],
    defaultTargets: ["agent:bilby"],
  };
}
