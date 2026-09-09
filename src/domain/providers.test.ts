/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FreelanceScoutProvider } from "./providers/FreelanceScoutProvider";
import { GeminiClientProvider } from "./providers/GeminiClientProvider";

describe("FreelanceScoutProvider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should successfully fetch and map freelance/contract jobs", async () => {
    const mockJobs = {
      jobs: [
        {
          id: "123",
          title: "Senior React Developer",
          job_type: "contract",
          salary: "$100/hr",
          publication_date: "2026-07-12T00:00:00Z",
          url: "https://remotive.com/job/123",
          tags: ["react", "typescript"],
          description: "<p>We are looking for a freelance React engineer.</p>"
        },
        {
          id: "456",
          title: "Python Backend",
          job_type: "full_time",
          salary: "$120k",
          publication_date: "2026-07-12T00:00:00Z",
          url: "https://remotive.com/job/456",
          tags: ["python", "freelance"],
          description: "Full-time python but has freelance tag"
        },
        {
          id: "789",
          title: "Full-time Dev",
          job_type: "full_time",
          salary: "$100k",
          publication_date: "2026-07-12T00:00:00Z",
          url: "https://remotive.com/job/789",
          tags: ["java"],
          description: "Strictly full-time with no contract tags"
        }
      ]
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockJobs
    } as any);

    const provider = new FreelanceScoutProvider();
    const result = await provider.fetchFreelanceProjects();

    // Out of 3 jobs, first and second match contract/freelance filter criteria.
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("free-123");
    expect(result[0].title).toBe("Senior React Developer");
    expect(result[0].platform).toBe("Remotive Contracts");
    expect(result[0].budget).toBe("$100/hr");
    expect(result[0].verification).toBe("verified");
    expect(result[0].confidence).toBe(90);
    expect(result[0].skills).toContain("react");
    expect(result[0].description).toBe("We are looking for a freelance React engineer....");

    expect(result[1].id).toBe("free-456");
  });

  it("should handle HTTP 429 rate limits", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 429,
      ok: false,
      statusText: "Too Many Requests"
    } as any);

    const provider = new FreelanceScoutProvider();
    await expect(provider.fetchFreelanceProjects()).rejects.toThrow(
      "Remotive API rate limit exceeded."
    );
  });

  it("should handle generic HTTP errors", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 500,
      ok: false,
      statusText: "Internal Server Error"
    } as any);

    const provider = new FreelanceScoutProvider();
    await expect(provider.fetchFreelanceProjects()).rejects.toThrow(
      "Failed to fetch from Remotive API: HTTP 500 Internal Server Error"
    );
  });

  it("should handle invalid JSON responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => {
        throw new Error("Bad JSON syntax");
      }
    } as any);

    const provider = new FreelanceScoutProvider();
    await expect(provider.fetchFreelanceProjects()).rejects.toThrow(
      "Failed to parse Remotive API JSON response."
    );
  });

  it("should handle invalid schema structure missing jobs key", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        categories: []
      })
    } as any);

    const provider = new FreelanceScoutProvider();
    await expect(provider.fetchFreelanceProjects()).rejects.toThrow(
      "Invalid schema received from Remotive API (missing 'jobs' array)."
    );
  });
});

describe("GeminiClientProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should throw an error if GEMINI_API_KEY is not defined", () => {
    delete process.env.GEMINI_API_KEY;
    const provider = new GeminiClientProvider();
    expect(() => provider.getClient()).toThrow(
      "GEMINI_API_KEY is not configured in secrets/environment variables."
    );
  });

  it("should successfully initialize the GoogleGenAI client when a key is present", () => {
    process.env.GEMINI_API_KEY = "dummy-test-key";
    const provider = new GeminiClientProvider();
    const client = provider.getClient();
    expect(client).toBeDefined();
    // Test that the client is cached on consecutive calls
    const secondClient = provider.getClient();
    expect(secondClient).toBe(client);
  });
});
