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
  private lastSummary: { live: number; mock: number; failed: number } = { live: 0, mock: 0, failed: 0 };
  private lastProviderStatuses: Record<string, { status: "live" | "mock" | "error"; reason?: string }> = {};

  constructor(options?: { includeSeedData?: boolean }) {
    this.includeSeedData = options?.includeSeedData ?? false;
    this.providers = [
      { name: "Remotive", instance: new RemotiveJobProvider() },
      { name: "Remote OK", instance: new RemoteOkJobProvider() },
      { name: "Himalayas", instance: new HimalayasJobProvider() },
      { name: "Arbeitnow", instance: new ArbeitnowJobProvider() }
    ];
  }

  public getLastSummary(): { live: number; mock: number; failed: number } {
    return { ...this.lastSummary };
  }

  public getProviderStatuses(): Record<string, { status: "live" | "mock" | "error"; reason?: string }> {
    return { ...this.lastProviderStatuses };
  }

  async fetchJobs(): Promise<Job[]> {
    const timeoutMs = 5000;
    const summary = { live: 0, mock: 0, failed: 0 };
    const providerStatuses: Record<string, { status: "live" | "mock" | "error"; reason?: string }> = {};

    // Fetch all providers in parallel using Promise.allSettled with per-provider timeout safety
    const results = await Promise.allSettled(
      this.providers.map(async (p) => {
        try {
          const fetchPromise = p.instance.fetchJobs();
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
          );
          const jobs = await Promise.race([fetchPromise, timeoutPromise]);
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
        const item = result.value;
        if (item.success) {
          const isMock = (item.jobs as any).sourceStatus === "mock" ||
            (item.jobs.length > 0 && ((item.jobs[0] as any).sourceStatus === "mock" || (item.jobs[0] as any).isMock));
          if (isMock) {
            summary.mock++;
            providerStatuses[item.providerName] = { status: "mock" };
          } else {
            summary.live++;
            providerStatuses[item.providerName] = { status: "live" };
          }
          allJobs.push(...item.jobs);
        } else {
          summary.failed++;
          const reason = item.error?.includes("Timeout") ? "timeout" : "network_error";
          providerStatuses[item.providerName] = { status: "error", reason };
          failures.push(`${item.providerName}: ${item.error}`);
        }
      } else {
        summary.failed++;
        failures.push(`Rejected Promise: ${String(result.reason)}`);
      }
    }

    if (allJobs.length === 0 && failures.length > 0) {
      console.warn(`[AggregatedJobProvider] All job providers failed: [${failures.join(" | ")}]. Degrading gracefully without throwing.`);
    }

    this.lastSummary = { ...summary };
    this.lastProviderStatuses = { ...providerStatuses };

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

    (deduplicatedJobs as any).summary = { ...this.lastSummary };
    (deduplicatedJobs as any).providerStatuses = { ...this.lastProviderStatuses };

    return deduplicatedJobs;
  }
}
