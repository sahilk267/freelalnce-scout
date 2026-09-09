/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Job } from "../models/Job";
import { IJobProvider } from "./IJobProvider";

export class HimalayasJobProvider implements IJobProvider {
  async fetchJobs(): Promise<Job[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch("https://himalayas.app/jobs/api/search?limit=30", {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new Error("Himalayas API rate limit exceeded.");
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch from Himalayas API: HTTP ${response.status} ${response.statusText}`);
      }

      let data: any;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("Failed to parse Himalayas API JSON response.");
      }

      if (!data || !Array.isArray(data.jobs)) {
        throw new Error("Invalid schema received from Himalayas API (missing 'jobs' array).");
      }

      return data.jobs.map((j: any) => {
        let isoTimestamp = new Date().toISOString();
        if (j.pubDate) {
          isoTimestamp = new Date(j.pubDate * 1000).toISOString();
        }

        // Format salary if min/max exists
        let salaryStr = "Market Rate";
        if (j.minSalary && j.maxSalary) {
          const formattedMin = j.currency ? `${j.currency} ${j.minSalary.toLocaleString()}` : `$${j.minSalary.toLocaleString()}`;
          const formattedMax = j.currency ? `${j.currency} ${j.maxSalary.toLocaleString()}` : `$${j.maxSalary.toLocaleString()}`;
          salaryStr = `${formattedMin} - ${formattedMax} (${j.salaryPeriod || "annual"})`;
        } else if (j.minSalary) {
          salaryStr = j.currency ? `${j.currency} ${j.minSalary.toLocaleString()}+` : `$${j.minSalary.toLocaleString()}+`;
        } else if (j.maxSalary) {
          salaryStr = j.currency ? `Up to ${j.currency} ${j.maxSalary.toLocaleString()}` : `Up to $${j.maxSalary.toLocaleString()}`;
        }

        // Format location based on restrictions
        let locationStr = "Remote";
        if (Array.isArray(j.locationRestrictions) && j.locationRestrictions.length > 0) {
          locationStr = `Remote (${j.locationRestrictions.join(", ")})`;
        }

        const idSuffix = j.guid ? j.guid.split("/").pop() || Math.random().toString(36).substr(2, 9) : Math.random().toString(36).substr(2, 9);

        return {
          id: `himalayas-${idSuffix}`,
          title: j.title || "Software Developer",
          company: j.companyName || "Unknown Company",
          location: locationStr,
          salary: salaryStr,
          source: "Himalayas API",
          timestamp: isoTimestamp,
          verification: "verified" as const,
          confidence: 90,
          originalUrl: j.applicationLink || j.guid || "https://himalayas.app",
          duplicateStatus: "original" as const,
          skills: j.categories || [],
          description: j.description || j.excerpt || ""
        };
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error("Himalayas API request timed out (limit 8s).");
      }
      throw new Error(`HimalayasJobProvider failure: ${err.message || err}`);
    }
  }
}
