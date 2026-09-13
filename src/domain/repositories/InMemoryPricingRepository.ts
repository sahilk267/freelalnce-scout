/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PricingTier, PricingAuditLog, DEFAULT_PRICING_TIERS } from "../models/PricingTier";
import { IPricingRepository } from "./IPricingRepository";

export class InMemoryPricingRepository implements IPricingRepository {
  private tiers: Map<string, PricingTier> = new Map();
  private auditLogs: PricingAuditLog[] = [];

  constructor(seedDefaults = true) {
    if (seedDefaults) {
      this.seedDefaults();
    }
  }

  public seedDefaults(): void {
    const now = new Date().toISOString();
    for (const tier of DEFAULT_PRICING_TIERS) {
      this.tiers.set(tier.tierId.toLowerCase(), {
        ...tier,
        updatedAt: tier.updatedAt || now
      });
    }
  }

  async getAllTiers(): Promise<PricingTier[]> {
    return Array.from(this.tiers.values()).sort((a, b) => a.priceMinorUnits - b.priceMinorUnits);
  }

  async getActiveTiers(): Promise<PricingTier[]> {
    return Array.from(this.tiers.values())
      .filter(t => t.isActive)
      .sort((a, b) => a.priceMinorUnits - b.priceMinorUnits);
  }

  async getTierById(tierId: string): Promise<PricingTier | null> {
    if (!tierId) return null;
    const tier = this.tiers.get(tierId.toLowerCase());
    return tier ? { ...tier } : null;
  }

  async saveTier(tier: PricingTier): Promise<PricingTier> {
    this.tiers.set(tier.tierId.toLowerCase(), { ...tier });
    return { ...tier };
  }

  async recordAuditLog(log: PricingAuditLog): Promise<PricingAuditLog> {
    this.auditLogs.unshift({ ...log });
    return { ...log };
  }

  async getAuditLogs(tierId?: string): Promise<PricingAuditLog[]> {
    if (tierId) {
      return this.auditLogs.filter(l => l.tierId.toLowerCase() === tierId.toLowerCase());
    }
    return [...this.auditLogs];
  }

  async countTiers(): Promise<number> {
    return this.tiers.size;
  }
}
