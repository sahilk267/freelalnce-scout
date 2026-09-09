/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Candidate entity model for recruitment sourcing and ATS match workflows.
 */
export interface Candidate {
  id: string;
  name: string;
  skills: string[];
  experienceYears: number;
  locationPreference: string;
}
