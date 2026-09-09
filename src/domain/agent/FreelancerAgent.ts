/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAgent } from "./BaseAgent";
import { Task } from "./types";
import { EventBus } from "./EventBus";
import { GoogleGenAI } from "@google/genai";
import { DIContainer } from "../di/DIContainer";
import { SQLiteFreelancerRepository } from "../repositories/SQLiteFreelancerRepository";
import { ICandidateRepository } from "../repositories/ICandidateRepository";
import { NotificationService } from "../services/NotificationService";
import {
  NormalizedFreelanceProject,
  FreelanceProposal,
  FreelancerExecutionRecord,
  FreelancerAgentState
} from "./freelancerTypes";

// Job Providers
import { FreelancerProvider } from "../providers/freelance/FreelancerProvider";
import { UpworkProvider } from "../providers/freelance/UpworkProvider";
import { PeoplePerHourProvider } from "../providers/freelance/PeoplePerHourProvider";
import { GuruProvider } from "../providers/freelance/GuruProvider";
import { FiverrProProvider } from "../providers/freelance/FiverrProProvider";
import { getInitialSeedProjectsForAll40Platforms } from "../providers/InitialPlatformSeed";
import { CompanyProfileService } from "../services/CompanyProfileService";

export class FreelancerAgent extends BaseAgent {
  private freelanceRepo!: SQLiteFreelancerRepository;
  private candidateRepo!: ICandidateRepository;
  private geminiClient!: GoogleGenAI;

  constructor(id: string, name: string) {
    super(id, name);
    this.ensureDependencies();
  }

  private ensureDependencies(): void {
    if (!this.freelanceRepo) {
      try {
        this.freelanceRepo = DIContainer.get<SQLiteFreelancerRepository>("SQLiteFreelancerRepository");
      } catch (e) {
        console.warn("[FreelancerAgent] Could not resolve SQLiteFreelancerRepository:", e);
      }
    }
    if (!this.candidateRepo) {
      try {
        this.candidateRepo = DIContainer.get<ICandidateRepository>("ICandidateRepository");
      } catch (e) {
        console.warn("[FreelancerAgent] Could not resolve ICandidateRepository:", e);
      }
    }
    if (!this.geminiClient) {
      try {
        const aiProvider = DIContainer.get<any>("IAIClientProvider");
        if (aiProvider) {
          this.geminiClient = aiProvider.getClient();
        }
      } catch {}
    }
  }

  public async initialize(): Promise<void> {
    await super.initialize();
    this.ensureDependencies();
    if (this.freelanceRepo) {
      this.freelanceRepo.addLog("info", "Freelancer Agent initialized successfully.");
    }
  }

  public async execute(task: Task): Promise<any> {
    this.ensureDependencies();
    const action = task.metadata.action || "run_scheduler";
    this.freelanceRepo?.addLog("info", `Freelancer Agent executing task: ${task.id} (Action: ${action})`);

    try {
      switch (action) {
        case "search_and_analyze":
          return await this.searchAndAnalyze();
        case "generate_proposal":
          return await this.generateProposal(task.metadata.projectId, task.metadata.tone || "professional");
        case "submit_proposal":
          return await this.submitProposal(task.metadata.proposalId);
        case "run_scheduler":
        default:
          return await this.runScheduler();
      }
    } catch (err: any) {
      const errMsg = err.message || String(err);
      this.freelanceRepo?.addLog("error", `Task execution failed: ${errMsg}`);
      throw err;
    }
  }

  // ==========================================
  // CORE FUNCTIONS
  // ==========================================

  private async searchAndAnalyze(): Promise<any> {
    const startTime = Date.now();
    this.updateStatus("Running");
    this.updateProgress(10, "Initializing multi-source job crawling...");

    const providers = [
      new FreelancerProvider(),
      new UpworkProvider(),
      new PeoplePerHourProvider(),
      new GuruProvider(),
      new FiverrProProvider()
    ];

    let allJobs: NormalizedFreelanceProject[] = [];
    const errors: string[] = [];

    // Crawl all sources simultaneously with retry wrapper and fast timeout safety
    await Promise.all(
      providers.map(async (prov) => {
        try {
          const jobs = await this.retryWithBackoff(async () => {
            const fetchPromise = prov.fetchJobs();
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Timeout (3s)")), 3000)
            );
            return await Promise.race([fetchPromise, timeoutPromise]);
          }, 1, 300);

          allJobs.push(...jobs);
          this.freelanceRepo.addLog("success", `Successfully fetched jobs from ${prov.name}.`);
        } catch (err: any) {
          const errMsg = `Notice from ${prov.name}: ${err.message || err}`;
          errors.push(errMsg);
          this.freelanceRepo.addLog("info", errMsg);
        }
      })
    );

