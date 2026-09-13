/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ModelRouter } from "./ModelRouter";
import { IAIClientProvider } from "../providers/IAIClientProvider";

describe("ModelRouter - AI Provider Abstraction & Resilient Failover", () => {
  let mockPrimary: IAIClientProvider;
  let mockFallback: IAIClientProvider;

  beforeEach(() => {
    // Reset singleton instance for fresh test states
    (ModelRouter as any).instance = undefined;

    mockPrimary = {
      id: "gemini",
      name: "Mock Gemini Provider",
      generateText: vi.fn().mockResolvedValue({ text: "Primary response" }),
      generateStructured: vi.fn().mockResolvedValue({ text: '{"result":"primary"}', data: { result: "primary" } })
    };

    mockFallback = {
      id: "anthropic",
      name: "Mock Anthropic Provider",
      generateText: vi.fn().mockResolvedValue({ text: "Fallback response" }),
      generateStructured: vi.fn().mockResolvedValue({ text: '{"result":"fallback"}', data: { result: "fallback" } })
    };
  });

  it("should initialize with default primary provider and route to it", async () => {
    const router = new ModelRouter({
      primaryProvider: "gemini",
      fallbackProvider: "anthropic",
      failoverThreshold: 3,
      cooldownPeriodMs: 5000
    });

    router.registerProvider(mockPrimary);
    router.registerProvider(mockFallback);

    expect(router.getActiveProviderId()).toBe("gemini");

    const result = await router.generateText("Hello AI");
    expect(result.text).toBe("Primary response");
    expect(mockPrimary.generateText).toHaveBeenCalledTimes(1);
    expect(mockFallback.generateText).not.toHaveBeenCalled();

    const diagnostics = router.getDiagnosticsState();
    expect(diagnostics.activeProvider).toBe("gemini");
    expect(diagnostics.providers.gemini.totalRequests).toBe(1);
    expect(diagnostics.providers.gemini.consecutiveFailures).toBe(0);
  });

  it("should automatically fail over to fallback provider when threshold is reached", async () => {
    const router = new ModelRouter({
      primaryProvider: "gemini",
      fallbackProvider: "anthropic",
      failoverThreshold: 2,
      cooldownPeriodMs: 10000
    });

    router.registerProvider(mockPrimary);
    router.registerProvider(mockFallback);

    // Make primary fail
    (mockPrimary.generateText as any).mockRejectedValue(new Error("Primary 503 Overloaded"));

    // First failure: fails on primary, immediate failover to fallback for the current request
    const res1 = await router.generateText("Prompt 1");
    expect(res1.text).toBe("Fallback response");
    expect(router.getDiagnosticsState().providers.gemini.consecutiveFailures).toBe(1);
    expect(router.getActiveProviderId()).toBe("gemini"); // Not yet crossed threshold

    // Second failure: reaches threshold of 2, triggers full failover & cooldown
    const res2 = await router.generateText("Prompt 2");
    expect(res2.text).toBe("Fallback response");

    const diagnostics = router.getDiagnosticsState();
    expect(diagnostics.providers.gemini.consecutiveFailures).toBe(2);
    expect(diagnostics.providers.gemini.isCoolingDown).toBe(true);
    expect(diagnostics.activeProvider).toBe("anthropic");
    expect(diagnostics.isFailoverActive).toBe(true);

    // Subsequent call routes directly to fallback without calling primary during cooldown
    (mockPrimary.generateText as any).mockClear();
    const res3 = await router.generateText("Prompt 3");
    expect(res3.text).toBe("Fallback response");
    expect(mockPrimary.generateText).not.toHaveBeenCalled();
  });

  it("should recover primary provider after cooldown period expires", async () => {
    vi.useFakeTimers();

    const router = new ModelRouter({
      primaryProvider: "gemini",
      fallbackProvider: "anthropic",
      failoverThreshold: 1,
      cooldownPeriodMs: 3000
    });

    router.registerProvider(mockPrimary);
    router.registerProvider(mockFallback);

    // Cause failover
    (mockPrimary.generateText as any).mockRejectedValueOnce(new Error("Rate limited"));
    await router.generateText("Prompt");
    expect(router.getActiveProviderId()).toBe("anthropic");

    // Advance time past cooldown
    vi.advanceTimersByTime(3500);

    // Check that primary is restored
    expect(router.getActiveProviderId()).toBe("gemini");
    const diagnostics = router.getDiagnosticsState();
    expect(diagnostics.providers.gemini.isCoolingDown).toBe(false);
    expect(diagnostics.providers.gemini.consecutiveFailures).toBe(0);

    vi.useRealTimers();
  });

  it("should work in single-provider mode without fallback configured", async () => {
    const router = new ModelRouter({
      primaryProvider: "gemini",
      failoverThreshold: 2
    });

    router.registerProvider(mockPrimary);

    const res = await router.generateText("Hello");
    expect(res.text).toBe("Primary response");

    (mockPrimary.generateText as any).mockRejectedValueOnce(new Error("Gemini down"));
    await expect(router.generateText("Hello 2")).rejects.toThrow("Gemini down");
  });

  it("should support generateStructured with failover", async () => {
    const router = new ModelRouter({
      primaryProvider: "gemini",
      fallbackProvider: "anthropic",
      failoverThreshold: 1,
      cooldownPeriodMs: 5000
    });

    router.registerProvider(mockPrimary);
    router.registerProvider(mockFallback);

    (mockPrimary.generateStructured as any).mockRejectedValueOnce(new Error("Primary structured error"));

    const res = await router.generateStructured({ prompt: "Extract" });
    expect(res.data).toEqual({ result: "fallback" });
    expect(mockFallback.generateStructured).toHaveBeenCalledTimes(1);
  });
});
