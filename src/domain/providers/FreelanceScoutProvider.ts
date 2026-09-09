/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FreelanceProject } from "../models/FreelanceProject";
import { IFreelanceProvider } from "./IFreelanceProvider";
import { getInitialSeedProjectsForAll40Platforms } from "./InitialPlatformSeed";
import { resolveDirectJobUrl } from "../utils/projectUrlHelper";

export class FreelanceScoutProvider implements IFreelanceProvider {
  private includeSeedData: boolean;

  constructor(options?: { includeSeedData?: boolean }) {
    this.includeSeedData = options?.includeSeedData ?? false;
  }

  async fetchFreelanceProjects(): Promise<FreelanceProject[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let remoteJobs: FreelanceProject[] = [];

    try {
      const response = await fetch("https://remotive.com/api/remote-jobs?limit=30", {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Remotive API rate limit exceeded.");
        }
        throw new Error(`Failed to fetch from Remotive API: HTTP ${response.status} ${response.statusText}`);
      }

      let data: any;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error("Failed to parse Remotive API JSON response.");
      }

      if (!data || !Array.isArray(data.jobs)) {
        throw new Error("Invalid schema received from Remotive API (missing 'jobs' array).");
      }

      remoteJobs = data.jobs
        .filter((j: any) => 
          j.job_type === "contract" || 
          j.job_type === "part_time" || 
          (j.tags && j.tags.some((t: string) => t.toLowerCase().includes("contract") || t.toLowerCase().includes("freelance")))
        )
        .map((j: any) => ({
          id: `free-${j.id}`,
          title: j.title || "Freelance Developer",
          platform: "Remotive Contracts",
          budget: j.salary || "Contract Rate",
          postedTime: j.publication_date ? new Date(j.publication_date).toLocaleDateString() : "Recently",
          verification: "verified" as const,
          confidence: 90,
          originalUrl: resolveDirectJobUrl({
            platform: "Remotive",
            title: j.title || "Freelance Developer",
            skills: j.tags,
            originalUrl: j.url
          }),
          skills: j.tags || ["Web Development"],
          description: j.description ? j.description.replace(/<[^>]*>/g, "").slice(0, 300) + "..." : "No description."
        }));
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }

    if (this.includeSeedData) {
      // Convert catalog seed projects into FreelanceProject records across all 40 platforms
      const catalogSeed = getInitialSeedProjectsForAll40Platforms();
      const catalogFreelanceProjects: FreelanceProject[] = catalogSeed.map(p => ({
        id: `cat-${p.id}`,
        title: p.title,
        platform: p.source,
        budget: p.budget,
        postedTime: "Recently Verified",
        verification: "verified" as const,
        confidence: 95,
        originalUrl: p.projectUrl,
        skills: p.skills,
        description: p.description
      }));

      return [...remoteJobs, ...catalogFreelanceProjects];
    }

    return remoteJobs;
  }
}
