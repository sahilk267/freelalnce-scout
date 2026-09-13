/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RemoteOkJobProvider } from "./RemoteOkJobProvider";
import { HimalayasJobProvider } from "./HimalayasJobProvider";
import { ArbeitnowJobProvider } from "./ArbeitnowJobProvider";
import { AggregatedJobProvider } from "./AggregatedJobProvider";

describe("RemoteOkJobProvider", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should successfully fetch and map jobs from Remote OK", async () => {
    const mockData = [
      { legal: "Legal information disclaimer" },
      {
        id: "1134734",
        position: "Video Editor",
        company: "Atlanta Gladiators",
        location: "Duluth",
        epoch: 1783797868,
        tags: ["video", "ops"],
        salary_min: 50000,
        salary_max: 70000,
        url: "https://remoteok.com/job/1"
      }
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockData
    } as any);

    const provider = new RemoteOkJobProvider();
    const result = await provider.fetchJobs();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("remoteok-1134734");
    expect(result[0].title).toBe("Video Editor");
    expect(result[0].company).toBe("Atlanta Gladiators");
    expect(result[0].location).toBe("Duluth");
    expect(result[0].salary).toBe("$50,000 - $70,000");
    expect(result[0].skills).toContain("video");
    expect(result[0].originalUrl).toBe("https://remoteok.com/job/1");
  });

  it("should handle error cases and HTTP failures gracefully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 500,
      ok: false,
      statusText: "Internal Server Error"
    } as any);

    const provider = new RemoteOkJobProvider();
    await expect(provider.fetchJobs()).rejects.toThrow("Failed to fetch from Remote OK API");
  });
});

describe("HimalayasJobProvider", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should successfully fetch and map jobs from Himalayas", async () => {
    const mockData = {
      jobs: [
        {
          title: "Senior Dev",
          companyName: "Conga",
          guid: "https://himalayas.app/job/1",
          categories: ["react", "devops"],
          pubDate: 1783884349,
          locationRestrictions: ["Canada"],
          minSalary: 100000,
          maxSalary: 120000,
          currency: "USD",
          salaryPeriod: "annual",
          description: "A great job"
        }
      ]
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockData
    } as any);

    const provider = new HimalayasJobProvider();
    const result = await provider.fetchJobs();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("himalayas-1");
    expect(result[0].title).toBe("Senior Dev");
    expect(result[0].company).toBe("Conga");
    expect(result[0].location).toBe("Remote (Canada)");
    expect(result[0].salary).toBe("USD 100,000 - USD 120,000 (annual)");
    expect(result[0].skills).toContain("react");
    expect(result[0].description).toBe("A great job");
  });
});

describe("ArbeitnowJobProvider", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should successfully fetch and map jobs from Arbeitnow", async () => {
    const mockData = {
      data: [
        {
          slug: "test-slug-123",
          company_name: "fravio GmbH",
          title: "Senior Campaign Manager",
          remote: true,
          url: "https://arbeitnow.com/job/1",
          tags: ["marketing"],
          created_at: 1783879223,
          description: "<p>Work as influencer campaign manager</p>"
        }
      ]
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockData
    } as any);

    const provider = new ArbeitnowJobProvider();
    const result = await provider.fetchJobs();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("arbeitnow-test-slug-123");
    expect(result[0].title).toBe("Senior Campaign Manager");
    expect(result[0].company).toBe("fravio GmbH");
    expect(result[0].location).toBe("Remote");
    expect(result[0].skills).toContain("marketing");
  });
});

