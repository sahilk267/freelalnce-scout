/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Job } from "../models/Job";
import { IJobProvider } from "./IJobProvider";

export class RemotiveJobProvider implements IJobProvider {
  async fetchJobs(): Promise<Job[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch("https://remotive.com/api/remote-jobs?limit=20", {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new Error("Remotive API rate limit exceeded.");
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch from Remotive API: HTTP ${response.status} ${response.statusText}`);
      }

      let data: any;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("Failed to parse Remotive API JSON response.");
      }

      if (!data || !Array.isArray(data.jobs)) {
        throw new Error("Invalid schema received from Remotive API (missing 'jobs' array).");
      }

      return data.jobs.map((j: any) => ({
        id: `remotive-${j.id}`,
        title: j.title || "Software Developer",
        company: j.company_name || "Unknown Company",
        location: j.candidate_required_location || "Remote",
        salary: j.salary || "Market Rate",
        source: "Remotive Live API",
        timestamp: j.publication_date || new Date().toISOString(),
        verification: "verified" as const,
        confidence: 95,
        originalUrl: j.url || "https://remotive.com",
        duplicateStatus: "original" as const,
        skills: j.tags || [],
        description: j.description || ""
      }));
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error("Remotive API request timed out (limit 8s).");
      }
      throw new Error(`RemotiveJobProvider network/API failure: ${err.message || err}`);
    }
  }
}
