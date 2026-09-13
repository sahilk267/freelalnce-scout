/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PricingTier {
  tierId: string; // e.g. "basic" | "standard" | "premium"
  displayName: string;
  priceMinorUnits: number; // Stored in minor currency units (e.g. paise for INR, cents for USD) to avoid float rounding bugs
  currency: string; // ISO 4217 currency code (e.g. "INR", "USD")
  revisionLimit: number; // integer >= 0
  isActive: boolean;
  updatedAt: string; // ISO 8601 string
  updatedBy: string; // Admin user ID, email, or "system"
}

export interface PricingAuditLog {
  id: string;
  tierId: string;
  oldPriceMinorUnits: number;
  newPriceMinorUnits: number;
  oldCurrency: string;
  newCurrency: string;
  oldRevisionLimit: number;
  newRevisionLimit: number;
  oldIsActive: boolean;
  newIsActive: boolean;
  changedBy: string;
  changedAt: string;
  reason?: string;
  oldValues?: string;
  newValues?: string;
}

export interface UpdatePricingTierInput {
  displayName?: string;
  priceMinorUnits?: number;
  price?: number; // convenience field in major units (e.g. rupees or dollars)
  currency?: string;
  revisionLimit?: number;
  isActive?: boolean;
  reason?: string;
}

// Recognized ISO 4217 Currency Codes
export const RECOGNIZED_ISO_4217_CURRENCIES = new Set([
  "INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", 
  "SGD", "AED", "HKD", "NZD", "SEK", "KRW", "BRL", "MXN", "SAR", 
  "ZAR", "THB", "TRY", "NOK", "DKK", "PLN", "TWD", "IDR", "MYR", 
  "PHP", "VND", "CZK", "HUF", "ILS", "CLP", "COP", "PEN", "QAR",
  "KWD", "OMR", "BHD", "EGP", "NGN", "KES", "PKR", "BDT", "LKR"
]);

export function isValidISO4217(currency: string): boolean {
  if (!currency || typeof currency !== "string") return false;
  const upper = currency.trim().toUpperCase();
  return RECOGNIZED_ISO_4217_CURRENCIES.has(upper);
}

export const DEFAULT_PRICING_TIERS: PricingTier[] = [
  {
    tierId: "basic",
    displayName: "Basic",
    priceMinorUnits: 30000, // ₹300.00 (30,000 paise)
    currency: "INR",
    revisionLimit: 1,
    isActive: true,
    updatedAt: "2026-09-12T00:00:00.000Z",
    updatedBy: "system"
  },
  {
    tierId: "standard",
    displayName: "Standard",
    priceMinorUnits: 80000, // ₹800.00 (80,000 paise)
    currency: "INR",
    revisionLimit: 2,
    isActive: true,
    updatedAt: "2026-09-12T00:00:00.000Z",
    updatedBy: "system"
  },
  {
    tierId: "premium",
    displayName: "Premium",
    priceMinorUnits: 150000, // ₹1500.00 (150,000 paise)
    currency: "INR",
    revisionLimit: 3,
    isActive: true,
    updatedAt: "2026-09-12T00:00:00.000Z",
    updatedBy: "system"
  }
];
