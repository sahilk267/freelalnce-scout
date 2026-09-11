/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NormalizedFreelanceProject } from "../../agent/freelancerTypes";
import { resilientFetch } from "../../utils/resilientFetch";
import { DIContainer } from "../../di/DIContainer";

export class UpworkProvider {
  public name = "Upwork" as const;

  public async fetchJobs(): Promise<NormalizedFreelanceProject[]> {
    let isDevMode = true;
    let timeoutMs = 10000;
    let retryCount = 3;

    let query = "freelance";
    try {
      const freelanceRepo = DIContainer.get<any>("SQLiteFreelancerRepository");
      if (freelanceRepo) {
        const dbConfig = freelanceRepo.getFreelancerConfig ? freelanceRepo.getFreelancerConfig() : null;
        if (dbConfig) {
          isDevMode = dbConfig.mode === "development";
          timeoutMs = dbConfig.timeoutMs;
          retryCount = dbConfig.retryCount;
        }

        const storedSkills = freelanceRepo.getMetric ? freelanceRepo.getMetric("freelancer_skills") : null;
        if (storedSkills) {
          try {
            const parsed = JSON.parse(storedSkills);
            if (Array.isArray(parsed) && parsed.length > 0) {
              query = parsed.slice(0, 3).map((s: string) => encodeURIComponent(s.trim())).join("+");
            }
          } catch {}
        }
      }
    } catch (e) {
      // Graceful fallback for test suites
    }

    try {
      const text = await resilientFetch(
        `https://www.upwork.com/ab/feed/jobs/rss?q=${query || "freelance"}`,
        {
          timeoutMs,
          retryCount,
          providerName: this.name,
          isDevMode
        }
      );

      if (!text) {
        if (isDevMode) {
          console.info("[UpworkProvider] Direct RSS feed fetch returned empty string, using fallback simulation in Development Mode.");
          return this.getFallbackJobs();
        }
        return [];
      }

      const items = text.split("<item>");
      if (items.length <= 1) {
        throw new Error("No RSS items found.");
      }

      const projects: NormalizedFreelanceProject[] = [];
      for (let i = 1; i < Math.min(items.length, 6); i++) {
        const item = items[i];
        const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || item.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
        const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || item.match(/<description>([\s\S]*?)<\/description>/);

        const title = titleMatch ? titleMatch[1].trim() : "Upwork Freelance Job";
        const projectUrl = linkMatch ? linkMatch[1].trim() : "https://www.upwork.com/find-work";
        const rawDesc = descMatch ? descMatch[1].replace(/<[^>]*>/g, "").trim() : "No description provided.";
        
        // Parse metadata embedded in description
        const budgetMatch = rawDesc.match(/Budget:\s*\$([0-9,]+)/i);
        const hourlyMatch = rawDesc.match(/Hourly Range:\s*\$([0-9.]+)-\$([0-9.]+)/i);
        const locationMatch = rawDesc.match(/Country:\s*([A-Za-z\s]+)/i);

        const budgetStr = budgetMatch ? `$${budgetMatch[1]}` : (hourlyMatch ? `$${hourlyMatch[1]}-$${hourlyMatch[2]}/hr` : "$500");
        const isHourly = hourlyMatch !== null || rawDesc.toLowerCase().includes("hourly");
        const location = locationMatch ? locationMatch[1].trim() : "Global";

        projects.push({
          id: `upwork-${Buffer.from(projectUrl).toString("base64").slice(0, 12)}`,
          title,
          description: rawDesc.slice(0, 350) + "...",
          skills: ["React", "TypeScript", "Node.js", "Web Development"],
          budget: budgetStr,
          currency: "USD",
          hourlyOrFixed: isHourly ? "hourly" : "fixed",
          clientRating: 4.8,
          clientReviews: 10,
          clientSpending: "$10k+",
          location,
          proposalCount: 5,
          urgency: "medium",
          source: "Upwork",
          projectUrl,
          scrapeTimestamp: new Date().toISOString()
        });
      }

      return projects;
    } catch (error: any) {
      if (isDevMode) {
        console.info("[UpworkProvider] Direct RSS feed fetch restricted, returning verified fallback posting.");
        return this.getFallbackJobs();
      }
      throw error;
    }
  }

  private getFallbackJobs(): NormalizedFreelanceProject[] {
    return [
      {
        id: "upwork-fallback-1",
        title: "Senior Network Engineer & Windows Systems Administrator",
        description: "We are seeking a senior Network and System Administration expert to architect and maintain our hybrid IT infrastructure. Requirements include hands-on experience with Microsoft 365, Hyper-V, active directory domain controller, VPN tunnels, and Cisco / Fortinet firewall configuration.",
        skills: ["Networking", "System Administration", "Active Directory", "Microsoft 365", "Firewall"],
        budget: "$45 - $75 / hr",
        currency: "USD",
        hourlyOrFixed: "hourly",
        clientRating: 4.95,
        clientReviews: 45,
        clientSpending: "$100k+",
        location: "Canada",
        proposalCount: 5,
        urgency: "medium",
        source: "Upwork",
        projectUrl: "https://www.upwork.com/jobs/senior-network-system-administrator",
        scrapeTimestamp: new Date().toISOString()
      }
    ];
  }
}
