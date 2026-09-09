/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candidate } from "../models/Candidate";
import { Job } from "../models/Job";
import { MatchResult } from "../models/MatchResult";

export interface IMatchingService {
  matchCandidate(candidate: Candidate, jobs: Job[]): Promise<MatchResult[]>;
}
