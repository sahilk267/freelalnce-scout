/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Job } from "../models/Job";
import { IJobProvider } from "./IJobProvider";
import { RemotiveJobProvider } from "./RemotiveJobProvider";
import { RemoteOkJobProvider } from "./RemoteOkJobProvider";
import { HimalayasJobProvider } from "./HimalayasJobProvider";
import { ArbeitnowJobProvider } from "./ArbeitnowJobProvider";
import { getInitialSeedProjectsForAll40Platforms } from "./InitialPlatformSeed";

export class AggregatedJobProvider implements IJobProvider {
  private providers: { name: string; instance: IJobProvider }[];
  private includeSeedData: boolean;

  constructor(options?: { includeSeedData?: boolean }) {
    this.includeSeedData = options?.includeSeedData ?? false;
    this.providers = [
      { name: "Remotive", instance: new RemotiveJobProvider() },
      { name: "Remote OK", instance: new RemoteOkJobProvider() },
      { name: "Himalayas", instance: new HimalayasJobProvider() },
      { name: "Arbeitnow", instance: new ArbeitnowJobProvider() }
    ];
  }

  async fetchJobs(): Promise<Job[]> {
    // Fetch all providers in parallel using Promise.allSettled for maximum fault tolerance
    const results = await Promise.allSettled(
      this.providers.map(async (p) => {
        try {
          const jobs = await p.instance.fetchJobs();
          return { providerName: p.name, jobs, success: true, error: null };
        } catch (err: any) {
          console.error(`[AggregatedJobProvider] Source ${p.name} failed:`, err.message || err);
          return { providerName: p.name, jobs: [] as Job[], success: false, error: err.message || String(err) };
        }
      })
    );

    let allJobs: Job[] = [];
    const failures: string[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.success) {
          allJobs.push(...result.value.jobs);
        } else if (result.value.error) {
          failures.push(`${result.value.providerName}: ${result.value.error}`);
        }
      } else {
        failures.push(`Rejected Promise: ${String(result.reason)}`);
      }
    }

    if (allJobs.length === 0 && failures.length > 0) {
      throw new Error(`All job providers failed: [${failures.join(" | ")}]`);
    }

    if (this.includeSeedData) {
      // Convert catalog seed projects into Job model records across all 40 remote platforms
      const seedProjects = getInitialSeedProjectsForAll40Platforms();
      const catalogJobs: Job[] = seedProjects.map(p => ({
        id: p.id,
        title: p.title,
        company: p.source,
        location: p.location,
        type: p.hourlyOrFixed === "hourly" ? "Contract (Hourly)" : "Full-time / Fixed",
        salary: p.budget,
        description: p.description,
        skills: p.skills,
        timestamp: p.scrapeTimestamp,
        source: p.source,
        originalUrl: p.projectUrl,
        verification: "verified" as const,
        confidence: 95,
        duplicateStatus: "original" as const
      }));

      allJobs.push(...catalogJobs);
    }

    // Deduplicate jobs by checking for identical (Company + Title) or identical OriginalUrl
    const seenKeys = new Set<string>();
    const deduplicatedJobs: Job[] = [];

    // Prioritize keeping the first occurrence
    for (const job of allJobs) {
      const cleanTitle = (job.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanCompany = (job.company || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const dedupKey = `${cleanCompany}-${cleanTitle}`;
      const urlKey = (job.originalUrl || "").toLowerCase().trim();

      if (dedupKey && seenKeys.has(dedupKey)) {
        continue;
      }
      if (urlKey && seenKeys.has(urlKey)) {
        continue;
      }

      seenKeys.add(dedupKey);
      if (urlKey) seenKeys.add(urlKey);

      deduplicatedJobs.push(job);
    }

    // Sort jobs by publication date (newest first)
    deduplicatedJobs.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });

    return deduplicatedJobs;
  }
}
