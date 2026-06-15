import { z } from "zod";

export const roomEventSchemaVersion = "room.event.v1" as const;

export const participantKindSchema = z.enum([
  "human",
  "agent",
  "moderator",
  "system",
]);
export const participantStateSchema = z.enum([
  "idle",
  "reading",
  "thinking",
  "speaking",
  "blocked",
  "offline",
]);

export const participantSchema = z.object({
  id: z.string().min(1),
  kind: participantKindSchema,
  displayName: z.string().min(1),
  routeNames: z.array(z.string().min(1)).default([]),
  state: participantStateSchema.default("idle"),
  color: z.string().optional(),
  voiceEnabled: z.boolean().default(false),
});

export type Participant = z.infer<typeof participantSchema>;
export type ParticipantState = z.infer<typeof participantStateSchema>;

export const receiptVerificationSchema = z.enum([
  "filesystem-verified",
  "provider-reported",
  "manual",
  "unverified",
  "failed",
]);

export const roomEventKindSchema = z.enum([
  "room.created",
  "participant.joined",
  "participant.left",
  "participant.state_changed",
  "message.created",
  "message.transcript_partial",
  "message.transcript_final",
  "routing.resolved",
  "routing.warning",
  "agent.dispatch",
  "agent.started",
  "agent.progress",
  "agent.completed",
  "agent.blocked",
  "agent.cancelled",
  "receipt.created",
  "context.attached",
  "workspace.file_observed",
  "workspace.file_changed",
  "voice.session_started",
  "voice.session_ended",
  "handoff.created",
]);

export type RoomEventKind = z.infer<typeof roomEventKindSchema>;

const basePayloadSchema = z.record(z.string(), z.unknown());

export const messagePayloadSchema = z.object({
  text: z.string(),
  source: z.enum(["text", "voice", "system"]).default("text"),
  contextIds: z.array(z.string()).default([]),
});

export const transcriptPayloadSchema = messagePayloadSchema.extend({
  source: z.literal("voice"),
  confidence: z.number().min(0).max(1).optional(),
});

export const routingPayloadSchema = z.object({
  mode: z.enum(["dispatch", "broadcast", "interrupt", "hold", "warning"]),
  targets: z.array(z.string()),
  warnings: z.array(z.string()).default([]),
  normalizedText: z.string(),
});

export const agentLifecyclePayloadSchema = z.object({
  agentId: z.string().min(1),
  status: z.enum([
    "dispatch",
    "started",
    "progress",
    "completed",
    "blocked",
    "cancelled",
  ]),
  text: z.string().optional(),
  reason: z.string().optional(),
});

export const receiptPayloadSchema = z.object({
  label: z.string().min(1),
  summary: z.string().min(1),
  verification: receiptVerificationSchema,
  artifactId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const contextPayloadSchema = z.object({
  contextId: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["snippet", "file", "url", "note"]),
  preview: z.string().optional(),
  bytes: z.number().int().nonnegative().optional(),
});

export const voiceSessionPayloadSchema = z.object({
  sessionId: z.string().min(1),
  provider: z.string().min(1),
  state: z.enum(["started", "ended", "blocked"]),
  reason: z.string().optional(),
});

export const handoffPayloadSchema = z.object({
  target: z.enum(["local", "hermes", "discord"]),
  summary: z.string(),
  actionItems: z.array(z.string()).default([]),
  blockers: z.array(z.string()).default([]),
  artifactPath: z.string().optional(),
});

export const roomEventSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(roomEventSchemaVersion),
  roomId: z.string().min(1),
  threadId: z.string().min(1).optional(),
  kind: roomEventKindSchema,
  from: z.string().min(1),
  to: z.array(z.string()).default([]),
  replyTo: z.string().optional(),
  createdAt: z.string().datetime(),
  payload: basePayloadSchema.default({}),
});

export type RoomEvent = z.infer<typeof roomEventSchema>;
export type ReceiptVerification = z.infer<typeof receiptVerificationSchema>;
export type SafeParseRoomEventResult =
  | { success: true; data: RoomEvent }
  | { success: false; error: z.ZodError };

export type CreateRoomEventInput = Omit<
  RoomEvent,
  "schemaVersion" | "createdAt" | "to"
> & {
  createdAt?: string;
  to?: string[];
};

export function createRoomEvent(input: CreateRoomEventInput): RoomEvent {
  return parseRoomEvent({
    ...input,
    schemaVersion: roomEventSchemaVersion,
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
}

export function parseRoomEvent(value: unknown): RoomEvent {
  const event = roomEventSchema.parse(value);
  payloadSchemaForKind(event.kind).parse(event.payload);
  return event;
}

export function safeParseRoomEvent(value: unknown): SafeParseRoomEventResult {
  const envelope = roomEventSchema.safeParse(value);
  if (!envelope.success) {
    return envelope;
  }
  const payload = payloadSchemaForKind(envelope.data.kind).safeParse(
    envelope.data.payload,
  );
  if (!payload.success) {
    return {
      success: false,
      error: payload.error,
    };
  }
  return envelope;
}

function payloadSchemaForKind(kind: RoomEventKind): z.ZodType {
  switch (kind) {
    case "message.created":
      return messagePayloadSchema;
    case "message.transcript_partial":
    case "message.transcript_final":
      return transcriptPayloadSchema;
    case "routing.resolved":
    case "routing.warning":
      return routingPayloadSchema;
    case "agent.dispatch":
    case "agent.started":
    case "agent.progress":
    case "agent.completed":
    case "agent.blocked":
    case "agent.cancelled":
      return agentLifecyclePayloadSchema;
    case "receipt.created":
      return receiptPayloadSchema;
    case "context.attached":
    case "workspace.file_observed":
    case "workspace.file_changed":
      return contextPayloadSchema;
    case "voice.session_started":
    case "voice.session_ended":
      return voiceSessionPayloadSchema;
    case "handoff.created":
      return handoffPayloadSchema;
    case "room.created":
    case "participant.joined":
    case "participant.left":
    case "participant.state_changed":
      return basePayloadSchema;
  }
}
