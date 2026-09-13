/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FreelanceProject, FreelanceSourceStatus } from "../models/FreelanceProject";

export type { FreelanceSourceStatus };
export type FreelanceStatusReason =
  | "blocked_403"
  | "timeout"
  | "rate_limited"
  | "parse_failed"
  | "unauthorized_401"
  | "network_error"
  | "official_api_active"
  | string;

export interface FreelanceBatchResult<T = FreelanceProject> {
  projects: T[];
  sourceStatus: FreelanceSourceStatus;
  statusReason?: FreelanceStatusReason;
  sourceName?: string;
  timestamp?: string;
}

export interface IFreelanceProvider {
  name?: string;
  fetchFreelanceProjects(): Promise<FreelanceProject[]>;
  checkHealth?(): Promise<{ status: FreelanceSourceStatus; reason?: FreelanceStatusReason }>;
}
