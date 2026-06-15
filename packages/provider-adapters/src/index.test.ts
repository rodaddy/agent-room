import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  blockedProviderResult,
  createMockLlmProvider,
  createMockSttProvider,
  createMockTtsProvider,
  createMockVoiceRoomProvider,
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

  test("mock voice room creates session without live provider", async () => {
    const provider = createMockVoiceRoomProvider();
    const result = await provider.createSession({
      roomId: "demo",
      participantId: "rico",
    });
    expect(result.value?.sessionId).toBe("mock-demo-rico");
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
