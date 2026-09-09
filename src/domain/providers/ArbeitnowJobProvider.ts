/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Job } from "../models/Job";
import { IJobProvider } from "./IJobProvider";

export class ArbeitnowJobProvider implements IJobProvider {
  async fetchJobs(): Promise<Job[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch("https://www.arbeitnow.com/api/job-board-api", {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new Error("Arbeitnow API rate limit exceeded.");
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch from Arbeitnow API: HTTP ${response.status} ${response.statusText}`);
      }

      let data: any;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("Failed to parse Arbeitnow API JSON response.");
      }

      if (!data || !Array.isArray(data.data)) {
        throw new Error("Invalid schema received from Arbeitnow API (missing 'data' array).");
      }

      return data.data.map((j: any) => {
        let isoTimestamp = new Date().toISOString();
        if (j.created_at) {
          isoTimestamp = new Date(j.created_at * 1000).toISOString();
        }

        const locationStr = j.remote ? "Remote" : (j.location || "On-site");

        return {
          id: `arbeitnow-${j.slug || Math.random().toString(36).substr(2, 9)}`,
          title: j.title || "Software Developer",
          company: j.company_name || "Unknown Company",
          location: locationStr,
          salary: "Market Rate",
          source: "Arbeitnow API",
          timestamp: isoTimestamp,
          verification: "verified" as const,
          confidence: 85,
          originalUrl: j.url || "https://www.arbeitnow.com",
          duplicateStatus: "original" as const,
          skills: j.tags || [],
          description: j.description || ""
        };
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error("Arbeitnow API request timed out (limit 8s).");
      }
      throw new Error(`ArbeitnowJobProvider failure: ${err.message || err}`);
    }
  }
}
