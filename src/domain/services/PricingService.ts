/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  PricingTier, 
  PricingAuditLog, 
  UpdatePricingTierInput, 
  isValidISO4217 
} from "../models/PricingTier";
import { IPricingRepository } from "../repositories/IPricingRepository";

export class PricingValidationError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "PricingValidationError";
    this.statusCode = statusCode;
  }
}

export class PricingService {
  private repository: IPricingRepository;
  private cache: PricingTier[] | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 30_000; // 30 seconds short TTL

  constructor(repository: IPricingRepository) {
    this.repository = repository;
  }

  /**
   * Invalidates the in-memory cache to force a fresh lookup from SQLite
   */
  public invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  /**
   * Retrieves all pricing tiers with caching
   * @param activeOnly If true, filters down to only tiers with isActive === true
   */
  async getAllTiers(activeOnly = false): Promise<PricingTier[]> {
    const now = Date.now();
    if (!this.cache || now > this.cacheExpiresAt) {
      this.cache = await this.repository.getAllTiers();
      this.cacheExpiresAt = now + this.CACHE_TTL_MS;
    }

    if (activeOnly) {
      return this.cache.filter(t => t.isActive);
    }

    return [...this.cache];
  }

  /**
   * Public-facing list of active tiers for order creation and catalog displays
   */
  async getPublicTiers(): Promise<PricingTier[]> {
    return this.getAllTiers(true);
  }

  /**
   * Look up a specific tier by tierId (regardless of active status, 
   * so existing orders on deactivated tiers can still look up their tier config)
   */
  async getTier(tierId: string): Promise<PricingTier | null> {
    if (!tierId) return null;
    const tiers = await this.getAllTiers(false);
    const found = tiers.find(t => t.tierId.toLowerCase() === tierId.toLowerCase());
    if (found) return found;

    // Fallback direct check against repository
    return this.repository.getTierById(tierId);
  }

  /**
   * Updates an existing pricing tier, validates constraints, writes an audit log,
   * and invalidates the cache immediately.
   */
  async updateTier(
    tierId: string, 
    updates: UpdatePricingTierInput, 
    updatedBy: string
  ): Promise<PricingTier> {
    if (!tierId) {
      throw new PricingValidationError("tierId is required to update pricing tier.", 400);
    }

    const existing = await this.repository.getTierById(tierId);
    if (!existing) {
      throw new PricingValidationError(`Pricing tier with id '${tierId}' not found.`, 404);
    }

    // 1. Validate price
    let targetPriceMinorUnits = existing.priceMinorUnits;
    if (updates.priceMinorUnits !== undefined) {
      const p = Number(updates.priceMinorUnits);
      if (!Number.isFinite(p) || p <= 0 || !Number.isInteger(p)) {
        throw new PricingValidationError("Price must be a positive integer in minor units (paise/cents) greater than zero.", 400);
      }
      targetPriceMinorUnits = p;
    } else if (updates.price !== undefined) {
      const p = Number(updates.price);
      if (!Number.isFinite(p) || p <= 0) {
        throw new PricingValidationError("Price must be greater than zero.", 400);
      }
      targetPriceMinorUnits = Math.round(p * 100);
    }

    // 2. Validate revisionLimit
    let targetRevisionLimit = existing.revisionLimit;
    if (updates.revisionLimit !== undefined) {
      const rl = Number(updates.revisionLimit);
      if (!Number.isFinite(rl) || rl < 0 || !Number.isInteger(rl)) {
        throw new PricingValidationError("Revision limit must be an integer greater than or equal to 0.", 400);
      }
      targetRevisionLimit = rl;
    }

    // 3. Validate currency
    let targetCurrency = existing.currency;
    if (updates.currency !== undefined) {
      const c = updates.currency.trim().toUpperCase();
      if (!isValidISO4217(c)) {
        throw new PricingValidationError(
          `Invalid currency '${updates.currency}'. Must be a recognized 3-letter ISO 4217 currency code (e.g., 'INR', 'USD', 'EUR').`, 
          400
        );
      }
      targetCurrency = c;
    }

    // 4. Validate displayName
    let targetDisplayName = existing.displayName;
    if (updates.displayName !== undefined) {
      if (typeof updates.displayName !== "string" || !updates.displayName.trim()) {
        throw new PricingValidationError("Display name must be a non-empty string.", 400);
      }
      targetDisplayName = updates.displayName.trim();
    }

    // 5. Active flag
    let targetIsActive = existing.isActive;
    if (updates.isActive !== undefined) {
      targetIsActive = Boolean(updates.isActive);
    }

    const now = new Date().toISOString();
    const updatedTier: PricingTier = {
      tierId: existing.tierId,
      displayName: targetDisplayName,
      priceMinorUnits: targetPriceMinorUnits,
      currency: targetCurrency,
      revisionLimit: targetRevisionLimit,
      isActive: targetIsActive,
      updatedAt: now,
      updatedBy: updatedBy || "admin"
    };

    // 6. Record Audit Log Entry
    const auditLog: PricingAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
      tierId: existing.tierId,
      oldPriceMinorUnits: existing.priceMinorUnits,
      newPriceMinorUnits: targetPriceMinorUnits,
      oldCurrency: existing.currency,
      newCurrency: targetCurrency,
      oldRevisionLimit: existing.revisionLimit,
      newRevisionLimit: targetRevisionLimit,
      oldIsActive: existing.isActive,
      newIsActive: targetIsActive,
      changedBy: updatedBy || "admin",
      changedAt: now,
      reason: updates.reason?.trim() || "Dynamic pricing configuration update",
      oldValues: JSON.stringify({
        priceMinorUnits: existing.priceMinorUnits,
        currency: existing.currency,
        revisionLimit: existing.revisionLimit,
        isActive: existing.isActive
      }),
      newValues: JSON.stringify({
        priceMinorUnits: targetPriceMinorUnits,
        currency: targetCurrency,
        revisionLimit: targetRevisionLimit,
        isActive: targetIsActive
      })
    };

    await this.repository.recordAuditLog(auditLog);
    await this.repository.saveTier(updatedTier);

    // Invalidate cache immediately on write
    this.invalidateCache();

    return updatedTier;
  }

  /**
   * Retrieves audit logs for all tiers or a specific tierId
   */
  async getAuditLogs(tierId?: string): Promise<PricingAuditLog[]> {
    return this.repository.getAuditLogs(tierId);
  }
}