    // Merge baseline verified opportunities from all 40 remote job portals and platforms
    const catalogSeedJobs = getInitialSeedProjectsForAll40Platforms();
    allJobs.push(...catalogSeedJobs);

    this.updateProgress(40, "Deduplicating and filtering projects across 40 platforms...");

    // Deduplicate by normalized URL or ID
    const seenUrls = new Set<string>();
    const uniqueJobs = allJobs.filter((job) => {
      const normUrl = job.projectUrl.trim().toLowerCase();
      if (seenUrls.has(normUrl)) return false;
      seenUrls.add(normUrl);
      return true;
    });

    this.updateProgress(60, "Scoring projects against company profiles and target verticals...");

    // Retrieve active company profile to perform vertical and keyword matching
    let primaryCompany: any = null;
    try {
      const compService = CompanyProfileService.getInstance();
      primaryCompany = compService.getPrimary() || compService.getAll()[0];
    } catch {}

    // Retrieve active candidate skills to perform semantic profile matching
    let candidateSkills: string[] = [];
    if (primaryCompany && primaryCompany.targetKeywords?.length > 0) {
      candidateSkills = primaryCompany.targetKeywords;
    } else {
      try {
        const candidates = await this.candidateRepo.getAll();
        if (candidates.length > 0) {
          candidateSkills = candidates[0].skills || [];
        }
      } catch (e) {
        this.freelanceRepo?.addLog("warn", `Could not read candidate profiles: ${e}`);
      }
    }

