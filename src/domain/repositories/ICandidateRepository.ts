/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candidate } from "../models/Candidate";

export interface ICandidateRepository {
  getAll(): Promise<Candidate[]>;
  getById(id: string): Promise<Candidate | null>;
  save(candidate: Candidate): Promise<Candidate>;
  delete(id: string): Promise<void>;
}
