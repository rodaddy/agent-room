import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import YAML from "yaml";
import {
  createMockLlmProvider,
  type LlmProvider,
} from "@agent-room/provider-adapters";
import { createRoomEvent, type RoomEvent } from "@agent-room/room-events";

export interface AgentPersona {
  id: string;
  participantId: string;
  displayName: string;
  routeNames: string[];
  role: string;
  personaSourcePath?: string;
  metadataSourcePath?: string;
  configSourcePath?: string;
  promptPreview?: string;
  providerHints: string[];
  voiceHints: string[];
  toolHints: string[];
  safetyHints: string[];
}

export interface AgentContextItem {
  id: string;
  text: string;
  name?: string;
}

export interface AgentRuntimeOptions {
  personas: AgentPersona[];
  llmProvider?: LlmProvider;
}

export class AgentRuntime {
  private readonly personas = new Map<string, AgentPersona>();
  private readonly llmProvider: LlmProvider;

  constructor(options: AgentRuntimeOptions) {
    for (const persona of options.personas) {
      this.personas.set(persona.participantId, persona);
    }
    this.llmProvider = options.llmProvider ?? createMockLlmProvider();
  }

  getPersonas(): AgentPersona[] {
    return [...this.personas.values()];
  }

  async runDispatch(input: {
    roomId: string;
    dispatch: RoomEvent;
    context: AgentContextItem[];
  }): Promise<RoomEvent[]> {
    const agentId =
      typeof input.dispatch.payload.agentId === "string"
        ? input.dispatch.payload.agentId
        : (input.dispatch.to[0] ?? "");
    const text =
      typeof input.dispatch.payload.text === "string"
        ? input.dispatch.payload.text
        : "";
    const persona = this.personas.get(agentId);
    if (!agentId || !persona) {
      return [
        createAgentLifecycleEvent(
          input.roomId,
          agentId ?? "agent:unknown",
          "blocked",
          {
            replyTo: input.dispatch.id,
            text: "No configured persona was found for this dispatch.",
            reason: "missing_persona",
          },
        ),
      ];
    }

    const started = createAgentLifecycleEvent(
      input.roomId,
      agentId,
      "started",
      {
        replyTo: input.dispatch.id,
        text: `${persona.displayName} started.`,
      },
    );
    const progress = createAgentLifecycleEvent(
      input.roomId,
      agentId,
      "progress",
      {
        replyTo: input.dispatch.id,
        text: `${persona.displayName} loaded ${input.context.length} context item(s).`,
      },
    );
    const providerResult = await this.llmProvider.complete({
      roomId: input.roomId,
      agentId,
      prompt: buildPrompt(persona, text),
      context: input.context,
    });

    if (
      providerResult.status === "blocked" ||
      providerResult.status === "error"
    ) {
      return [
        started,
        progress,
        createAgentLifecycleEvent(input.roomId, agentId, "blocked", {
          replyTo: input.dispatch.id,
          text: providerResult.issue?.message ?? "Provider unavailable.",
          reason: providerResult.issue?.code ?? "provider_unavailable",
        }),
        createReceiptEvent(input.roomId, agentId, {
          replyTo: input.dispatch.id,
          label: `${persona.displayName} provider status`,
          summary: providerResult.issue?.message ?? "Provider unavailable.",
          verification: "failed",
        }),
      ];
    }

    if (!providerResult.value) {
      return [
        started,
        progress,
        createAgentLifecycleEvent(input.roomId, agentId, "blocked", {
          replyTo: input.dispatch.id,
          text: "Provider returned no value.",
          reason: "missing_provider_value",
        }),
      ];
    }
    const responseText = providerResult.value.text;
    return [
      started,
      progress,
      createAgentLifecycleEvent(input.roomId, agentId, "completed", {
        replyTo: input.dispatch.id,
        text: responseText,
      }),
      createReceiptEvent(input.roomId, agentId, {
        replyTo: input.dispatch.id,
        label: `${persona.displayName} response`,
        summary: `${providerResult.provider} returned a ${providerResult.status} response with ${input.context.length} context item(s).`,
        verification:
          providerResult.status === "mocked"
            ? "provider-reported"
            : "filesystem-verified",
        metadata: {
          provider: providerResult.provider,
          status: providerResult.status,
          ...(persona.personaSourcePath
            ? { personaSourcePath: persona.personaSourcePath }
            : {}),
        },
      }),
    ];
  }
}

export async function loadHermesPersonas(
  root: string,
): Promise<AgentPersona[]> {
  return loadHermesPersonasSync(root);
}

