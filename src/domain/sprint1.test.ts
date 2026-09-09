/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DIContainer,
  InMemoryCandidateRepository,
  MatchingService,
  Candidate,
  Job,
  RemotiveJobProvider
} from "./index";

describe("Sprint 1 Unit Tests", () => {
  describe("Dependency Injection (DI) Container", () => {
    beforeEach(() => {
      DIContainer.reset();
    });

    it("should register and resolve a service correctly", () => {
      const mockService = { test: () => "working" };
      DIContainer.register("TestService", mockService);

      const resolved = DIContainer.get<typeof mockService>("TestService");
      expect(resolved).toBe(mockService);
      expect(resolved.test()).toBe("working");
    });

    it("should throw an error when resolving an unregistered service", () => {
      expect(() => DIContainer.get("NonExistent")).toThrow(
        "Service [NonExistent] is not registered in the DI Container."
      );
    });
  });

  describe("In-Memory Candidate Repository", () => {
    let repo: InMemoryCandidateRepository;

    beforeEach(() => {
      repo = new InMemoryCandidateRepository();
    });

    it("should seed candidates initially", async () => {
      const candidates = await repo.getAll();
      expect(candidates.length).toBeGreaterThanOrEqual(3);
      expect(candidates[0].name).toBe("Sophia Chen");
    });

    it("should retrieve a candidate by id", async () => {
      const candidate = await repo.getById("cand-1");
      expect(candidate).not.toBeNull();
      expect(candidate?.name).toBe("Sophia Chen");
    });

    it("should save a new candidate", async () => {
      const newCand: Candidate = {
        id: "cand-new",
        name: "Test Developer",
        skills: ["Go", "Kubernetes"],
        experienceYears: 3,
        locationPreference: "Remote"
      };

      await repo.save(newCand);
      const retrieved = await repo.getById("cand-new");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe("Test Developer");
    });
  });

  describe("Matching Service", () => {
    let matcher: MatchingService;

    beforeEach(() => {
      matcher = new MatchingService();
    });

    it("should calculate perfect match score when candidate has all job skills", async () => {
      const candidate: Candidate = {
        id: "c1",
        name: "React Master",
        skills: ["React", "TypeScript", "Tailwind CSS"],
        experienceYears: 3,
        locationPreference: "Remote"
      };

      const job: Job = {
        id: "j1",
        title: "React Developer",
        company: "Test Co",
        location: "Remote",
        salary: "$100k",
        source: "Test",
        timestamp: new Date().toISOString(),
        verification: "verified",
        confidence: 90,
        originalUrl: "http://example.com",
        duplicateStatus: "original",
        skills: ["React", "TypeScript"]
      };

      const matches = await matcher.matchCandidate(candidate, [job]);
      expect(matches.length).toBe(1);
      expect(matches[0].matchScore).toBe(100);
      expect(matches[0].matchedSkills).toContain("React");
      expect(matches[0].matchedSkills).toContain("TypeScript");
      expect(matches[0].missingSkills.length).toBe(0);
      expect(matches[0].suitabilityExplanation).toContain("exceptional suitability");
    });

    it("should penalize score when there is a geo-location mismatch", async () => {
      const candidate: Candidate = {
        id: "c2",
        name: "Local Dev",
        skills: ["React"],
        experienceYears: 2,
        locationPreference: "New York"
      };

      const job: Job = {
        id: "j2",
        title: "React Dev London",
        company: "UK Corp",
        location: "London, UK",
        salary: "£60k",
        source: "Test",
        timestamp: new Date().toISOString(),
        verification: "verified",
        confidence: 90,
        originalUrl: "http://example.com",
        duplicateStatus: "original",
        skills: ["React"]
      };

      const matches = await matcher.matchCandidate(candidate, [job]);
      expect(matches.length).toBe(1);
      // Perfect skill match (100) penalized by 30% for geo mismatch => 70
      expect(matches[0].matchScore).toBe(70);
      expect(matches[0].suitabilityExplanation).toContain("moderately aligned");
    });
  });

  describe("Remotive Job Provider", () => {
    it("should throw or fetch from Remotive API", async () => {
      const provider = new RemotiveJobProvider();
      // Test fetching directly or mocking the request
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jobs: [
            {
              id: 12345,
              title: "Mock Job",
              company_name: "Mock Company",
              candidate_required_location: "Remote",
              salary: "$120,000",
              publication_date: "2026-07-12T00:00:00.000Z",
              url: "https://example.com",
              tags: ["React", "TypeScript"]
            }
          ]
        })
      });

      // Temporarily replace global.fetch for testing RemotiveJobProvider
      const originalFetch = global.fetch;
      global.fetch = mockFetch;

      const jobs = await provider.fetchJobs();
      expect(jobs.length).toBe(1);
      expect(jobs[0].id).toBe("remotive-12345");
      expect(jobs[0].title).toBe("Mock Job");
      expect(jobs[0].skills).toContain("React");

      // Restore fetch
      global.fetch = originalFetch;
    });
  });
});
