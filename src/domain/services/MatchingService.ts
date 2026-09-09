/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candidate } from "../models/Candidate";
import { Job } from "../models/Job";
import { MatchResult } from "../models/MatchResult";
import { IMatchingService } from "./IMatchingService";

export class MatchingService implements IMatchingService {
  async matchCandidate(candidate: Candidate, jobs: Job[]): Promise<MatchResult[]> {
    const candidateSkillsUpper = candidate.skills.map(s => s.toLowerCase());
    const results: MatchResult[] = [];

    for (const job of jobs) {
      const matchedSkills = job.skills.filter(s => candidateSkillsUpper.includes(s.toLowerCase()));
      const missingSkills = job.skills.filter(s => !candidateSkillsUpper.includes(s.toLowerCase()));

      let skillsScore = 0;
      if (job.skills.length > 0) {
        skillsScore = (matchedSkills.length / job.skills.length) * 100;
      } else {
        skillsScore = 100; // Perfect match if no skills specified
      }

      // Location matching check (if candidate has physical location restriction)
      let locationPenalty = false;
      const cPreference = candidate.locationPreference.toLowerCase();
      const jLocation = job.location.toLowerCase();

      if (cPreference !== "remote" && !jLocation.includes(cPreference) && !cPreference.includes(jLocation)) {
        locationPenalty = true;
      }

      let matchScore = Math.round(skillsScore);
      if (locationPenalty) {
        matchScore = Math.round(matchScore * 0.7); // 30% penalty for mismatched geo preference
      }

      matchScore = Math.max(0, Math.min(100, matchScore));

      let suitabilityExplanation = "";
      if (matchScore >= 85) {
        suitabilityExplanation = `${candidate.name} exhibits exceptional suitability for this position. Key matching proficiencies include ${matchedSkills.slice(0, 3).join(", ")}.`;
      } else if (matchScore >= 50) {
        suitabilityExplanation = `${candidate.name} is moderately aligned with the criteria. Consider bridging the following missing competencies: ${missingSkills.slice(0, 3).join(", ")}.`;
      } else {
        suitabilityExplanation = `Low criteria matching score. The job requires significant alignment in ${job.skills.slice(0, 3).join(", ")} which are not yet fully highlighted in the candidate's core profile.`;
      }

      results.push({
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        matchScore,
        matchedSkills,
        missingSkills,
        suitabilityExplanation
      });
    }

    // Sort matches from highest score descending
    return results.sort((a, b) => b.matchScore - a.matchScore);
  }
}
