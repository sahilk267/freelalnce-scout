/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SQLiteFreelancerRepository } from "./repositories/SQLiteFreelancerRepository";
import { ResumeParserService } from "./services/ResumeParserService";
import { NotificationService } from "./services/NotificationService";
import { FreelancerNotification } from "./agent/freelancerTypes";

describe("Freelancer Agent Extension Subsystem Tests", () => {
  let freelancerRepo: SQLiteFreelancerRepository;

  beforeEach(() => {
    // Initialize repository in memory
    freelancerRepo = new SQLiteFreelancerRepository(":memory:");
  });

  afterEach(() => {
    freelancerRepo.close();
  });

  describe("ResumeParserService", () => {
    it("should successfully parse a resume text using fallback local heuristic regex parser", async () => {
      const parser = new ResumeParserService(); // No Gemini client passed, triggers local regex fallback
      const sampleCV = `JOHN DOE
Full Stack developer with 8 years of experience building scalable systems.
Skills: React, TypeScript, Node.js, SQLite, Tailwind CSS, Docker.
Looking for challenging Remote projects.`;

      const result = await parser.parseResume(sampleCV);

      expect(result.name).toBe("JOHN DOE");
      expect(result.experienceYears).toBe(8);
      expect(result.locationPreference).toBe("Remote");
      expect(result.skills).toContain("React");
      expect(result.skills).toContain("TypeScript");
      expect(result.skills).toContain("Node.js");
      expect(result.skills).toContain("SQLite");
    });

    it("should successfully parse a resume using Gemini Client", async () => {
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify({
          name: "Alice Smith",
          skills: ["React", "TypeScript", "Python"],
          experienceYears: 5,
          locationPreference: "Remote"
        })
      });

      const mockGeminiClient = {
        models: {
          generateContent: mockGenerateContent
        }
      } as any;

      const parser = new ResumeParserService(mockGeminiClient);
      const result = await parser.parseResume("Alice Smith, 5 years experience, React, Python");

      expect(result.name).toBe("Alice Smith");
      expect(result.experienceYears).toBe(5);
      expect(result.locationPreference).toBe("Remote");
      expect(result.skills).toEqual(["React", "TypeScript", "Python"]);
    });
  });

  describe("Durable Notifications & NotificationService", () => {
    it("should save, fetch, and mark notifications as read correctly in SQLiteFreelancerRepository", () => {
      const notif: FreelancerNotification = {
        id: "notif-1",
        type: "MATCH",
        message: "High-value match: Senior React Role found",
        projectId: "proj-1",
        proposalId: "prop-1",
        read: false,
        createdAt: new Date().toISOString()
      };

      freelancerRepo.saveNotification(notif);

      const list = freelancerRepo.getNotifications();
      expect(list.length).toBe(1);
      expect(list[0].id).toBe("notif-1");
      expect(list[0].read).toBe(false);

      freelancerRepo.markNotificationAsRead("notif-1");
      const listAfterRead = freelancerRepo.getNotifications();
      expect(listAfterRead[0].read).toBe(true);
    });

    it("should dispatch formatting notifications successfully via NotificationService", () => {
      const notifService = new NotificationService(freelancerRepo);
      
      notifService.notifyError("Simulation platform connection timed out.");

      const list = freelancerRepo.getNotifications();
      expect(list.length).toBe(1);
      expect(list[0].type).toBe("ERROR");
      expect(list[0].message).toContain("Simulation platform connection timed out");
    });
  });
});