describe("AggregatedJobProvider", () => {
  it("should aggregate, deduplicate and sort jobs correctly from multiple providers", async () => {
    const aggregator = new AggregatedJobProvider();

    // Mock individual provider fetchJobs calls
    const mockRemotiveJobs = [
      {
        id: "remotive-1",
        title: "Staff React Engineer",
        company: "Stripe",
        location: "US Remote",
        salary: "$150k",
        source: "Remotive Live API",
        timestamp: "2026-07-12T10:00:00Z",
        verification: "verified" as const,
        confidence: 95,
        originalUrl: "https://stripe.com/jobs/1",
        duplicateStatus: "original" as const,
        skills: ["react"]
      }
    ];

    const mockRemoteOkJobs = [
      {
        id: "remoteok-2",
        title: "Staff React Engineer", // Duplicate by company & title
        company: "Stripe",
        location: "Remote",
        salary: "$160k",
        source: "Remote OK API",
        timestamp: "2026-07-12T09:00:00Z",
        verification: "verified" as const,
        confidence: 90,
        originalUrl: "https://stripe.com/jobs/1", // Duplicate URL too
        duplicateStatus: "original" as const,
        skills: ["react"]
      },
      {
        id: "remoteok-3",
        title: "Senior Node Developer",
        company: "Vercel",
        location: "Global Remote",
        salary: "Market Rate",
        source: "Remote OK API",
        timestamp: "2026-07-12T11:00:00Z", // Newest job
        verification: "verified" as const,
        confidence: 90,
        originalUrl: "https://vercel.com/jobs/3",
        duplicateStatus: "original" as const,
        skills: ["nodejs"]
      }
    ];

    const mockHimalayasJobs = [
      {
        id: "himalayas-4",
        title: "Lead DevOps Specialist",
        company: "Himalayas Ltd",
        location: "Remote (CA)",
        salary: "$140k",
        source: "Himalayas API",
        timestamp: "2026-07-12T08:00:00Z",
        verification: "verified" as const,
        confidence: 90,
        originalUrl: "https://himalayas.app/jobs/4",
        duplicateStatus: "original" as const,
        skills: ["devops"]
      }
    ];

    vi.spyOn(aggregator["providers"][0].instance, "fetchJobs").mockResolvedValue(mockRemotiveJobs);
    vi.spyOn(aggregator["providers"][1].instance, "fetchJobs").mockResolvedValue(mockRemoteOkJobs);
    vi.spyOn(aggregator["providers"][2].instance, "fetchJobs").mockResolvedValue(mockHimalayasJobs);
    vi.spyOn(aggregator["providers"][3].instance, "fetchJobs").mockResolvedValue([]); // Empty response

    const result = await aggregator.fetchJobs();

    // Deduplication should remove "remoteok-2" because it matches "remotive-1" (Stripe - Staff React Engineer)
    expect(result).toHaveLength(3);

    // Sorting should arrange jobs newest first:
    // 1st: Senior Node Developer (11:00:00Z)
    // 2nd: Staff React Engineer (10:00:00Z)
    // 3rd: Lead DevOps Specialist (08:00:00Z)
    expect(result[0].id).toBe("remoteok-3");
    expect(result[1].id).toBe("remotive-1");
    expect(result[2].id).toBe("himalayas-4");
  });

  it("should handle all-live provider scenario with accurate summary", async () => {
    const aggregator = new AggregatedJobProvider();

    const mockJob = (id: string, src: string, title: string) => ({
      id,
      title,
      company: `Company-${id}`,
      location: "Remote",
      salary: "$120k",
      source: src,
      timestamp: "2026-07-12T10:00:00Z",
      verification: "verified" as const,
      confidence: 95,
      originalUrl: `https://acme.com/job/${id}`,
      duplicateStatus: "original" as const,
      skills: ["typescript"]
    });

    vi.spyOn(aggregator["providers"][0].instance, "fetchJobs").mockResolvedValue([mockJob("job-1", "Remotive", "Frontend Lead")]);
    vi.spyOn(aggregator["providers"][1].instance, "fetchJobs").mockResolvedValue([mockJob("job-2", "Remote OK", "Backend Lead")]);
    vi.spyOn(aggregator["providers"][2].instance, "fetchJobs").mockResolvedValue([mockJob("job-3", "Himalayas", "Fullstack Lead")]);
    vi.spyOn(aggregator["providers"][3].instance, "fetchJobs").mockResolvedValue([mockJob("job-4", "Arbeitnow", "DevOps Lead")]);

    const result = await aggregator.fetchJobs();
    expect(result).toHaveLength(4);
    expect((result as any).summary).toEqual({ live: 4, mock: 0, failed: 0 });
    expect(aggregator.getLastSummary()).toEqual({ live: 4, mock: 0, failed: 0 });
  });

  it("should handle mixed live/mock/error scenario without throwing and track summary accurately", async () => {
    const aggregator = new AggregatedJobProvider();

    const liveJob = {
      id: "remotive-1",
      title: "Staff React Engineer",
      company: "Stripe",
      location: "US Remote",
      salary: "$150k",
      source: "Remotive Live API",
      timestamp: "2026-07-12T10:00:00Z",
      verification: "verified" as const,
      confidence: 95,
      originalUrl: "https://stripe.com/jobs/1",
      duplicateStatus: "original" as const,
      skills: ["react"]
    };

    const mockJob: any = {
      id: "remoteok-mock-1",
      title: "Fallback Engineer",
      company: "RemoteOK",
      location: "Global",
      salary: "$100k",
      source: "Remote OK",
      timestamp: "2026-07-12T10:00:00Z",
      verification: "unverified" as const,
      confidence: 70,
      originalUrl: "https://remoteok.com/fallback",
      duplicateStatus: "original" as const,
      skills: ["javascript"],
      sourceStatus: "mock"
    };

    vi.spyOn(aggregator["providers"][0].instance, "fetchJobs").mockResolvedValue([liveJob]);
    vi.spyOn(aggregator["providers"][1].instance, "fetchJobs").mockResolvedValue([mockJob]);
    vi.spyOn(aggregator["providers"][2].instance, "fetchJobs").mockRejectedValue(new Error("Timeout on Himalayas"));
    vi.spyOn(aggregator["providers"][3].instance, "fetchJobs").mockRejectedValue(new Error("Network Error on Arbeitnow"));

    const result = await aggregator.fetchJobs();
    expect(result).toHaveLength(2);
    expect((result as any).summary).toEqual({ live: 1, mock: 1, failed: 2 });
    expect(aggregator.getLastSummary()).toEqual({ live: 1, mock: 1, failed: 2 });
    const statuses = aggregator.getProviderStatuses();
    expect(statuses["Remotive"].status).toBe("live");
    expect(statuses["Remote OK"].status).toBe("mock");
    expect(statuses["Himalayas"].status).toBe("error");
    expect(statuses["Arbeitnow"].status).toBe("error");
  });

  it("should never throw when all job providers fail, returning empty results and accurate failure summary", async () => {
    const aggregator = new AggregatedJobProvider();

    vi.spyOn(aggregator["providers"][0].instance, "fetchJobs").mockRejectedValue(new Error("Err1"));
    vi.spyOn(aggregator["providers"][1].instance, "fetchJobs").mockRejectedValue(new Error("Err2"));
    vi.spyOn(aggregator["providers"][2].instance, "fetchJobs").mockRejectedValue(new Error("Err3"));
    vi.spyOn(aggregator["providers"][3].instance, "fetchJobs").mockRejectedValue(new Error("Err4"));

    const result = await aggregator.fetchJobs();
    expect(result).toHaveLength(0);
    expect((result as any).summary).toEqual({ live: 0, mock: 0, failed: 4 });
    expect(aggregator.getLastSummary()).toEqual({ live: 0, mock: 0, failed: 4 });
  });
});
