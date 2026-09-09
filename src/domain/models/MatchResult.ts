/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MatchResult {
  jobId: string;
  jobTitle: string;
  company: string;
  matchScore: number; // 0 to 100
  matchedSkills: string[];
  missingSkills: string[];
  suitabilityExplanation: string;
}
