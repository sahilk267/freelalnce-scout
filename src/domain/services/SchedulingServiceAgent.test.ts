/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SchedulingServiceAgent } from "./SchedulingServiceAgent";
import { InMemorySchedulingRepository } from "../repositories/InMemorySchedulingRepository";
import { InMemoryCalendarProvider } from "../providers/InMemoryCalendarProvider";

describe("SchedulingServiceAgent & Feature 4 Self-Scheduling", () => {
  let repo: InMemorySchedulingRepository;
  let calendarProvider: InMemoryCalendarProvider;
  let service: SchedulingServiceAgent;

  beforeEach(() => {
    repo = new InMemorySchedulingRepository();
    calendarProvider = new InMemoryCalendarProvider();
    service = new SchedulingServiceAgent(repo, calendarProvider);
  });

  it("1. Should generate candidate invite with 24h token TTL and SHA-256 hash storage", async () => {
    const invite = await service.generateCandidateInvite({
      candidateId: "cand_001",
      candidateName: "Rohan Verma",
      candidateEmail: "rohan@example.com",
      interviewerId: "int_01",
      interviewerName: "Sarah Connor (Eng Lead)",
      autoBookEnabled: false
    });

    expect(invite.session.id).toBeDefined();
    expect(invite.session.status).toBe("invited");
    expect(invite.token).toBeDefined();
    expect(invite.session.sessionTokenHash).not.toBe(invite.token); // Hashed, not raw string
    expect(new Date(invite.session.tokenExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("2. Should validate session token using timing-safe comparison", async () => {
    const invite = await service.generateCandidateInvite({
      candidateId: "cand_001",
      candidateName: "Rohan Verma",
      candidateEmail: "rohan@example.com",
      interviewerId: "int_01",
      interviewerName: "Sarah Connor (Eng Lead)"
    });

    const validSession = await service.validateSessionToken(invite.session.id, invite.token);
    expect(validSession).not.toBeNull();
    expect(validSession?.id).toBe(invite.session.id);

    const invalidSession = await service.validateSessionToken(invite.session.id, "wrong_token_123");
    expect(invalidSession).toBeNull();
  });

  it("3. Should list available interviewer slots", async () => {
    const invite = await service.generateCandidateInvite({
      candidateId: "cand_001",
      candidateName: "Rohan Verma",
      candidateEmail: "rohan@example.com",
      interviewerId: "int_01",
      interviewerName: "Sarah Connor (Eng Lead)"
    });

    const slots = await service.getAvailableSlots(invite.session.id);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].status).toBe("available");
  });

  it("4. Should hold slot for 48 hours when autoBookEnabled is false", async () => {
    const invite = await service.generateCandidateInvite({
      candidateId: "cand_001",
      candidateName: "Rohan Verma",
      candidateEmail: "rohan@example.com",
      interviewerId: "int_01",
      interviewerName: "Sarah Connor (Eng Lead)",
      autoBookEnabled: false
    });

    const slots = await service.getAvailableSlots(invite.session.id);
    const targetSlot = slots[0];

    const result = await service.selectSlot(invite.session.id, invite.token, targetSlot.id);
    expect(result.success).toBe(true);
    expect(result.session?.status).toBe("pending_confirmation");
    expect(result.session?.selectedSlotId).toBe(targetSlot.id);

    const slotInDb = await repo.findSlotById(targetSlot.id);
    expect(slotInDb?.status).toBe("pending_confirmation");
    expect(slotInDb?.holdExpiresAt).toBeDefined();
  });

  it("5. Should prevent double-booking / concurrent slot locks", async () => {
    const invite1 = await service.generateCandidateInvite({
      candidateId: "cand_001",
      candidateName: "Rohan Verma",
      candidateEmail: "rohan@example.com",
      interviewerId: "int_01",
      interviewerName: "Sarah Connor (Eng Lead)"
    });

    const invite2 = await service.generateCandidateInvite({
      candidateId: "cand_002",
      candidateName: "Anya Sharma",
      candidateEmail: "anya@example.com",
      interviewerId: "int_01",
      interviewerName: "Sarah Connor (Eng Lead)"
    });

    const slots = await service.getAvailableSlots(invite1.session.id);
    const targetSlot = slots[0];

    // Candidate 1 selects slot
    const res1 = await service.selectSlot(invite1.session.id, invite1.token, targetSlot.id);
    expect(res1.success).toBe(true);

    // Candidate 2 attempts to select same slot
    const res2 = await service.selectSlot(invite2.session.id, invite2.token, targetSlot.id);
    expect(res2.success).toBe(false);
    expect(res2.statusCode).toBe(409);
    expect(res2.error).toContain("conflict");
  });

  it("6. Should allow recruiter to confirm pending booking", async () => {
    const invite = await service.generateCandidateInvite({
      candidateId: "cand_001",
      candidateName: "Rohan Verma",
      candidateEmail: "rohan@example.com",
      interviewerId: "int_01",
      interviewerName: "Sarah Connor (Eng Lead)",
      autoBookEnabled: false
    });

    const slots = await service.getAvailableSlots(invite.session.id);
    const targetSlot = slots[0];

    await service.selectSlot(invite.session.id, invite.token, targetSlot.id);

    const confirmRes = await service.confirmBooking(invite.session.id);
    expect(confirmRes.success).toBe(true);
    expect(confirmRes.session?.status).toBe("confirmed");

    const slotInDb = await repo.findSlotById(targetSlot.id);
    expect(slotInDb?.status).toBe("booked");
    expect(slotInDb?.calendarEventId).toBeDefined();
  });

  it("7. Should sweep expired 48h holds and release slot back to availability", async () => {
    const invite = await service.generateCandidateInvite({
      candidateId: "cand_001",
      candidateName: "Rohan Verma",
      candidateEmail: "rohan@example.com",
      interviewerId: "int_01",
      interviewerName: "Sarah Connor (Eng Lead)",
      autoBookEnabled: false
    });

    const slots = await service.getAvailableSlots(invite.session.id);
    const targetSlot = slots[0];

    await service.selectSlot(invite.session.id, invite.token, targetSlot.id);

    // Manually expire the slot's hold timestamp to simulate 48h passage
    const expiredTime = new Date(Date.now() - 1000).toISOString();
    const slotInDb = await repo.findSlotById(targetSlot.id);
    if (slotInDb) {
      slotInDb.holdExpiresAt = expiredTime;
      await repo.saveSlot(slotInDb);
    }

    // Trigger sweep
    const result = await repo.sweepExpiredHolds();
    expect(result.expiredCount).toBe(1);

    const refreshedSlot = await repo.findSlotById(targetSlot.id);
    expect(refreshedSlot?.status).toBe("available");

    const refreshedSession = await repo.findSessionById(invite.session.id);
    expect(refreshedSession?.status).toBe("hold_expired");
  });

  it("8. Should transition session to needs_human_review when compensation fails", async () => {
    const invite = await service.generateCandidateInvite({
      candidateId: "cand_001",
      candidateName: "Rohan Verma",
      candidateEmail: "rohan@example.com",
      interviewerId: "int_01",
      interviewerName: "Sarah Connor (Eng Lead)",
      autoBookEnabled: true
    });

    const slots = await service.getAvailableSlots(invite.session.id);
    const targetSlot = slots[0];

    // Mock calendar provider createEvent to throw error
    calendarProvider.createEvent = async () => {
      throw new Error("Calendar service connection failed");
    };

    // Mock repo atomicReleaseSlot to also throw error (compensation failure)
    repo.atomicReleaseSlot = async () => {
      throw new Error("Database storage failure during compensation");
    };

    const result = await service.selectSlot(invite.session.id, invite.token, targetSlot.id);
    expect(result.success).toBe(false);
    expect(result.session?.status).toBe("needs_human_review");
    expect(result.error).toContain("recruiter review");

    const auditLogs = await repo.listAuditLogs(invite.session.id);
    const compFailedLog = auditLogs.find(l => l.action === "compensation_failed");
    expect(compFailedLog).toBeDefined();
    expect(compFailedLog?.status).toBe("needs_human_review");
  });

  it("9. Should require valid session token or admin mode when cancelling booking", async () => {
    const invite = await service.generateCandidateInvite({
      candidateId: "cand_001",
      candidateName: "Rohan Verma",
      candidateEmail: "rohan@example.com",
      interviewerId: "int_01",
      interviewerName: "Sarah Connor (Eng Lead)",
      autoBookEnabled: false
    });

    const slots = await service.getAvailableSlots(invite.session.id);
    await service.selectSlot(invite.session.id, invite.token, slots[0].id);

    // 1. Missing token without admin flag
    const noTokenRes = await service.cancelBooking(invite.session.id, "Candidate cancelled");
    expect(noTokenRes.success).toBe(false);
    expect(noTokenRes.statusCode).toBe(401);
    expect(noTokenRes.error).toContain("Missing session token");

    // 2. Invalid token
    const invalidTokenRes = await service.cancelBooking(invite.session.id, "Candidate cancelled", "wrong_token");
    expect(invalidTokenRes.success).toBe(false);
    expect(invalidTokenRes.statusCode).toBe(401);
    expect(invalidTokenRes.error).toContain("Unauthorized or expired session token");

    // 3. Valid candidate token
    const validCancelRes = await service.cancelBooking(invite.session.id, "Candidate had conflict", invite.token);
    expect(validCancelRes.success).toBe(true);
    expect(validCancelRes.session?.status).toBe("cancelled");

    // Check slot was released
    const slotAfterCancel = await repo.findSlotById(slots[0].id);
    expect(slotAfterCancel?.status).toBe("available");

    // 4. Repeated cancel returns 400
    const repeatedCancel = await service.cancelBooking(invite.session.id, "Try again", invite.token);
    expect(repeatedCancel.success).toBe(false);
    expect(repeatedCancel.statusCode).toBe(400);

    // 5. Admin mode can cancel without token
    const invite2 = await service.generateCandidateInvite({
      candidateId: "cand_002",
      candidateName: "Anya Sharma",
      candidateEmail: "anya@example.com",
      interviewerId: "int_01",
      interviewerName: "Sarah Connor (Eng Lead)",
      autoBookEnabled: false
    });
    const slots2 = await service.getAvailableSlots(invite2.session.id);
    await service.selectSlot(invite2.session.id, invite2.token, slots2[0].id);

    const adminCancelRes = await service.cancelBooking(invite2.session.id, "Admin cancellation", undefined, true);
    expect(adminCancelRes.success).toBe(true);
    expect(adminCancelRes.session?.status).toBe("cancelled");
  });
});
