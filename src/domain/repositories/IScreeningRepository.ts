/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScreeningSession } from "../models/ScreeningSession";

export interface IScreeningRepository {
  save(session: ScreeningSession): Promise<void>;
  findById(id: string): Promise<ScreeningSession | null>;
  findByCandidateId(candidateId: string): Promise<ScreeningSession[]>;
  findByJobId(jobId: string): Promise<ScreeningSession[]>;
  findByToken(token: string): Promise<ScreeningSession | null>;
}
