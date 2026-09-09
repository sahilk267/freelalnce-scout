/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { DIContainer } from "./di/DIContainer";
import { SQLiteFreelancerRepository } from "./repositories/SQLiteFreelancerRepository";
import { SQLiteBackupRepository } from "./repositories/SQLiteBackupRepository";
import { FreelancerAgent } from "./agent/FreelancerAgent";
import { Task } from "./agent/types";
import { NormalizedFreelanceProject, FreelanceProposal, FreelancerAgentState } from "./agent/freelancerTypes";
import { ICandidateRepository } from "./repositories/ICandidateRepository";
import { Candidate } from "./models/Candidate";

// Mock providers
import { FreelancerProvider } from "./providers/freelance/FreelancerProvider";
import { UpworkProvider } from "./providers/freelance/UpworkProvider";
import { PeoplePerHourProvider } from "./providers/freelance/PeoplePerHourProvider";
import { GuruProvider } from "./providers/freelance/GuruProvider";
import { FiverrProProvider } from "./providers/freelance/FiverrProProvider";

class MockCandidateRepository implements ICandidateRepository {
  private candidates: Candidate[] = [
    {
      id: "cand-1",
      name: "Test Developer",
      skills: ["React", "TypeScript", "Node.js"],
      experienceYears: 5,
      locationPreference: "Remote"
    }
  ];

  async getAll(): Promise<Candidate[]> {
    return this.candidates;
  }
  async getById(id: string): Promise<Candidate | null> {
    return this.candidates.find(c => c.id === id) || null;
  }
  async save(candidate: Candidate): Promise<Candidate> {
    const idx = this.candidates.findIndex(c => c.id === candidate.id);
    if (idx >= 0) {
      this.candidates[idx] = candidate;
    } else {
      this.candidates.push(candidate);
    }
    return candidate;
  }
  async delete(id: string): Promise<void> {
    this.candidates = this.candidates.filter(c => c.id !== id);
  }
}

