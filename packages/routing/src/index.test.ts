import { describe, expect, test } from "bun:test";
import {
  applyModeratorInput,
  createModeratorState,
  resolveRouting,
  type RoutingConfig,
} from "./index";

const config: RoutingConfig = {
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
      active: false,
    },
  ],
  bothOrder: ["agent:bilby", "agent:skippy"],
  defaultTargets: ["agent:bilby"],
};

describe("routing", () => {
  test("@all broadcasts to active agents only", () => {
    expect(resolveRouting("@all status", config).targets).toEqual([
      "agent:bilby",
      "agent:skippy",
    ]);
  });

  test("direct mention routes to one agent", () => {
    expect(resolveRouting("@bilby summarize", config)).toMatchObject({
      mode: "dispatch",
      targets: ["agent:bilby"],
    });
  });

  test("multiple mentions preserve explicit order", () => {
    expect(resolveRouting("@skippy @bilby compare", config).targets).toEqual([
      "agent:skippy",
      "agent:bilby",
    ]);
  });

  test("natural names route when unambiguous", () => {
    expect(resolveRouting("Bilby, what changed?", config).targets).toEqual([
      "agent:bilby",
    ]);
  });

  test("both expands configured order", () => {
    expect(resolveRouting("both weigh in", config).targets).toEqual([
      "agent:bilby",
      "agent:skippy",
    ]);
  });

  test("interrupt commands cancel queue", () => {
    expect(resolveRouting("stop", config)).toMatchObject({
      mode: "interrupt",
      targets: [],
    });
    expect(resolveRouting("hold", config)).toMatchObject({
      mode: "hold",
      targets: [],
    });
  });

  test("unknown mention warns without silent dispatch", () => {
    const decision = resolveRouting("@nobody go", config);
    expect(decision.mode).toBe("warning");
    expect(decision.warnings[0]).toContain("@nobody");
  });

  test("mixed unknown mention warns without partial dispatch", () => {
    const decision = resolveRouting("@bilby @nobody go", config);
    expect(decision.mode).toBe("warning");
    expect(decision.targets).toEqual([]);
  });

  test("ambiguous text alternates from last speaker when configured", () => {
    expect(
      resolveRouting("what next?", {
        ...config,
        lastSpokeAgentId: "agent:bilby",
      }).targets,
    ).toEqual(["agent:skippy"]);
  });

  test("moderator queues dispatch and cancels on stop", () => {
    const first = applyModeratorInput(
      "@bilby status",
      config,
      createModeratorState(),
    );
    expect(first.queued).toHaveLength(1);
    const stopped = applyModeratorInput("stop", config, first.state);
    expect(stopped.cancelled).toHaveLength(1);
    expect(stopped.state.queue).toEqual([]);
  });

  test("moderator hold keeps queue but marks room held", () => {
    const first = applyModeratorInput(
      "@bilby status",
      config,
      createModeratorState(),
    );
    const held = applyModeratorInput("hold", config, first.state);
    expect(held.state.held).toBe(true);
    expect(held.state.queue).toHaveLength(1);
  });
});
