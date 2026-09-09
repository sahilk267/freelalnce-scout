/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Job } from "../models/Job";
import { IJobProvider } from "./IJobProvider";

export class RemoteOkJobProvider implements IJobProvider {
  async fetchJobs(): Promise<Job[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch("https://remoteok.com/api", {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new Error("Remote OK API rate limit exceeded.");
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch from Remote OK API: HTTP ${response.status} ${response.statusText}`);
      }

      let data: any;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("Failed to parse Remote OK API JSON response.");
      }

      if (!data || !Array.isArray(data)) {
        throw new Error("Invalid schema received from Remote OK API (expected root array).");
      }

      // Filter out legal disclaimer/metadata element (usually index 0)
      const jobsData = data.filter((item: any) => item && !item.legal && item.id);

      return jobsData.map((j: any) => {
        // Map epoch or date to ISO string
        let isoTimestamp = new Date().toISOString();
        if (j.epoch) {
          isoTimestamp = new Date(j.epoch * 1000).toISOString();
        } else if (j.date) {
          isoTimestamp = new Date(j.date).toISOString();
        }

        // Format salary from min & max if present
        let salaryStr = "Market Rate";
        if (j.salary_min && j.salary_max) {
          salaryStr = `$${j.salary_min.toLocaleString()} - $${j.salary_max.toLocaleString()}`;
        } else if (j.salary_min) {
          salaryStr = `$${j.salary_min.toLocaleString()}+`;
        } else if (j.salary_max) {
          salaryStr = `Up to $${j.salary_max.toLocaleString()}`;
        }

        return {
          id: `remoteok-${j.id}`,
          title: j.position || "Software Developer",
          company: j.company || "Unknown Company",
          location: j.location || "Remote",
          salary: salaryStr,
          source: "Remote OK API",
          timestamp: isoTimestamp,
          verification: "verified" as const,
          confidence: 90,
          originalUrl: j.url || j.apply_url || "https://remoteok.com",
          duplicateStatus: "original" as const,
          skills: j.tags || [],
          description: j.description || ""
        };
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error("Remote OK API request timed out (limit 8s).");
      }
      throw new Error(`RemoteOkJobProvider failure: ${err.message || err}`);
    }
  }
}
