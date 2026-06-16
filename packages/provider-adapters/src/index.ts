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
  }): Promise<ProviderResult<VoiceSessionConfig>>;
  endSession(input: {
    sessionId: string;
  }): Promise<ProviderResult<{ ended: true }>>;
}

export interface VoiceSessionConfig {
  sessionId: string;
  transport: "mock" | "openai-realtime" | "livekit-webrtc";
  expiresAt: string;
  joinUrl?: string;
  token?: string;
  capabilities: string[];
}

export interface HttpLlmProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetchFn?: FetchFn;
  timeoutMs?: number;
}

type FetchFn = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>;

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

export function createOpenAiResponsesLlmProvider(
  options: HttpLlmProviderOptions = {},
): LlmProvider {
  const id = "openai-responses";
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const baseUrl = trimTrailingSlash(
    options.baseUrl ??
      process.env.OPENAI_BASE_URL ??
      "https://api.openai.com/v1",
  );
  const model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = providerTimeoutMs(options.timeoutMs);

  return {
    id,
    async complete(input) {
      if (!apiKey) {
        return blockedProviderResult(id, "OPENAI_API_KEY is not configured.");
      }
      return postJsonLlmRequest({
        id,
        fetchFn,
        url: `${baseUrl}/responses`,
        headers: { authorization: `Bearer ${apiKey}` },
        timeoutMs,
        body: {
          model,
          input: promptWithContext(input),
        },
        parseText: parseOpenAiResponsesText,
      });
    },
  };
}

export function createLiteLlmProvider(
  options: HttpLlmProviderOptions = {},
): LlmProvider {
  return createOpenAiCompatibleChatProvider({
    id: "litellm",
    apiKey: options.apiKey ?? process.env.LITELLM_API_KEY,
    baseUrl: options.baseUrl ?? process.env.LITELLM_BASE_URL,
    model: options.model ?? process.env.LITELLM_MODEL ?? "local/default",
    fetchFn: options.fetchFn ?? fetch,
    timeoutMs: providerTimeoutMs(options.timeoutMs),
    missingMessage: "LITELLM_BASE_URL is not configured.",
  });
}

export function createLocalHttpLlmProvider(
  options: HttpLlmProviderOptions = {},
): LlmProvider {
  return createOpenAiCompatibleChatProvider({
    id: "local-http-llm",
    apiKey: options.apiKey,
    baseUrl: options.baseUrl ?? process.env.LOCAL_MODEL_BASE_URL,
    model: options.model ?? process.env.LOCAL_MODEL_NAME ?? "local/default",
    fetchFn: options.fetchFn ?? fetch,
    timeoutMs: providerTimeoutMs(options.timeoutMs),
    missingMessage: "LOCAL_MODEL_BASE_URL is not configured.",
  });
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

function createOpenAiCompatibleChatProvider(input: {
  id: string;
  apiKey: string | undefined;
  baseUrl: string | undefined;
  model: string;
  fetchFn: FetchFn;
  timeoutMs: number;
  missingMessage: string;
}): LlmProvider {
  return {
    id: input.id,
    async complete(turn) {
      if (!input.baseUrl) {
        return blockedProviderResult(input.id, input.missingMessage);
      }
      const headers: Record<string, string> = {};
      if (input.apiKey) {
        headers.authorization = `Bearer ${input.apiKey}`;
      }
      return postJsonLlmRequest({
        id: input.id,
        fetchFn: input.fetchFn,
        url: `${trimTrailingSlash(input.baseUrl)}/chat/completions`,
        headers,
        timeoutMs: input.timeoutMs,
        body: {
          model: input.model,
          messages: [{ role: "user", content: promptWithContext(turn) }],
        },
        parseText: parseChatCompletionText,
      });
    },
  };
}

async function postJsonLlmRequest(input: {
  id: string;
  fetchFn: FetchFn;
  url: string;
  headers: Record<string, string>;
  timeoutMs: number;
  body: Record<string, unknown>;
  parseText: (payload: unknown) => string | undefined;
}): Promise<ProviderResult<{ text: string }>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await input.fetchFn(input.url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...input.headers,
      },
      body: JSON.stringify(input.body),
    });
    clearTimeout(timeout);
    if (!response.ok) {
      return {
        status: "error",
        provider: input.id,
        issue: {
          code: "provider_http_error",
          message: `${input.id} returned HTTP ${response.status}.`,
          retryable: response.status >= 500,
        },
      };
    }
    const text = input.parseText(await response.json());
    if (!text) {
      return {
        status: "error",
        provider: input.id,
        issue: {
          code: "provider_empty_response",
          message: `${input.id} returned no text.`,
          retryable: true,
        },
      };
    }
    return {
      status: "ok",
      provider: input.id,
      value: { text },
    };
  } catch (error) {
    clearTimeout(timeout);
    const timedOut =
      error instanceof DOMException && error.name === "AbortError";
    return {
      status: "error",
      provider: input.id,
      issue: {
        code: timedOut ? "provider_timeout" : "provider_request_failed",
        message: timedOut
          ? `${input.id} timed out after ${input.timeoutMs}ms.`
          : error instanceof Error
            ? error.message
            : "Provider request failed.",
        retryable: true,
      },
    };
  }
}

function providerTimeoutMs(configured: number | undefined): number {
  if (configured && Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  const fromEnv = Number.parseInt(
    process.env.LLM_PROVIDER_TIMEOUT_MS ?? "30000",
    10,
  );
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 30000;
}

function promptWithContext(input: LlmTurnInput): string {
  const context = input.context?.length
    ? [
        "Context:",
        ...input.context.map((item) => `- ${item.id}: ${item.text}`),
        "",
      ].join("\n")
    : "";
  return `${context}${input.prompt}`;
}

function parseOpenAiResponsesText(payload: unknown): string | undefined {
  if (isRecord(payload) && typeof payload.output_text === "string") {
    return payload.output_text;
  }
  const output =
    isRecord(payload) && Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const content =
      isRecord(item) && Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (isRecord(part) && typeof part.text === "string") {
        return part.text;
      }
    }
  }
  return undefined;
}

function parseChatCompletionText(payload: unknown): string | undefined {
  const choices =
    isRecord(payload) && Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0];
  const message = isRecord(first) ? first.message : undefined;
  const content = isRecord(message) ? message.content : undefined;
  return typeof content === "string" ? content : undefined;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
          transport: "mock",
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          capabilities: [
            "transcript-final",
            "spoken-response-toggle",
            "local-recovery",
          ],
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

export function createOpenAiRealtimeVoiceRoomProvider(): VoiceRoomProvider {
  const id = "openai-realtime";
  return createBlockedVoiceRoomProvider(
    id,
    "OpenAI Realtime voice is configured as an adapter slot but live sessions require OPENAI_API_KEY and LIVE_VOICE_PROVIDERS_ENABLED=1.",
  );
}

export function createLiveKitVoiceRoomProvider(): VoiceRoomProvider {
  const id = "livekit-webrtc";
  return createBlockedVoiceRoomProvider(
    id,
    "LiveKit/WebRTC voice is configured as an adapter slot but live token minting requires LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVE_VOICE_PROVIDERS_ENABLED=1.",
  );
}

function createBlockedVoiceRoomProvider(
  id: "openai-realtime" | "livekit-webrtc",
  message: string,
): VoiceRoomProvider {
  return {
    id,
    async createSession() {
      return blockedProviderResult(id, message);
    },
    async endSession() {
      return { status: "mocked", provider: id, value: { ended: true } };
    },
  };
}
