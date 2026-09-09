/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candidate } from "../models/Candidate";
import { ICandidateRepository } from "./ICandidateRepository";

export class InMemoryCandidateRepository implements ICandidateRepository {
  private candidates: Map<string, Candidate> = new Map();

  constructor() {
    // Seed initial candidates based on the requirements
    const seed: Candidate[] = [
      {
        id: "cand-1",
        name: "Sophia Chen",
        skills: ["React", "TypeScript", "Tailwind CSS", "Motion"],
        experienceYears: 5,
        locationPreference: "Remote"
      },
      {
        id: "cand-2",
        name: "Marcus Vance",
        skills: ["Node.js", "Express", "PostgreSQL", "Docker", "AWS"],
        experienceYears: 7,
        locationPreference: "Remote"
      },
      {
        id: "cand-3",
        name: "Elena Rostova",
        skills: ["Python", "TensorFlow", "Gemini API", "Vector Databases"],
        experienceYears: 4,
        locationPreference: "San Francisco, CA"
      }
    ];

    for (const cand of seed) {
      this.candidates.set(cand.id, cand);
    }
  }

  async getAll(): Promise<Candidate[]> {
    return Array.from(this.candidates.values());
  }

  async getById(id: string): Promise<Candidate | null> {
    return this.candidates.get(id) || null;
  }

  async save(candidate: Candidate): Promise<Candidate> {
    const updated = { ...candidate };
    if (!updated.id) {
      updated.id = `cand-${Date.now()}`;
    }
    this.candidates.set(updated.id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.candidates.delete(id);
  }
}