export function loadHermesPersonasSync(root: string): AgentPersona[] {
  const candidates = ["bilby", "skippy", "nagatha"];
  const personas: AgentPersona[] = [];
  for (const id of candidates) {
    const directory = join(root, id);
    const metadataSourcePath = join(directory, "agent.yaml");
    const configSourcePath = join(directory, "config.yaml");
    const personaSourcePath = join(directory, "agent.md");
    if (!existsSync(metadataSourcePath)) {
      continue;
    }
    const metadata = parseYamlRecord(readFileSync(metadataSourcePath, "utf8"));
    const config = existsSync(configSourcePath)
      ? parseYamlRecord(readFileSync(configSourcePath, "utf8"))
      : {};
    const personaText = existsSync(personaSourcePath)
      ? readFileSync(personaSourcePath, "utf8")
      : "";
    personas.push(
      normalizeHermesPersona({
        id,
        metadata,
        config,
        personaText,
        personaSourcePath,
        metadataSourcePath,
        ...(existsSync(configSourcePath) ? { configSourcePath } : {}),
      }),
    );
  }
  return personas;
}

export function fallbackPersonas(): AgentPersona[] {
  return [
    makeFallbackPersona("bilby", "Bilby", ["bilby", "builder"], "builder"),
    makeFallbackPersona("skippy", "Skippy", ["skippy", "scout"], "scout"),
    makeFallbackPersona("scribe", "Scribe", ["scribe"], "scribe"),
    makeFallbackPersona("tester", "Tester", ["tester"], "tester"),
  ];
}

function normalizeHermesPersona(input: {
  id: string;
  metadata: Record<string, unknown>;
  config: Record<string, unknown>;
  personaText: string;
  personaSourcePath: string;
  metadataSourcePath: string;
  configSourcePath?: string;
}): AgentPersona {
  const personaRecord = asRecord(input.metadata.persona);
  const displayName =
    stringAt(personaRecord, "name") ??
    titleCase(stringAt(input.metadata, "agent") ?? input.id);
  const role =
    stringAt(input.metadata, "role") ??
    stringAt(input.config, "role") ??
    input.id;
  const routeNames = orderedUnique([
    input.id,
    displayName.toLowerCase(),
    role.toLowerCase(),
    ...arrayOfStrings(input.config.routeNames),
  ]);
  const persona: AgentPersona = {
    id: input.id,
    participantId: `agent:${input.id}`,
    displayName,
    routeNames,
    role,
    personaSourcePath: input.personaSourcePath,
    metadataSourcePath: input.metadataSourcePath,
    providerHints: safeTopLevelHints(input.config, [
      "model",
      "providers",
      "fallback_providers",
    ]),
    voiceHints: safeTopLevelHints(input.config, ["voice", "stt", "tts"]),
    toolHints: safeTopLevelHints(input.config, ["toolsets", "tools", "skills"]),
    safetyHints: safeTopLevelHints(input.config, [
      "approvals",
      "security",
      "privacy",
    ]),
  };
  const promptPreview = firstNonEmptyMarkdownLine(input.personaText);
  if (input.configSourcePath) {
    persona.configSourcePath = input.configSourcePath;
  }
  if (promptPreview) {
    persona.promptPreview = promptPreview;
  }
  return persona;
}

function parseYamlRecord(text: string): Record<string, unknown> {
  const parsed = YAML.parse(text) as unknown;
  return asRecord(parsed);
}

function makeFallbackPersona(
  id: string,
  displayName: string,
  routeNames: string[],
  role: string,
): AgentPersona {
  return {
    id,
    participantId: `agent:${id}`,
    displayName,
    routeNames,
    role,
    providerHints: ["mock"],
    voiceHints: ["mock"],
    toolHints: [],
    safetyHints: ["local-only"],
  };
}

function buildPrompt(persona: AgentPersona, text: string): string {
  return [
    `${persona.displayName} role: ${persona.role}`,
    persona.promptPreview
      ? `Persona source preview: ${persona.promptPreview}`
      : "",
    text,
  ]
    .filter(Boolean)
    .join("\n");
}

function createAgentLifecycleEvent(
  roomId: string,
  agentId: string,
  status: "started" | "progress" | "completed" | "blocked",
  options: { replyTo: string; text: string; reason?: string },
): RoomEvent {
  return createRoomEvent({
    id: crypto.randomUUID(),
    roomId,
    kind: `agent.${status}`,
    from: agentId,
    to: ["human:rico"],
    replyTo: options.replyTo,
    payload: {
      agentId,
      status,
      text: options.text,
      reason: options.reason,
    },
  });
}

function createReceiptEvent(
  roomId: string,
  agentId: string,
  input: {
    replyTo: string;
    label: string;
    summary: string;
    verification:
      | "filesystem-verified"
      | "provider-reported"
      | "manual"
      | "unverified"
      | "failed";
    metadata?: Record<string, unknown>;
  },
): RoomEvent {
  return createRoomEvent({
    id: crypto.randomUUID(),
    roomId,
    kind: "receipt.created",
    from: agentId,
    replyTo: input.replyTo,
    payload: {
      label: input.label,
      summary: input.summary,
      verification: input.verification,
      metadata: input.metadata ?? {},
    },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringAt(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function safeTopLevelHints(
  record: Record<string, unknown>,
  keys: string[],
): string[] {
  return keys.filter((key) =>
    Object.prototype.hasOwnProperty.call(record, key),
  );
}

function firstNonEmptyMarkdownLine(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find(Boolean);
}

function titleCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function orderedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
