import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  blockedProviderResult,
  createLiteLlmProvider,
  createLiveKitVoiceRoomProvider,
  createLocalHttpLlmProvider,
  createMockLlmProvider,
  createMockSttProvider,
  createMockTtsProvider,
  createMockVoiceRoomProvider,
  createOpenAiRealtimeVoiceRoomProvider,
  createOpenAiResponsesLlmProvider,
  normalizeProviderResult,
} from "./index";

describe("provider adapters", () => {
  test("mock LLM returns deterministic output", async () => {
    const provider = createMockLlmProvider();
    const result = await provider.complete({
      roomId: "room_demo",
      agentId: "agent:bilby",
      prompt: "hello",
    });

    expect(result.status).toBe("mocked");
    expect(result.value?.text).toContain("hello");
  });

  test("blocked result has safe error shape", () => {
    const result = blockedProviderResult(
      "openai",
      "OPENAI_API_KEY is not configured",
    );
    expect(result.status).toBe("blocked");
    expect(result.issue?.code).toBe("provider_unavailable");
  });

  test("OpenAI Responses provider blocks safely without a key", async () => {
    const provider = createOpenAiResponsesLlmProvider({ apiKey: "" });
    const result = await provider.complete({
      roomId: "demo",
      agentId: "agent:skippy",
      prompt: "hello",
    });

    expect(result.status).toBe("blocked");
    expect(result.issue?.message).toBe("OPENAI_API_KEY is not configured.");
  });

  test("OpenAI Responses provider parses output text", async () => {
    const requests: unknown[] = [];
    const provider = createOpenAiResponsesLlmProvider({
      apiKey: "test-key",
      baseUrl: "https://example.test/v1/",
      model: "test-model",
      fetchFn: async (url, init) => {
        requests.push({ url, init });
        return Response.json({ output_text: "done" });
      },
    });

    const result = await provider.complete({
      roomId: "demo",
      agentId: "agent:bilby",
      prompt: "summarize",
      context: [{ id: "ctx_1", text: "keep receipts" }],
    });

    expect(result.status).toBe("ok");
    expect(result.value?.text).toBe("done");
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests[0])).toContain(
      "https://example.test/v1/responses",
    );
    expect(JSON.stringify(requests[0])).toContain("ctx_1");
  });

  test("LiteLLM and local providers use OpenAI-compatible chat completions", async () => {
    const urls: string[] = [];
    const fetchFn = async (url: Parameters<typeof fetch>[0]) => {
      urls.push(String(url));
      return Response.json({
        choices: [{ message: { content: "compatible response" } }],
      });
    };

    const litellm = await createLiteLlmProvider({
      baseUrl: "http://litellm.test",
      apiKey: "test-key",
      fetchFn,
    }).complete({
      roomId: "demo",
      agentId: "agent:skippy",
      prompt: "route",
    });
    const local = await createLocalHttpLlmProvider({
      baseUrl: "http://local-model.test/",
      fetchFn,
    }).complete({
      roomId: "demo",
      agentId: "agent:tester",
      prompt: "check",
    });

    expect(litellm.value?.text).toBe("compatible response");
    expect(local.value?.text).toBe("compatible response");
    expect(urls).toEqual([
      "http://litellm.test/chat/completions",
      "http://local-model.test/chat/completions",
    ]);
  });

  test("HTTP LLM providers return a timeout result instead of hanging", async () => {
    const provider = createLiteLlmProvider({
      baseUrl: "http://litellm.test",
      timeoutMs: 1,
      fetchFn: (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    });

    const result = await provider.complete({
      roomId: "demo",
      agentId: "agent:skippy",
      prompt: "hang",
    });

    expect(result.status).toBe("error");
    expect(result.issue?.code).toBe("provider_timeout");
  });

  test("mock voice room creates session without live provider", async () => {
    const provider = createMockVoiceRoomProvider();
    const result = await provider.createSession({
      roomId: "demo",
      participantId: "rico",
    });
    expect(result.value?.sessionId).toBe("mock-demo-rico");
    expect(result.value?.transport).toBe("mock");
    expect(result.value?.capabilities).toContain("transcript-final");
    expect(result.value?.expiresAt).toMatch(/T/);
  });

  test("live voice room slots fail closed until explicitly implemented", async () => {
    const realtime =
      await createOpenAiRealtimeVoiceRoomProvider().createSession({
        roomId: "demo",
        participantId: "rico",
      });
    const livekit = await createLiveKitVoiceRoomProvider().createSession({
      roomId: "demo",
      participantId: "rico",
    });

    expect(realtime.status).toBe("blocked");
    expect(realtime.provider).toBe("openai-realtime");
    expect(realtime.issue?.message).toContain("LIVE_VOICE_PROVIDERS_ENABLED");
    expect(livekit.status).toBe("blocked");
    expect(livekit.provider).toBe("livekit-webrtc");
    expect(livekit.issue?.message).toContain("LIVEKIT_URL");
  });

  test("mock STT and TTS providers expose low-fidelity fixture paths", async () => {
    const stt = await createMockSttProvider().transcribe({
      audio: new Uint8Array([1]),
      mimeType: "audio/wav",
    });
    const tts = await createMockTtsProvider().synthesize({ text: "hello" });
    expect(stt.value?.text).toContain("audio/wav");
    expect(tts.value?.mimeType).toBe("audio/wav");
  });

  test("normalizer rejects successful results without values", () => {
    expect(() =>
      normalizeProviderResult("mock", z.object({ text: z.string() }), {
        status: "ok",
        provider: "mock",
      }),
    ).toThrow();
  });

  test("normalizer accepts blocked secret-safe issue shapes", () => {
    const result = normalizeProviderResult(
      "mock",
      z.object({ text: z.string() }),
      {
        status: "blocked",
        provider: "mock",
        issue: {
          code: "missing_key",
          message: "Provider key is not configured",
          retryable: false,
        },
      },
    );
    expect(result.issue?.message).not.toContain("sk-");
  });
});
