/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  source: string;
  timestamp: string;
  verification: "verified" | "unverified" | "pending";
  confidence: number;
  originalUrl: string;
  duplicateStatus: "original" | "duplicate";
  skills: string[];
  description?: string;
}
