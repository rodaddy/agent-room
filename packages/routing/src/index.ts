export interface RouteParticipant {
  id: string;
  displayName: string;
  routeNames: string[];
  active: boolean;
}

export interface RoutingConfig {
  participants: RouteParticipant[];
  bothOrder: string[];
  defaultTargets: string[];
  lastSpokeAgentId?: string;
}

export type RoutingMode =
  | "dispatch"
  | "broadcast"
  | "interrupt"
  | "hold"
  | "warning";

export interface RoutingDecision {
  mode: RoutingMode;
  targets: string[];
  warnings: string[];
  normalizedText: string;
}

export interface QueueEntry {
  id: string;
  target: string;
  text: string;
  cancellable: boolean;
}

export interface ModeratorState {
  held: boolean;
  queue: QueueEntry[];
}

export interface ModeratorResult {
  state: ModeratorState;
  decision: RoutingDecision;
  cancelled: QueueEntry[];
  queued: QueueEntry[];
}

const interruptPhrases = new Set(["stop", "pause", "hold", "shut up"]);

export function resolveRouting(
  text: string,
  config: RoutingConfig,
): RoutingDecision {
  const normalizedText = text.trim();
  const lower = normalizedText.toLowerCase();

  if (interruptPhrases.has(lower)) {
    return {
      mode: lower === "hold" ? "hold" : "interrupt",
      targets: [],
      warnings: [],
      normalizedText,
    };
  }

  const activeAgents = config.participants.filter(
    (participant) => participant.active,
  );
  const mentions = extractMentions(normalizedText);

  if (mentions.includes("all")) {
    return {
      mode: "broadcast",
      targets: activeAgents.map((participant) => participant.id),
      warnings: [],
      normalizedText,
    };
  }

  const explicitTargets = orderedUnique([
    ...mentions.flatMap((mention) => findParticipantIds(mention, activeAgents)),
    ...findNaturalNameTargets(normalizedText, activeAgents),
  ]);

  const unknownMentions = mentions.filter(
    (mention) =>
      mention !== "all" &&
      findParticipantIds(mention, activeAgents).length === 0,
  );

  if (unknownMentions.length > 0) {
    return {
      mode: "warning",
      targets: [],
      warnings: unknownMentions.map(
        (mention) => `Unknown route target: @${mention}`,
      ),
      normalizedText,
    };
  }

  if (explicitTargets.length > 0) {
    return {
      mode: "dispatch",
      targets: explicitTargets,
      warnings: [],
      normalizedText,
    };
  }

  if (/\bboth\b/i.test(normalizedText)) {
    return {
      mode: "dispatch",
      targets: config.bothOrder.filter((id) =>
        activeAgents.some((agent) => agent.id === id),
      ),
      warnings: [],
      normalizedText,
    };
  }

  const defaultTargets = inferDefaultTargets(config, activeAgents);
  if (defaultTargets.length === 0) {
    return {
      mode: "warning",
      targets: [],
      warnings: ["No active route target is configured."],
      normalizedText,
    };
  }

  return {
    mode: "dispatch",
    targets: defaultTargets,
    warnings: [],
    normalizedText,
  };
}

export function createModeratorState(): ModeratorState {
  return { held: false, queue: [] };
}

export function applyModeratorInput(
  text: string,
  config: RoutingConfig,
  state: ModeratorState,
): ModeratorResult {
  const decision = resolveRouting(text, config);
  if (decision.mode === "hold") {
    return {
      state: { ...state, held: true },
      decision,
      cancelled: [],
      queued: [],
    };
  }
  if (decision.mode === "interrupt") {
    const cancelled = state.queue.filter((entry) => entry.cancellable);
    return {
      state: {
        held: false,
        queue: state.queue.filter((entry) => !entry.cancellable),
      },
      decision,
      cancelled,
      queued: [],
    };
  }
  if (decision.mode !== "dispatch" && decision.mode !== "broadcast") {
    return { state, decision, cancelled: [], queued: [] };
  }

  const queued = decision.targets.map((target) => ({
    id: crypto.randomUUID(),
    target,
    text: decision.normalizedText,
    cancellable: true,
  }));
  return {
    state: { ...state, queue: [...state.queue, ...queued] },
    decision,
    cancelled: [],
    queued,
  };
}

function extractMentions(text: string): string[] {
  return [...text.matchAll(/@([a-zA-Z0-9_-]+)/g)]
    .map((match) => match[1]?.toLowerCase())
    .filter(Boolean) as string[];
}

function findParticipantIds(
  routeName: string,
  participants: RouteParticipant[],
): string[] {
  const normalized = normalizeRouteName(routeName);
  return participants
    .filter((participant) =>
      [participant.displayName, ...participant.routeNames].some(
        (candidate) => normalizeRouteName(candidate) === normalized,
      ),
    )
    .map((participant) => participant.id);
}

function findNaturalNameTargets(
  text: string,
  participants: RouteParticipant[],
): string[] {
  return participants
    .filter((participant) =>
      [participant.displayName, ...participant.routeNames].some((candidate) =>
        new RegExp(`^${escapeRegExp(candidate)}\\b[:,]?`, "i").test(text),
      ),
    )
    .map((participant) => participant.id);
}

function inferDefaultTargets(
  config: RoutingConfig,
  activeAgents: RouteParticipant[],
): string[] {
  if (config.lastSpokeAgentId && config.bothOrder.length > 1) {
    const next = config.bothOrder.find(
      (id) =>
        id !== config.lastSpokeAgentId &&
        activeAgents.some((agent) => agent.id === id),
    );
    if (next) {
      return [next];
    }
  }

  return config.defaultTargets.filter((id) =>
    activeAgents.some((agent) => agent.id === id),
  );
}

function orderedUnique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeRouteName(value: string): string {
  return value.toLowerCase().replace(/^@/, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
