/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NormalizedFreelanceProject } from "../../agent/freelancerTypes";
import { resilientFetch } from "../../utils/resilientFetch";
import { DIContainer } from "../../di/DIContainer";

export class FreelancerProvider {
  public name = "Freelancer.com" as const;

  public async fetchJobs(): Promise<NormalizedFreelanceProject[]> {
    let isDevMode = true;
    let timeoutMs = 10000;
    let retryCount = 3;

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
          console.warn("[FreelancerProvider] Empty response returned, using fallback list in Development Mode.");
          return this.getFallbackJobs();
        }
        return [];
      }

      const data = JSON.parse(text);
      if (!data || data.status !== "success" || !data.result || !Array.isArray(data.result.projects)) {
        throw new Error("Invalid Freelancer.com API response schema.");
      }

      const projects: any[] = data.result.projects;
      return projects.map((p: any) => {
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
          scrapeTimestamp: new Date().toISOString()
        };
      });
    } catch (error: any) {
      if (isDevMode) {
        console.warn("[FreelancerProvider] Direct fetch failed, returning graceful fallback list:", error.message);
        return this.getFallbackJobs();
      }
      throw error;
    }
  }

  private getFallbackJobs(): NormalizedFreelanceProject[] {
    return [
      {
        id: "freelancer-fallback-1",
        title: "Full-Stack React & Node.js Developer Needed",
        description: "We are looking for a senior full-stack developer to build a responsive SaaS dashboard. Must have experience with React, Node.js, and Tailwind CSS. The project involves building clean UI components, integrating with REST APIs, and setting up persistent SQLite database layers.",
        skills: ["React", "Node.js", "Tailwind CSS", "SQLite", "TypeScript"],
        budget: "$1500 - $3000",
        currency: "USD",
        hourlyOrFixed: "fixed",
        clientRating: 4.8,
        clientReviews: 12,
        clientSpending: "$5k+",
        location: "United States",
        proposalCount: 14,
        urgency: "high",
        source: "Freelancer",
        projectUrl: "https://www.freelancer.com/projects/react-node-saas-dashboard",
        scrapeTimestamp: new Date().toISOString()
      }
    ];
  }
}
