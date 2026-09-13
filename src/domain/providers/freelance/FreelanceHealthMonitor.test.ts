/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { FreelanceHealthMonitor } from "./FreelanceHealthMonitor";

describe("FreelanceHealthMonitor", () => {
  let monitor: FreelanceHealthMonitor;

  beforeEach(() => {
    monitor = FreelanceHealthMonitor.getInstance();
  });

  it("should initialize with default states and calculate summary", () => {
    const summary = monitor.getSummary();
    expect(summary).toHaveProperty("live");
    expect(summary).toHaveProperty("mock");
    expect(summary).toHaveProperty("failed");
    expect(summary.live + summary.mock + summary.failed).toBeGreaterThanOrEqual(5);
  });

  it("should record state transitions and log only when state changes", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    // Transition Upwork to live
    monitor.recordStatus("Upwork", "live");
    expect(infoSpy).toHaveBeenCalled();
    expect(monitor.getStatus("Upwork")?.status).toBe("live");

    // Repeat same status - no new log
    infoSpy.mockClear();
    monitor.recordStatus("Upwork", "live");
    expect(infoSpy).not.toHaveBeenCalled();

    // Transition to mock with reason
    monitor.recordStatus("Upwork", "mock", "blocked_403");
    expect(warnSpy).toHaveBeenCalled();
    expect(monitor.getStatus("Upwork")?.status).toBe("mock");
    expect(monitor.getStatus("Upwork")?.reason).toBe("blocked_403");

    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });
});
