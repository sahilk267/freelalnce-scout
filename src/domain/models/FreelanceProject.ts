/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type FreelanceSourceStatus = "live" | "mock" | "error";

export interface FreelanceProject {
  id: string;
  title: string;
  platform: string;
  budget: string;
  postedTime: string;
  verification: "verified" | "unverified";
  confidence: number;
  originalUrl: string;
  skills: string[];
  description: string;
  sourceStatus?: FreelanceSourceStatus;
  sourceStatusReason?: string;
}
