import { z } from "zod";

export type ProviderStatus = "ok" | "mocked" | "blocked" | "error";

export const providerIssueSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
});

export const providerStatusSchema = z.enum([
  "ok",
  "mocked",
  "blocked",
  "error",
]);

export interface ProviderIssue {
  code: string;
  message: string;
  retryable: boolean;
}

export interface ProviderResult<T> {
  status: ProviderStatus;
  provider: string;
  value?: T;
  issue?: ProviderIssue;
}

export function normalizeProviderResult<T>(
  provider: string,
  valueSchema: z.ZodType<T>,
  input: unknown,
): ProviderResult<T> {
  const schema = z
    .object({
      status: providerStatusSchema,
      provider: z.string().min(1).default(provider),
      value: valueSchema.optional(),
      issue: providerIssueSchema.optional(),
    })
    .refine(
      (result) =>
        (result.status === "ok" || result.status === "mocked") ===
        Boolean(result.value),
      {
        message:
          "successful provider results require value and blocked/error results must not include value",
      },
    )
    .refine(
      (result) =>
        (result.status === "blocked" || result.status === "error") ===
        Boolean(result.issue),
      {
        message:
          "blocked/error provider results require issue and successful results must not include issue",
      },
    );

  const parsed = schema.parse(input);
  if (parsed.status === "ok" || parsed.status === "mocked") {
    return {
      status: parsed.status,
      provider: parsed.provider,
      value: parsed.value as T,
    };
  }

  return {
    status: parsed.status,
    provider: parsed.provider,
    issue: parsed.issue as ProviderIssue,
  };
}

export interface LlmTurnInput {
  roomId: string;
  agentId: string;
  prompt: string;
  context?: ReadonlyArray<{ id: string; text: string }>;
}

export interface LlmProvider {
  readonly id: string;
  complete(input: LlmTurnInput): Promise<ProviderResult<{ text: string }>>;
}

export interface SttProvider {
  readonly id: string;
  transcribe(input: {
    audio: Uint8Array;
    mimeType: string;
  }): Promise<ProviderResult<{ text: string; confidence?: number }>>;
}

export interface TtsProvider {
  readonly id: string;
  synthesize(input: {
    text: string;
    voiceId?: string;
  }): Promise<ProviderResult<{ audio: Uint8Array; mimeType: string }>>;
}

export interface VoiceRoomProvider {
  readonly id: string;
  createSession(input: {
    roomId: string;
    participantId: string;
  }): Promise<ProviderResult<{ sessionId: string; joinUrl?: string }>>;
  endSession(input: {
    sessionId: string;
  }): Promise<ProviderResult<{ ended: true }>>;
}

export function blockedProviderResult<T>(
  provider: string,
  message: string,
): ProviderResult<T> {
  return {
    status: "blocked",
    provider,
    issue: {
      code: "provider_unavailable",
      message,
      retryable: false,
    },
  };
}

export function createMockLlmProvider(id = "mock-llm"): LlmProvider {
  return {
    id,
    async complete(input) {
      return {
        status: "mocked",
        provider: id,
        value: {
          text: `${input.agentId} received: ${input.prompt}`,
        },
      };
    },
  };
}

export function createMockSttProvider(id = "mock-stt"): SttProvider {
  return {
    id,
    async transcribe(input) {
      return {
        status: "mocked",
        provider: id,
        value: {
          text: `mock transcript for ${input.mimeType}`,
          confidence: 0.5,
        },
      };
    },
  };
}

export function createMockTtsProvider(id = "mock-tts"): TtsProvider {
  return {
    id,
    async synthesize() {
      return {
        status: "mocked",
        provider: id,
        value: {
          audio: new Uint8Array([0, 1, 2, 3]),
          mimeType: "audio/wav",
        },
      };
    },
  };
}

export function createMockVoiceRoomProvider(
  id = "mock-voice-room",
): VoiceRoomProvider {
  return {
    id,
    async createSession(input) {
      return {
        status: "mocked",
        provider: id,
        value: {
          sessionId: `mock-${input.roomId}-${input.participantId}`,
        },
      };
    },
    async endSession() {
      return {
        status: "mocked",
        provider: id,
        value: { ended: true },
      };
    },
  };
}
