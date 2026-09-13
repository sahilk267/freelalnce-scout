/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GoogleCalendarProvider } from "./GoogleCalendarProvider";
import { InMemoryInterviewerCalendarRepository } from "../repositories/InMemoryInterviewerCalendarRepository";
import { SQLiteInterviewerCalendarRepository } from "../repositories/SQLiteInterviewerCalendarRepository";
import { encryptRefreshToken, decryptRefreshToken } from "../utils/calendarEncryption";
import { RetryService } from "../services/RetryService";
import { PersistenceConfigService } from "../services/PersistenceConfigService";
import { InMemorySchedulingRepository } from "../repositories/InMemorySchedulingRepository";
import { SchedulingServiceAgent } from "../services/SchedulingServiceAgent";

describe("Google Calendar Integration & Provider Suite", () => {
  describe("Token Encryption & Decryption", () => {
    it("successfully encrypts and decrypts a refresh token using AES-256-GCM", () => {
      const originalToken = "1//04test_google_oauth_refresh_token_xyz_123456789";
      const encrypted = encryptRefreshToken(originalToken);
      
      expect(encrypted).not.toEqual(originalToken);
      expect(encrypted.split(":")).toHaveLength(3); // iv:authTag:ciphertext

      const decrypted = decryptRefreshToken(encrypted);
      expect(decrypted).toEqual(originalToken);
    });

    it("throws an error when tampering with encrypted payload or auth tag", () => {
      const originalToken = "1//04valid_refresh_token";
      const encrypted = encryptRefreshToken(originalToken);
      const parts = encrypted.split(":");
      
      // Tamper with ciphertext
      const tampered = `${parts[0]}:${parts[1]}:corrupted_ciphertext_abc`;
      expect(() => decryptRefreshToken(tampered)).toThrow();
    });

    it("throws error for malformed token strings", () => {
      expect(() => decryptRefreshToken("invalid-format")).toThrow(/Malformed encrypted token payload format/);
    });
  });

  describe("InterviewerCalendarRepository Implementations", () => {
    it("InMemoryInterviewerCalendarRepository correctly performs CRUD operations", async () => {
      const repo = new InMemoryInterviewerCalendarRepository();
      
      const account = {
        interviewerId: "int_test_1",
        interviewerName: "Test Interviewer",
        encryptedRefreshToken: encryptRefreshToken("test_token_1"),
        scope: "https://www.googleapis.com/auth/calendar.events",
        connectedAt: new Date().toISOString(),
        status: "connected" as const,
        workingHours: {
          startHour: 9,
          endHour: 17,
          timeZone: "UTC",
          daysOfWeek: [1, 2, 3, 4, 5]
        }
      };

      await repo.saveAccount(account);
      const retrieved = await repo.getAccount("int_test_1");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.interviewerName).toBe("Test Interviewer");

      await repo.updateStatus("int_test_1", "needs_reconnect", "Token revoked by user");
      const updated = await repo.getAccount("int_test_1");
      expect(updated?.status).toBe("needs_reconnect");
      expect(updated?.lastError).toBe("Token revoked by user");

      const list = await repo.listAccounts();
      expect(list).toHaveLength(1);

      await repo.deleteAccount("int_test_1");
      expect(await repo.getAccount("int_test_1")).toBeNull();
    });

    it("SQLiteInterviewerCalendarRepository works with in-memory SQLite database", async () => {
      const repo = new SQLiteInterviewerCalendarRepository(":memory:");
      
      const account = {
        interviewerId: "int_sqlite_1",
        interviewerName: "Dr. Vance",
        encryptedRefreshToken: encryptRefreshToken("refresh_1234"),
        scope: "https://www.googleapis.com/auth/calendar.events",
        connectedAt: new Date().toISOString(),
        status: "connected" as const
      };

      await repo.saveAccount(account);
      const retrieved = await repo.getAccount("int_sqlite_1");
      expect(retrieved?.interviewerId).toBe("int_sqlite_1");
      expect(retrieved?.status).toBe("connected");

      await repo.updateWorkingHours("int_sqlite_1", {
        startHour: 10,
        endHour: 16,
        timeZone: "UTC",
        daysOfWeek: [2, 3, 4]
      });

      const updated = await repo.getAccount("int_sqlite_1");
      expect(updated?.workingHours?.startHour).toBe(10);
      expect(updated?.workingHours?.daysOfWeek).toEqual([2, 3, 4]);

      await repo.deleteAccount("int_sqlite_1");
      expect(await repo.getAccount("int_sqlite_1")).toBeNull();
    });
  });

  describe("GoogleCalendarProvider Logic & Resilience", () => {
    let repo: InMemoryInterviewerCalendarRepository;
    let retryService: RetryService;
    let configService: PersistenceConfigService;
    let provider: GoogleCalendarProvider;

    beforeEach(() => {
      repo = new InMemoryInterviewerCalendarRepository();
      configService = new PersistenceConfigService();
      configService.updateConfig({ retryDelayMs: 5, retryMaxDelayMs: 15, retryCount: 2 });
      retryService = new RetryService(configService);
      provider = new GoogleCalendarProvider(repo, retryService, configService);
    });

    it("returns empty availability when interviewer has not connected a calendar", async () => {
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      const slots = await provider.searchAvailability("unconnected_interviewer", now.toISOString(), nextWeek.toISOString());
      expect(slots).toEqual([]);
    });

    it("returns empty availability and preserves status when account is in needs_reconnect", async () => {
      await repo.saveAccount({
        interviewerId: "revoked_interviewer",
        encryptedRefreshToken: encryptRefreshToken("bad_token"),
        scope: "https://www.googleapis.com/auth/calendar.events",
        connectedAt: new Date().toISOString(),
        status: "needs_reconnect",
        lastError: "invalid_grant"
      });

      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      const slots = await provider.searchAvailability("revoked_interviewer", now.toISOString(), nextWeek.toISOString());
      expect(slots).toEqual([]);
    });

    it("marks account as needs_reconnect when a Google token revocation error is encountered", async () => {
      await repo.saveAccount({
        interviewerId: "interviewer_revoked_at_runtime",
        interviewerName: "Sarah Connor",
        encryptedRefreshToken: encryptRefreshToken("revoked_token"),
        scope: "https://www.googleapis.com/auth/calendar.events",
        connectedAt: new Date().toISOString(),
        status: "connected"
      });

      // Mock authenticated client to simulate Google API throwing invalid_grant
      const mockCalendarClient = {
        freebusy: {
          query: vi.fn().mockRejectedValue(new Error("invalid_grant: Token has been expired or revoked."))
        },
        events: {
          insert: vi.fn(),
          delete: vi.fn()
        }
      };

      (provider as any).getAuthenticatedClient = vi.fn().mockResolvedValue({
        oauth2Client: {},
        calendar: mockCalendarClient,
        interviewerName: "Sarah Connor"
      });

      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      const slots = await provider.searchAvailability("interviewer_revoked_at_runtime", now.toISOString(), nextWeek.toISOString());

      expect(slots).toEqual([]);
      const updatedAccount = await repo.getAccount("interviewer_revoked_at_runtime");
      expect(updatedAccount?.status).toBe("needs_reconnect");
      expect(updatedAccount?.lastError).toContain("invalid_grant");
    });

    it("creates calendar event with Google Meet link and returns eventId", async () => {
      await repo.saveAccount({
        interviewerId: "int_ok",
        interviewerName: "Dr. Sarah Vance",
        encryptedRefreshToken: encryptRefreshToken("good_token"),
        scope: "https://www.googleapis.com/auth/calendar.events",
        connectedAt: new Date().toISOString(),
        status: "connected"
      });

      const mockCalendarClient = {
        events: {
          insert: vi.fn().mockResolvedValue({
            data: {
              id: "gcal_event_123456",
              hangoutLink: "https://meet.google.com/abc-defg-hij",
              htmlLink: "https://calendar.google.com/event?eid=xyz"
            }
          })
        }
      };

      (provider as any).getAuthenticatedClient = vi.fn().mockResolvedValue({
        oauth2Client: {},
        calendar: mockCalendarClient,
        interviewerName: "Dr. Sarah Vance"
      });

      const result = await provider.createEvent({
        interviewerId: "int_ok",
        candidateId: "cand_1",
        candidateName: "John Doe",
        candidateEmail: "john@example.com",
        slotStart: "2026-04-10T14:00:00.000Z",
        slotEnd: "2026-04-10T14:45:00.000Z",
        summary: "Technical Interview - John Doe",
        description: "Interview session with Dr. Sarah Vance"
      });

      expect(result.eventId).toBe("gcal_event_123456");
      expect(result.meetUrl).toBe("https://meet.google.com/abc-defg-hij");
      expect(mockCalendarClient.events.insert).toHaveBeenCalledTimes(1);
    });

    it("cancels calendar event via Google Calendar API delete", async () => {
      await repo.saveAccount({
        interviewerId: "int_ok",
        encryptedRefreshToken: encryptRefreshToken("good_token"),
        scope: "https://www.googleapis.com/auth/calendar.events",
        connectedAt: new Date().toISOString(),
        status: "connected"
      });

      const mockCalendarClient = {
        events: {
          delete: vi.fn().mockResolvedValue({ data: {} })
        }
      };

      (provider as any).getAuthenticatedClient = vi.fn().mockResolvedValue({
        oauth2Client: {},
        calendar: mockCalendarClient
      });

      await provider.cancelEvent("gcal_event_123456", "int_ok");
      expect(mockCalendarClient.events.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: "primary",
          eventId: "gcal_event_123456"
        })
      );
    });

    it("triggers compensation rollback in SchedulingServiceAgent if Google Calendar event creation fails", async () => {
      const schedRepo = new InMemorySchedulingRepository();
      
      // Inject an interviewer account
      await repo.saveAccount({
        interviewerId: "int_vance",
        interviewerName: "Dr. Sarah Vance",
        encryptedRefreshToken: encryptRefreshToken("token_vance"),
        scope: "https://www.googleapis.com/auth/calendar.events",
        connectedAt: new Date().toISOString(),
        status: "connected"
      });

      // Provider throws error on createEvent
      const mockCalendarClient = {
        events: {
          insert: vi.fn().mockRejectedValue(new Error("Google Calendar API 503 Service Unavailable"))
        }
      };
      (provider as any).getAuthenticatedClient = vi.fn().mockResolvedValue({
        oauth2Client: {},
        calendar: mockCalendarClient
      });

      const agent = new SchedulingServiceAgent(schedRepo, provider);

      // Create invite with autoBookEnabled: true
      const { session, token: rawToken } = await agent.generateCandidateInvite({
        candidateId: "cand_99",
        candidateEmail: "candidate@example.com",
        candidateName: "Alex Mercer",
        interviewerId: "int_vance",
        interviewerName: "Dr. Sarah Vance",
        autoBookEnabled: true
      });

      // Insert an available slot into schedRepo
      const slot = await schedRepo.createSlot({
        id: "slot_test_123",
        interviewerId: "int_vance",
        interviewerName: "Dr. Sarah Vance",
        slotStart: "2026-04-12T15:00:00.000Z",
        slotEnd: "2026-04-12T15:45:00.000Z",
        status: "available"
      });

      // Candidate selects slot with autoBookEnabled
      // Google Calendar creation fails -> DB atomic lock rollback -> session status needs_human_review
      const selectResult = await agent.selectSlot(session.id, rawToken, slot.id);
      expect(selectResult.success).toBe(false);
      expect(selectResult.error).toContain("Calendar booking failed");

      // Verify that slot status was rolled back to 'available'
      const updatedSlot = await schedRepo.findSlotById(slot.id);
      expect(updatedSlot?.status).toBe("available");

      // Verify that session was preserved as 'invited' for candidate retry
      const updatedSession = await schedRepo.findSessionById(session.id);
      expect(updatedSession?.status).toBe("invited");
    });
  });
});