describe("Autonomous Freelancer Agent Subsystem Tests", () => {
  let freelancerRepo: SQLiteFreelancerRepository;
  let backupRepo: SQLiteBackupRepository;
  let candidateRepo: MockCandidateRepository;

  beforeEach(() => {
    // Reset DI and initialize repositories in memory
    DIContainer.reset();

    freelancerRepo = new SQLiteFreelancerRepository(":memory:");
    backupRepo = new SQLiteBackupRepository(":memory:");
    candidateRepo = new MockCandidateRepository();

    DIContainer.register("SQLiteFreelancerRepository", freelancerRepo);
    DIContainer.register("SQLiteBackupRepository", backupRepo);
    DIContainer.register("ICandidateRepository", candidateRepo);

    // Mock Gemini Client Provider
    const mockGeminiClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: "Mocked Gemini generated proposal body: GREETING, UNDERSTANDING, ROADMAP, CALL TO ACTION."
        })
      }
    };
    const mockAIProvider = {
      getClient: () => mockGeminiClient
    };
    DIContainer.register("IAIClientProvider", mockAIProvider);
  });

  afterEach(() => {
    freelancerRepo.close();
    backupRepo.close();
  });

  describe("SQLiteFreelancerRepository Unit Tests", () => {
    it("should successfully save, retrieve, and filter normalized projects", () => {
      const mockProject: NormalizedFreelanceProject = {
        id: "proj-123",
        title: "Build React E-Commerce Dashboard",
        description: "Need an expert to build a dashboard using Tailwind CSS.",
        skills: ["React", "TypeScript", "Tailwind CSS"],
        budget: "$1,500",
        currency: "USD",
        hourlyOrFixed: "fixed",
        clientRating: 4.9,
        clientReviews: 12,
        clientSpending: "$50k+",
        location: "United States",
        proposalCount: 4,
        urgency: "high",
        source: "Upwork",
        projectUrl: "https://upwork.com/jobs/123",
        scrapeTimestamp: new Date().toISOString()
      };

      freelancerRepo.saveProject(mockProject);

      const retrieved = freelancerRepo.getProject("proj-123");
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe("Build React E-Commerce Dashboard");
      expect(retrieved?.skills).toContain("React");
      expect(retrieved?.hourlyOrFixed).toBe("fixed");

      const allProjects = freelancerRepo.getProjects();
      expect(allProjects.length).toBe(1);
      expect(allProjects[0].id).toBe("proj-123");
    });

    it("should handle project deduplication and updates on conflict", () => {
      const p1: NormalizedFreelanceProject = {
        id: "dup-1",
        title: "Original Title",
        description: "Desc",
        skills: ["React"],
        budget: "$500",
        currency: "USD",
        hourlyOrFixed: "fixed",
        clientRating: null,
        clientReviews: null,
        clientSpending: null,
        location: "Worldwide",
        proposalCount: 1,
        urgency: "low",
        source: "Guru",
        projectUrl: "https://guru.com/dup",
        scrapeTimestamp: new Date().toISOString()
      };

      const p2: NormalizedFreelanceProject = {
        id: "dup-1",
        title: "Updated Title",
        description: "Updated Desc",
        skills: ["React", "TypeScript"],
        budget: "$600",
        currency: "USD",
        hourlyOrFixed: "fixed",
        clientRating: 4.5,
        clientReviews: 1,
        clientSpending: "$1k",
        location: "Canada",
        proposalCount: 3,
        urgency: "medium",
        source: "Guru",
        projectUrl: "https://guru.com/dup",
        scrapeTimestamp: new Date().toISOString()
      };

      freelancerRepo.saveProject(p1);
      freelancerRepo.saveProject(p2);

      const retrieved = freelancerRepo.getProject("dup-1");
      expect(retrieved?.title).toBe("Updated Title");
      expect(retrieved?.skills).toContain("TypeScript");
      expect(retrieved?.clientRating).toBe(4.5);
      expect(freelancerRepo.getProjects().length).toBe(1);
    });

    it("should manage proposal life-cycle transitions", () => {
      // Seed parent project first to satisfy SQLITE FOREIGN KEY constraint
      freelancerRepo.saveProject({
        id: "proj-123",
        title: "Build React E-Commerce Dashboard",
        description: "Need an expert to build a dashboard using Tailwind CSS.",
        skills: ["React", "TypeScript", "Tailwind CSS"],
        budget: "$1,500",
        currency: "USD",
        hourlyOrFixed: "fixed",
        clientRating: 4.9,
        clientReviews: 12,
        clientSpending: "$50k+",
        location: "United States",
        proposalCount: 4,
        urgency: "high",
        source: "Upwork",
        projectUrl: "https://upwork.com/jobs/123",
        scrapeTimestamp: new Date().toISOString()
      });

      const mockProposal: FreelanceProposal = {
        id: "prop-999",
        projectId: "proj-123",
        title: "Test Proposal",
        proposalText: "Let me build this project.",
        tone: "professional",
        status: "Pending Approval",
        createdAt: new Date().toISOString(),
        submittedAt: null
      };

      freelancerRepo.saveProposal(mockProposal);

      const retrieved = freelancerRepo.getProposal("prop-999");
      expect(retrieved).toBeDefined();
      expect(retrieved?.status).toBe("Pending Approval");

      freelancerRepo.updateProposalStatus("prop-999", "Approved");
      const approved = freelancerRepo.getProposal("prop-999");
      expect(approved?.status).toBe("Approved");
      expect(approved?.submittedAt).toBeNull();

      const timeStr = new Date().toISOString();
      freelancerRepo.updateProposalStatus("prop-999", "Submitted", timeStr);
      const submitted = freelancerRepo.getProposal("prop-999");
      expect(submitted?.status).toBe("Submitted");
      expect(submitted?.submittedAt).toBe(timeStr);
    });

    it("should persist agent operational configurations", () => {
      const initialState = freelancerRepo.getAgentState();
      expect(initialState.isEnabled).toBe(true);
      expect(initialState.intervalMinutes).toBe(15);

      const newState: FreelancerAgentState = {
        intervalMinutes: 30,
        isEnabled: false,
        lastRun: "2026-07-13T00:00:00Z",
        nextRun: "2026-07-13T00:30:00Z"
      };

      freelancerRepo.saveAgentState(newState);
      const retrieved = freelancerRepo.getAgentState();
      expect(retrieved.intervalMinutes).toBe(30);
      expect(retrieved.isEnabled).toBe(false);
      expect(retrieved.lastRun).toBe("2026-07-13T00:00:00Z");
    });

    it("should successfully log events and truncate past limit", () => {
      for (let i = 0; i < 60; i++) {
        freelancerRepo.addLog("info", `Log entry ${i}`);
      }

      const logs = freelancerRepo.getLogs(100);
      expect(logs.length).toBe(50); // Hard maximum ceiling validation
      expect(logs[0].message).toBe("Log entry 59"); // LIFO ordering validation
    });

    it("should support purging database contents cleanly", () => {
      freelancerRepo.saveProject({
        id: "proj-purgatory",
        title: "Purge Me",
        description: "Draft",
        skills: [],
        budget: "$100",
        currency: "USD",
        hourlyOrFixed: "fixed",
        clientRating: null,
        clientReviews: null,
        clientSpending: null,
        location: "Somewhere",
        proposalCount: 0,
        urgency: "low",
        source: "Upwork",
        projectUrl: "http://test.com",
        scrapeTimestamp: new Date().toISOString()
      });

      expect(freelancerRepo.getProjects().length).toBe(1);
      freelancerRepo.clearAll();
      expect(freelancerRepo.getProjects().length).toBe(0);
    });
  });

  describe("Provider Architecture & Schema Normalization Tests", () => {
    it("should fetch and normalize jobs with UpworkProvider", async () => {
      const provider = new UpworkProvider();
      const jobs = await provider.fetchJobs();
      expect(jobs.length).toBeGreaterThan(0);
      
      const firstJob = jobs[0];
      expect(firstJob.id).toBeDefined();
      expect(firstJob.title).toBeDefined();
      expect(firstJob.source).toBe("Upwork");
      expect(firstJob.hourlyOrFixed).toBe("hourly");
    });

    it("should fetch and normalize jobs with FreelancerProvider", async () => {
      const provider = new FreelancerProvider();
      const jobs = await provider.fetchJobs();
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs[0].source).toBe("Freelancer");
    });

    it("should fetch and normalize jobs with GuruProvider", async () => {
      const provider = new GuruProvider();
      const jobs = await provider.fetchJobs();
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs[0].source).toBe("Guru");
    });

    it("should fetch and normalize jobs with PeoplePerHourProvider", async () => {
      const provider = new PeoplePerHourProvider();
      const jobs = await provider.fetchJobs();
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs[0].source).toBe("PeoplePerHour");
    });

    it("should fetch and normalize jobs with FiverrProProvider", async () => {
      const provider = new FiverrProProvider();
      const jobs = await provider.fetchJobs();
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs[0].source).toBe("Fiverr Pro");
    });
  });

  describe("FreelancerAgent Cognitive Operations", () => {
    let agent: FreelancerAgent;

    beforeEach(async () => {
      agent = new FreelancerAgent("agent-scout", "Freelance Automation Scout");
      await agent.initialize();
    });

    it("should calculate matching scores dynamically", () => {
      const mockProject: NormalizedFreelanceProject = {
        id: "sc-1",
        title: "TypeScript Backend Engineer",
        description: "Need React and TypeScript expert.",
        skills: ["React", "TypeScript", "Node.js"],
        budget: "$1,200",
        currency: "USD",
        hourlyOrFixed: "fixed",
        clientRating: 4.9,
        clientReviews: 10,
        clientSpending: "$10k",
        location: "US",
        proposalCount: 3,
        urgency: "high",
        source: "Upwork",
        projectUrl: "http://test.com/sc-1",
        scrapeTimestamp: new Date().toISOString()
      };

      const skillsProfile = ["React", "TypeScript", "Node.js", "Docker"];
      const scoreResult = (agent as any).calculateJobScore(mockProject, skillsProfile);

      expect(scoreResult.score).toBeGreaterThanOrEqual(80); // Excellent match
      expect(scoreResult.reasons.length).toBeGreaterThan(0);
    });

    it("should process multi-source indexing inside execute task", async () => {
      const task: Task = {
        id: "task-test-scrape",
        agentId: "agent-scout",
        priority: 10,
        createdTime: new Date().toISOString(),
        retries: 0,
        maxRetries: 3,
        currentStep: "Pending",
        progress: 0,
        status: "Queued",
        logs: [],
        metadata: { action: "search_and_analyze" }
      };

      const result = await agent.execute(task);
      expect(result.status).toBe("success");
      expect(result.projectsProcessed).toBeGreaterThan(0);
      expect(freelancerRepo.getProjects().length).toBeGreaterThan(0);
    });

    it("should draft clean personalized proposal with Gemini AI", async () => {
      // Seed a project first
      const projectId = "draft-proj-9";
      freelancerRepo.saveProject({
        id: projectId,
        title: "Senior Node.js Developer",
        description: "Need help building an Express API with Drizzle and PostgreSQL.",
        skills: ["Node.js", "Express", "PostgreSQL"],
        budget: "$5,000",
        currency: "USD",
        hourlyOrFixed: "fixed",
        clientRating: 5.0,
        clientReviews: 5,
        clientSpending: null,
        location: "United Kingdom",
        proposalCount: 2,
        urgency: "medium",
        source: "Upwork",
        projectUrl: "http://upwork.com/9",
        scrapeTimestamp: new Date().toISOString()
      });

      const task: Task = {
        id: "task-test-proposal",
        agentId: "agent-scout",
        priority: 10,
        createdTime: new Date().toISOString(),
        retries: 0,
        maxRetries: 3,
        currentStep: "Pending",
        progress: 0,
        status: "Queued",
        logs: [],
        metadata: { action: "generate_proposal", projectId, tone: "premium" }
      };

      const proposalResult = await agent.execute(task);
      expect(proposalResult).toBeDefined();
      expect(proposalResult.status).toBe("Pending Approval");
      expect(proposalResult.tone).toBe("premium");
      expect(proposalResult.proposalText).toContain("Mocked Gemini");
    });

    it("should complete submission loop safely", async () => {
      // Seed parent project first to satisfy SQLITE FOREIGN KEY constraint
      freelancerRepo.saveProject({
        id: "draft-proj-9",
        title: "Senior Node.js Developer",
        description: "Need help building an Express API with Drizzle and PostgreSQL.",
        skills: ["Node.js", "Express", "PostgreSQL"],
        budget: "$5,000",
        currency: "USD",
        hourlyOrFixed: "fixed",
        clientRating: 5.0,
        clientReviews: 5,
        clientSpending: null,
        location: "United Kingdom",
        proposalCount: 2,
        urgency: "medium",
        source: "Upwork",
        projectUrl: "http://upwork.com/9",
        scrapeTimestamp: new Date().toISOString()
      });

      const propId = "sub-prop-1";
      freelancerRepo.saveProposal({
        id: propId,
        projectId: "draft-proj-9",
        title: "Bid for Senior Node.js",
        proposalText: "My custom cover letter.",
        tone: "professional",
        status: "Approved",
        createdAt: new Date().toISOString(),
        submittedAt: null
      });

      const task: Task = {
        id: "task-test-submit",
        agentId: "agent-scout",
        priority: 10,
        createdTime: new Date().toISOString(),
        retries: 0,
        maxRetries: 3,
        currentStep: "Pending",
        progress: 0,
        status: "Queued",
        logs: [],
        metadata: { action: "submit_proposal", proposalId: propId }
      };

      const result = await agent.execute(task);
      expect(result.status).toBe("success");
      
      const updated = freelancerRepo.getProposal(propId);
      expect(updated?.status).toBe("Submitted");
      expect(updated?.submittedAt).toBeDefined();
    });
  });
});