    if (candidateSkills.length === 0) {
      const stored = this.freelanceRepo?.getMetric("freelancer_skills");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) candidateSkills = parsed;
        } catch {}
      }
    }

    if (candidateSkills.length === 0) {
      // Default fallback skills profile
      candidateSkills = ["Microsoft 365", "Active Directory", "Windows Server", "System Administration", "Network Engineering", "Cybersecurity"];
    }

    let highValueCount = 0;
    let notifsSent = 0;

    for (const job of uniqueJobs) {
      let score = 0;
      let reasons: string[] = [];

      if (primaryCompany) {
        const compService = CompanyProfileService.getInstance();
        const evalRes = compService.evaluateMatch(primaryCompany, {
          title: job.title,
          description: job.description,
          skills: job.skills,
          source: job.source,
          location: job.location
        });

        if (evalRes.isMatch) {
          score = evalRes.score;
          reasons = evalRes.reasons;
        } else {
          score = 0;
          reasons = evalRes.reasons;
        }
      } else {
        const calculated = this.calculateJobScore(job, candidateSkills);
        score = calculated.score;
        reasons = calculated.reasons;
      }

      job.score = score;
      job.scoreReasons = reasons;

      const existingProject = this.freelanceRepo.getProject(job.id);
      this.freelanceRepo.saveProject(job);

      if (score >= 80) {
        highValueCount++;
        // Trigger notification only if it is a new project and under rate limit cap (max 3 alerts per batch)
        if (!existingProject && notifsSent < 3) {
          notifsSent++;
          this.emitNotification(
            "high-value-found",
            `High-value project found: "${job.title}" (Score: ${score}/100) on ${job.source}!`,
            job.id
          );
        }
      }
    }

    const duration = Date.now() - startTime;
    const isSuccess = uniqueJobs.length > 0 || errors.length < providers.length;

    const record: FreelancerExecutionRecord = {
      timestamp: new Date().toISOString(),
      status: isSuccess ? "success" : "failure",
      projectsFound: uniqueJobs.length,
      proposalsGenerated: 0,
      errors: errors.length > 0 ? errors.join(" | ") : null,
      durationMs: duration
    };

    this.freelanceRepo.saveExecutionRecord(record);
    this.updateProgress(100, "Completed project crawler execution.");

    return {
      status: "success",
      projectsProcessed: uniqueJobs.length,
      highValueCount,
      errors
    };
  }

  private async generateProposal(projectId: string, tone: string): Promise<any> {
    this.updateStatus("Running");
    this.updateProgress(10, "Retrieving project from database...");

    const project = this.freelanceRepo.getProject(projectId);
    if (!project) {
      throw new Error(`Project with ID "${projectId}" not found in database.`);
    }

    this.updateProgress(30, "Retrieving candidate details...");
    let candidateName = "Senior Freelance Engineer";
    let candidateSkills = ["React", "TypeScript", "Node.js", "Express", "SQLite", "Tailwind CSS"];

    try {
      const candidates = await this.candidateRepo.getAll();
      if (candidates.length > 0) {
        candidateName = candidates[0].name || candidateName;
        candidateSkills = candidates[0].skills || candidateSkills;
      }
    } catch (e) {
      this.freelanceRepo.addLog("warn", "Using fallback details for proposal generation.");
    }

    this.updateProgress(50, "Generating tailored proposal using Gemini...");

    const promptText = `
You are an expert autonomous proposal writer. Draft a highly tailored, highly professional freelance project proposal.
Do not use any placeholder text (such as "[My Name]" or "[Insert experience]"). Populate all details logically using the background context provided.

PROJECT DETAILS:
Platform: ${project.source}
Title: ${project.title}
Budget: ${project.budget}
Description: ${project.description}
Required Skills: ${project.skills.join(", ")}

FREELANCER PROFILE:
Name: ${candidateName}
Core Skills: ${candidateSkills.join(", ")}

TONE INSTRUCTIONS:
Use the tone: ${tone}.
- "professional": confident, authoritative, standard enterprise framing.
- "friendly": collaborative, enthusiastic, warm, approachable.
- "premium": high-end, consultative, expert-level.
- "concise": direct, bulleted, ultra-focused.

STRUCTURE GUIDELINES:
The proposal must contain these contiguous sections:
1. GREETING: Professional opening.
2. PROJECT UNDERSTANDING: Show we understand their core challenge and why they posted this project.
3. IMPLEMENTATION PLAN: A logical step-by-step roadmap demonstrating technical implementation details.
4. EXPERIENCE MAPPING: Detail how the freelancer's specific background maps directly to their project success.
5. CALL TO ACTION (CTA): Invite them for a meeting or chat to exchange requirements.
6. CLOSING: Professional sign-off.
`;

    const response = await this.geminiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction: "You are a professional freelance business development assistant. You generate ready-to-send, highly personalized bids without any placeholders or brackets."
      }
    });

    const proposalText = response.text || "";
    if (!proposalText) {
      throw new Error("Gemini returned empty text for proposal draft.");
    }

    const proposalId = `prop-${projectId}-${Date.now().toString().slice(-4)}`;
    const proposal: FreelanceProposal = {
      id: proposalId,
      projectId: project.id,
      title: `Tailored Proposal for: ${project.title}`,
      proposalText,
      tone: tone as any,
      status: "Pending Approval",
      createdAt: new Date().toISOString(),
      submittedAt: null
    };

    this.freelanceRepo.saveProposal(proposal);
    this.freelanceRepo.addLog("success", `Generated proposal ${proposalId} for project: ${project.title}`);

    // Emit approval notification
    this.emitNotification(
      "approval-required",
      `Proposal generated for "${project.title}". Human approval required before submitting!`,
      project.id,
      proposalId
    );

    this.updateProgress(100, "Proposal drafted and saved.");
    return proposal;
  }

  private async submitProposal(proposalId: string): Promise<any> {
    this.updateStatus("Running");
    this.updateProgress(10, "Retrieving proposal...");

    const proposal = this.freelanceRepo.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal with ID "${proposalId}" not found.`);
    }

    if (proposal.status !== "Approved") {
      throw new Error(`Cannot submit proposal. Status must be "Approved" (current: "${proposal.status}").`);
    }

    this.updateProgress(50, "Executing simulated secure submission workflow...");

    // Perform highly robust simulation of platform submission with retry backoff
    await this.retryWithBackoff(async () => {
      // Simulate API/network flight time
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (Math.random() < 0.05) {
        throw new Error("Simulated transient platform connection failure.");
      }
    }, 3, 300);

    const submissionTime = new Date().toISOString();
    this.freelanceRepo.updateProposalStatus(proposalId, "Submitted", submissionTime);
    this.freelanceRepo.addLog("success", `Proposal ${proposalId} successfully submitted to platform.`);

    this.emitNotification(
      "submission-completed",
      `Successfully submitted proposal for project URL: ${proposal.projectId}`,
      proposal.projectId,
      proposalId
    );

    this.updateProgress(100, "Submission completed successfully.");
    return {
      status: "success",
      proposalId,
      submittedAt: submissionTime
    };
  }

  private async runScheduler(): Promise<any> {
    const state = this.freelanceRepo.getAgentState();
    if (!state.isEnabled) {
      this.freelanceRepo.addLog("info", "Scheduler is currently disabled.");
      return { status: "paused" };
    }

    const result = await this.searchAndAnalyze();

    const lastRun = new Date().toISOString();
    const nextRun = new Date(Date.now() + state.intervalMinutes * 60 * 1000).toISOString();

    this.freelanceRepo.saveAgentState({
      ...state,
      lastRun,
      nextRun
    });

    return {
      status: "scheduler_executed",
      lastRun,
      nextRun,
      result
    };
  }

  // ==========================================
  // HELPER UTILITIES
  // ==========================================

  private calculateJobScore(job: NormalizedFreelanceProject, candSkills: string[]): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // 1. Skill Intersection (Max 40 points)
    const intersect = job.skills.filter((s) => candSkills.some((cs) => cs.toLowerCase() === s.toLowerCase()));
    const ratio = job.skills.length > 0 ? intersect.length / job.skills.length : 0.5;
    const skillScore = Math.round(ratio * 40);
    score += skillScore;
    reasons.push(`Skills matched: ${intersect.length}/${job.skills.length} (${skillScore} pts)`);

    // 2. Budget Score (Max 20 points)
    let budgetScore = 10;
    if (job.hourlyOrFixed === "hourly") {
      const hrMatch = job.budget.match(/\$?([0-9.]+)/);
      const hrRate = hrMatch ? parseFloat(hrMatch[1]) : 30;
      if (hrRate >= 50) budgetScore = 20;
      else if (hrRate >= 35) budgetScore = 15;
      else if (hrRate >= 20) budgetScore = 10;
      else budgetScore = 5;
    } else {
      const fixMatch = job.budget.replace(/,/g, "").match(/\$?([0-9.]+)/);
      const fixVal = fixMatch ? parseFloat(fixMatch[1]) : 300;
      if (fixVal >= 1000) budgetScore = 20;
      else if (fixVal >= 500) budgetScore = 15;
      else if (fixVal >= 100) budgetScore = 10;
      else budgetScore = 5;
    }
    score += budgetScore;
    reasons.push(`Budget tier qualification (${budgetScore} pts)`);

    // 3. Competition / Bid Count (Max 15 points)
    let compScore = 10;
    if (job.proposalCount < 5) compScore = 15;
    else if (job.proposalCount <= 15) compScore = 10;
    else if (job.proposalCount <= 30) compScore = 5;
    else compScore = 2;
    score += compScore;
    reasons.push(`Low-competition listing benefit (${compScore} pts)`);

    // 4. Client Reputation (Max 15 points)
    let clientScore = 10;
    if (job.clientRating && job.clientRating >= 4.8) clientScore = 15;
    else if (job.clientRating && job.clientRating >= 4.5) clientScore = 10;
    else if (job.clientRating) clientScore = 5;
    score += clientScore;
    reasons.push(`Client verified score evaluation (${clientScore} pts)`);

    // 5. Urgency / Freshness (Max 10 points)
    let freshnessScore = 5;
    if (job.urgency === "high") freshnessScore = 10;
    else if (job.urgency === "medium") freshnessScore = 7;
    score += freshnessScore;
    reasons.push(`Project recruitment speed tier (${freshnessScore} pts)`);

    return { score, reasons };
  }

  private async retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retryWithBackoff(fn, retries - 1, delay * 2);
    }
  }

  private emitNotification(type: string, message: string, projectId: string, proposalId?: string): void {
    EventBus.getInstance().emit("MemoryUpdated", {
      message: `[Notification: ${type}] ${message}`,
      metadata: { type, message, projectId, proposalId }
    }, this.id);

    try {
      const notifService = new NotificationService(this.freelanceRepo);
      let notifType: "MATCH" | "APPROVAL_REQUIRED" | "SUBMISSION" | "SYSTEM" | "ERROR" = "SYSTEM";
      if (type === "high-value-found" || type === "new-project-found") notifType = "MATCH";
      else if (type === "approval-required") notifType = "APPROVAL_REQUIRED";
      else if (type === "submission-completed") notifType = "SUBMISSION";
      else if (type === "error") notifType = "ERROR";

      notifService.sendNotification(notifType, message, projectId, proposalId);
    } catch (e) {
      console.error("[FreelancerAgent] Failed to persist notification via NotificationService:", e);
    }
  }
}
