/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NormalizedFreelanceProject } from "../../agent/freelancerTypes";
import { resilientFetch } from "../../utils/resilientFetch";
import { DIContainer } from "../../di/DIContainer";
import { FreelanceHealthMonitor } from "./FreelanceHealthMonitor";
import { FreelanceSourceStatus, FreelanceStatusReason } from "../IFreelanceProvider";

export class FreelancerProvider {
  public name = "Freelancer.com" as const;

  public async checkHealth(): Promise<{ status: FreelanceSourceStatus; reason?: FreelanceStatusReason }> {
    try {
      const text = await resilientFetch(
        "https://www.freelancer.com/api/projects/0.1/projects/active/?limit=1&compact=true",
        {
          timeoutMs: 3000,
          retryCount: 1,
          providerName: this.name,
          isDevMode: false
        }
      );
      if (text && text.includes('"status":"success"')) {
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
        "https://www.freelancer.com/api/projects/0.1/projects/active/?limit=10&compact=true",
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

      const data = JSON.parse(text);
      if (!data || data.status !== "success" || !data.result || !Array.isArray(data.result.projects)) {
        throw new Error("Invalid Freelancer.com API response schema.");
      }

      const projects: any[] = data.result.projects;
      const mapped = projects.map((p: any) => {
        const skills = Array.isArray(p.jobs) ? p.jobs.map((j: any) => j.name || "") : ["Software Development"];
        const budgetMin = p.budget?.minimum ?? 50;
        const budgetMax = p.budget?.maximum ?? 250;
        const currency = p.currency?.code || "USD";
        const isHourly = p.type === "hourly";

        return {
          id: `freelancer-${p.id}`,
          title: p.title || "Freelance Project",
          description: p.description || "No description provided.",
          skills,
          budget: `$${budgetMin} - $${budgetMax}`,
          currency,
          hourlyOrFixed: isHourly ? "hourly" : "fixed",
          clientRating: p.owner?.status?.payment_verified ? 4.9 : 4.0,
          clientReviews: p.owner?.status?.email_verified ? 5 : 1,
          clientSpending: p.owner?.status?.deposit_made ? "$1k+" : "$100+",
          location: p.owner?.location?.country?.name || "Global",
          proposalCount: p.bid_stats?.bid_count || 0,
          urgency: p.urgent ? "high" : "medium",
          source: "Freelancer",
          projectUrl: `https://www.freelancer.com/projects/${p.seo_url || p.id}`,
          scrapeTimestamp: new Date().toISOString(),
          sourceStatus: "live"
        };
      });

      monitor.recordStatus(this.name, "live");
      const retProjects: any = mapped;
      retProjects.sourceStatus = "live";
      return retProjects;
    } catch (error: any) {
      const reason: FreelanceStatusReason = error?.message?.toLowerCase().includes("timeout")
        ? "timeout"
        : error?.message?.toLowerCase().includes("schema")
        ? "parse_failed"
        : "blocked_403";
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
        id: "freelancer-fallback-1",
        title: "Enterprise Network Infrastructure & System Administration Support",
        description: "Looking for an experienced IT Systems & Network Engineer to configure and maintain our office IT infrastructure, including Cisco routers, Fortinet firewall, Windows Server Active Directory, and remote hardware troubleshooting.",
        skills: ["Networking", "System Administration", "Computer Hardware", "Windows Server", "Firewall"],
        budget: "$1500 - $3000",
        currency: "USD",
        hourlyOrFixed: "fixed",
        clientRating: 4.8,
        clientReviews: 12,
        clientSpending: "$5k+",
        location: "United States",
        proposalCount: 4,
        urgency: "high",
        source: "Freelancer",
        projectUrl: "https://www.freelancer.com/projects/network-system-admin-support",
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
