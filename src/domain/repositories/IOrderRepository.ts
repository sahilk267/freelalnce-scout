/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ResumeOrder } from "../models/ResumeOrder";

export interface IOrderRepository {
  getAll(): Promise<ResumeOrder[]>;
  getById(id: string): Promise<ResumeOrder | null>;
  getByCandidateId(candidateId: string): Promise<ResumeOrder[]>;
  getReviewQueue(): Promise<ResumeOrder[]>;
  save(order: ResumeOrder): Promise<ResumeOrder>;
  delete(id: string): Promise<void>;
}
