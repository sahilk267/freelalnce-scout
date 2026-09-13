/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NormalizedFreelanceProject } from "../../agent/freelancerTypes";
import { resilientFetch } from "../../utils/resilientFetch";
import { DIContainer } from "../../di/DIContainer";
import { FreelanceHealthMonitor } from "./FreelanceHealthMonitor";
import { FreelanceSourceStatus, FreelanceStatusReason } from "../IFreelanceProvider";

export class UpworkProvider {
  public name = "Upwork" as const;

  public async checkHealth(): Promise<{ status: FreelanceSourceStatus; reason?: FreelanceStatusReason }> {
    const hasOfficialKey = Boolean(process.env.UPWORK_API_KEY || process.env.UPWORK_ACCESS_TOKEN);
    if (hasOfficialKey) {
      return { status: "live", reason: "official_api_active" };
    }
    // Public scraper ping
    try {
      const text = await resilientFetch("https://www.upwork.com/ab/feed/jobs/rss?q=react", {
        timeoutMs: 3000,
        retryCount: 1,
        providerName: this.name,
        isDevMode: false
      });
      if (text && text.includes("<item>")) {
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

    // Check preferred official partner API path
    const officialApiKey = process.env.UPWORK_API_KEY || process.env.UPWORK_ACCESS_TOKEN;
    if (officialApiKey) {
      try {
        const officialProjects = await this.fetchOfficialApiJobs(officialApiKey);
        if (officialProjects && officialProjects.length > 0) {
          monitor.recordStatus(this.name, "live", "official_api_active", true);
          const res: any = officialProjects;
          res.sourceStatus = "live";
          res.statusReason = "official_api_active";
          return res;
        }
      } catch (err: any) {
        console.warn("[UpworkProvider] Official partner API call failed, falling back to public feed:", err?.message || err);
      }
    }

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
          monitor.recordStatus(this.name, "mock", "blocked_403");
          return this.getFallbackJobs("blocked_403");
        }
        monitor.recordStatus(this.name, "error", "blocked_403");
        const emptyRes: any = [];
        emptyRes.sourceStatus = "error";
        emptyRes.statusReason = "blocked_403";
        return emptyRes;
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
          scrapeTimestamp: new Date().toISOString(),
          sourceStatus: "live"
        });
      }

      monitor.recordStatus(this.name, "live");
      const retProjects: any = projects;
      retProjects.sourceStatus = "live";
      return retProjects;
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

  private async fetchOfficialApiJobs(apiKey: string): Promise<NormalizedFreelanceProject[]> {
    const res = await fetch("https://api.upwork.com/v3/jobs/search?q=technology&limit=5", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });
    if (!res.ok) {
      throw new Error(`Upwork official API returned ${res.status}`);
    }
    const data = await res.json();
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    return jobs.map((j: any) => ({
      id: `upwork-${j.id || Math.random().toString(36).slice(2, 8)}`,
      title: j.title || "Enterprise Upwork Opportunity",
      description: j.snippet || j.description || "Official Upwork job contract.",
      skills: Array.isArray(j.skills) ? j.skills : ["Software Engineering"],
      budget: j.amount ? `$${j.amount}` : "$1000",
      currency: "USD",
      hourlyOrFixed: j.job_type === "hourly" ? "hourly" : "fixed",
      clientRating: 5.0,
      clientReviews: 50,
      clientSpending: "$50k+",
      location: j.client?.country || "Global",
      proposalCount: j.proposals_tier || 5,
      urgency: "high",
      source: "Upwork",
      projectUrl: j.ciphertext ? `https://www.upwork.com/jobs/${j.ciphertext}` : "https://www.upwork.com",
      scrapeTimestamp: new Date().toISOString(),
      sourceStatus: "live",
      sourceStatusReason: "official_api_active"
    }));
  }

  private getFallbackJobs(reason: FreelanceStatusReason = "blocked_403"): NormalizedFreelanceProject[] {
    const projects: NormalizedFreelanceProject[] = [
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
