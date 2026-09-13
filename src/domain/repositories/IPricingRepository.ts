/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PricingTier, PricingAuditLog } from "../models/PricingTier";

export interface IPricingRepository {
  getAllTiers(): Promise<PricingTier[]>;
  getActiveTiers(): Promise<PricingTier[]>;
  getTierById(tierId: string): Promise<PricingTier | null>;
  saveTier(tier: PricingTier): Promise<PricingTier>;
  recordAuditLog(log: PricingAuditLog): Promise<PricingAuditLog>;
  getAuditLogs(tierId?: string): Promise<PricingAuditLog[]>;
  countTiers(): Promise<number>;
}
