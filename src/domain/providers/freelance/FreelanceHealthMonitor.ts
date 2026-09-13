/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FreelanceSourceStatus, FreelanceStatusReason } from "../IFreelanceProvider";

export interface ProviderHealthRecord {
  providerName: string;
  status: FreelanceSourceStatus;
  reason?: FreelanceStatusReason;
  lastChecked: string;
  isOfficialApi?: boolean;
}

export class FreelanceHealthMonitor {
  private static instance: FreelanceHealthMonitor;
  private states: Map<string, ProviderHealthRecord> = new Map();

  private constructor() {
    // Initialize standard 5 providers with initial known states
    const now = new Date().toISOString();
    const providers = ["Freelancer.com", "Upwork", "PeoplePerHour", "Guru", "Fiverr Pro"];
    for (const p of providers) {
      this.states.set(p, {
        providerName: p,
        status: p === "Freelancer.com" ? "live" : "mock",
        reason: p === "Freelancer.com" ? undefined : "blocked_403",
        lastChecked: now,
        isOfficialApi: false
      });
    }
  }

  public static getInstance(): FreelanceHealthMonitor {
    if (!FreelanceHealthMonitor.instance) {
      FreelanceHealthMonitor.instance = new FreelanceHealthMonitor();
    }
    return FreelanceHealthMonitor.instance;
  }

  /**
   * Record provider status and emit a state transition log ONLY when status changes.
   */
  public recordStatus(
    providerName: string,
    newStatus: FreelanceSourceStatus,
    reason?: FreelanceStatusReason,
    isOfficialApi?: boolean
  ): void {
    const prev = this.states.get(providerName);
    const now = new Date().toISOString();

    if (!prev) {
      this.states.set(providerName, {
        providerName,
        status: newStatus,
        reason,
        lastChecked: now,
        isOfficialApi
      });
      return;
    }

    if (prev.status !== newStatus) {
      const msg = `[FreelanceHealthMonitor] State transition for ${providerName}: ${prev.status.toUpperCase()} -> ${newStatus.toUpperCase()}${
        reason ? ` (Reason: ${reason})` : ""
      }`;
      if (newStatus === "live") {
        console.info(msg);
      } else if (newStatus === "mock") {
        console.warn(msg);
      } else {
        console.error(msg);
      }
    }

    this.states.set(providerName, {
      providerName,
      status: newStatus,
      reason: newStatus === "live" ? undefined : (reason || prev.reason),
      lastChecked: now,
      isOfficialApi: isOfficialApi ?? prev.isOfficialApi
    });
  }

  public getStatus(providerName: string): ProviderHealthRecord | undefined {
    return this.states.get(providerName);
  }

  public getAllStatuses(): Record<string, ProviderHealthRecord> {
    const res: Record<string, ProviderHealthRecord> = {};
    for (const [k, v] of this.states.entries()) {
      res[k] = { ...v };
    }
    return res;
  }

  public getSummary(): { live: number; mock: number; failed: number } {
    let live = 0;
    let mock = 0;
    let failed = 0;

    for (const record of this.states.values()) {
      if (record.status === "live") live++;
      else if (record.status === "mock") mock++;
      else if (record.status === "error") failed++;
    }

    return { live, mock, failed };
  }

  private pingTimer: NodeJS.Timeout | null = null;

  public startPeriodicPing(intervalMs = 300000): void {
    if (this.pingTimer) return;
    // Initial async ping after small delay
    setTimeout(() => {
      this.pingAll().catch(() => {});
    }, 5000);

    this.pingTimer = setInterval(() => {
      this.pingAll().catch(() => {});
    }, intervalMs);
  }

  public stopPeriodicPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  public async pingAll(): Promise<void> {
    try {
      const { UpworkProvider } = await import("./UpworkProvider");
      const { GuruProvider } = await import("./GuruProvider");
      const { PeoplePerHourProvider } = await import("./PeoplePerHourProvider");
      const { FiverrProProvider } = await import("./FiverrProProvider");
      const { FreelancerProvider } = await import("./FreelancerProvider");

      const providers = [
        new UpworkProvider(),
        new GuruProvider(),
        new PeoplePerHourProvider(),
        new FiverrProProvider(),
        new FreelancerProvider()
      ];

      await Promise.allSettled(
        providers.map(async (prov) => {
          try {
            const health = await prov.checkHealth();
            this.recordStatus(prov.name, health.status, health.reason);
          } catch {
            this.recordStatus(prov.name, "error", "timeout");
          }
        })
      );
    } catch {
      // Dynamic import error safeguard
    }
  }
}
