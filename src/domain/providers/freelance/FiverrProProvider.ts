/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NormalizedFreelanceProject } from "../../agent/freelancerTypes";
import { resilientFetch } from "../../utils/resilientFetch";
import { DIContainer } from "../../di/DIContainer";
import { FreelanceHealthMonitor } from "./FreelanceHealthMonitor";
import { FreelanceSourceStatus, FreelanceStatusReason } from "../IFreelanceProvider";

export class FiverrProProvider {
  public name = "Fiverr Pro" as const;

  public async checkHealth(): Promise<{ status: FreelanceSourceStatus; reason?: FreelanceStatusReason }> {
    try {
      const text = await resilientFetch("https://pro.fiverr.com/api/v1/jobs/active", {
        timeoutMs: 3000,
        retryCount: 1,
        providerName: this.name,
        isDevMode: false
      });
      if (text && text.length > 200 && !text.includes("restricted") && !text.includes("Access Denied")) {
        return { status: "live" };
      }
      return { status: "mock", reason: "blocked_403" };
    } catch {
      return { status: "mock", reason: "blocked_403" };
    }
  }

  public async fetchJobs(): Promise<NormalizedFreelanceProject[]> {
    let isDevMode = true;
    let timeoutMs = 10000;
    let retryCount = 3;
    const monitor = FreelanceHealthMonitor.getInstance();

    try {
      const freelanceRepo = DIContainer.get<any>("SQLiteFreelancerRepository");
      if (freelanceRepo) {
        const dbConfig = freelanceRepo.getFreelancerConfig ? freelanceRepo.getFreelancerConfig() : null;
        if (dbConfig) {
          isDevMode = dbConfig.mode === "development";
          timeoutMs = dbConfig.timeoutMs;
          retryCount = dbConfig.retryCount;
        }
      }
    } catch (e) {
      // Graceful fallback for test suites
    }

    try {
      const text = await resilientFetch(
        "https://pro.fiverr.com/api/v1/jobs/active",
        {
          timeoutMs,
          retryCount,
          providerName: this.name,
          isDevMode
        }
      );

      if (!text) {
        if (isDevMode) {
          monitor.recordStatus(this.name, "mock", "blocked_403");
          return this.getFallbackJobs("blocked_403");
        }
        monitor.recordStatus(this.name, "error", "blocked_403");
        const emptyRes: any = [];
        emptyRes.sourceStatus = "error";
        emptyRes.statusReason = "blocked_403";
        return emptyRes;
      }

      throw new Error("Fiverr public access restricted.");
    } catch (error: any) {
      const reason: FreelanceStatusReason = error?.message?.toLowerCase().includes("timeout") ? "timeout" : "blocked_403";
      if (isDevMode) {
        monitor.recordStatus(this.name, "mock", reason);
        return this.getFallbackJobs(reason);
      }
      monitor.recordStatus(this.name, "error", reason);
      const emptyRes: any = [];
      emptyRes.sourceStatus = "error";
      emptyRes.statusReason = reason;
      return emptyRes;
    }
  }

  private getFallbackJobs(reason: FreelanceStatusReason = "blocked_403"): NormalizedFreelanceProject[] {
    const projects: NormalizedFreelanceProject[] = [
      {
        id: "fiverrpro-fallback-1",
        title: "Custom Portfolio Web Development & Performance Refinements",
        description: "Need a skilled developer to build a modern portfolio website for an executive. The site must support clean animations (motion/react), feature custom theme layouts, and achieve perfect 100/100 Lighthouse performance scores.",
        skills: ["React", "CSS3", "Vite", "Animation", "Lighthouse"],
        budget: "$1200",
        currency: "USD",
        hourlyOrFixed: "fixed",
        clientRating: 5.0,
        clientReviews: 18,
        clientSpending: "$8k+",
        location: "Australia",
        proposalCount: 2,
        urgency: "medium",
        source: "Fiverr Pro",
        projectUrl: "https://pro.fiverr.com/jobs/custom-portfolio-web-development-performance",
        scrapeTimestamp: new Date().toISOString(),
        sourceStatus: "mock",
        sourceStatusReason: reason
      }
    ];
    const res: any = projects;
    res.sourceStatus = "mock";
    res.statusReason = reason;
    return res;
  }
}
