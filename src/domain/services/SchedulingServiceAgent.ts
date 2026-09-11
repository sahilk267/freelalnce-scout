/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from "crypto";
import { 
  generateSchedulingToken, 
  hashToken, 
  ICalendarProvider, 
  InterviewerSlot, 
  SchedulingAuditLog, 
  SchedulingSession 
} from "../models/Scheduling";
import { ISchedulingRepository } from "../repositories/ISchedulingRepository";

export class SchedulingServiceAgent {
  constructor(
    private schedulingRepo: ISchedulingRepository,
    private calendarProvider: ICalendarProvider
  ) {}

  async generateCandidateInvite(params: {
    candidateId: string;
    candidateName: string;
    candidateEmail: string;
    interviewerId: string;
    interviewerName: string;
    autoBookEnabled?: boolean;
    ttlHours?: number;
  }): Promise<{ session: SchedulingSession; token: string }> {
    const rawToken = generateSchedulingToken();
    const tokenHash = hashToken(rawToken);
    const ttl = params.ttlHours || 24;
    const now = new Date();
    const tokenExpiresAt = new Date(now.getTime() + ttl * 3600 * 1000).toISOString();

    const sessionId = `sched_${now.getTime()}_${Math.random().toString(36).substring(2, 7)}`;

    const session: SchedulingSession = {
      id: sessionId,
      candidateId: params.candidateId,
      candidateName: params.candidateName,
      candidateEmail: params.candidateEmail,
      interviewerId: params.interviewerId,
      interviewerName: params.interviewerName,
      sessionTokenHash: tokenHash,
      tokenExpiresAt,
      status: "invited",
      autoBookEnabled: params.autoBookEnabled ?? false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    const createdSession = await this.schedulingRepo.createSession(session);

    await this.schedulingRepo.logAudit({
      sessionId: createdSession.id,
      candidateId: createdSession.candidateId,
      interviewerId: createdSession.interviewerId,
      action: "slot_search",
      status: "success",
      details: {
        event: "candidate_invited",
        autoBookEnabled: createdSession.autoBookEnabled,
        tokenExpiresAt
      }
    });

    return { session: createdSession, token: rawToken };
  }

  async validateSessionToken(sessionId: string, tokenHeader: string): Promise<SchedulingSession | null> {
    if (!sessionId || !tokenHeader || typeof tokenHeader !== "string") {
      return null;
    }

    const session = await this.schedulingRepo.findSessionById(sessionId);
    if (!session) return null;

    // Check token expiration
    if (new Date() > new Date(session.tokenExpiresAt)) {
      return null;
    }

    // Timing-safe SHA-256 comparison
    const clientTokenHash = hashToken(tokenHeader);
    const storedHashBuf = crypto.createHash("sha256").update(session.sessionTokenHash).digest();
    const clientHashBuf = crypto.createHash("sha256").update(clientTokenHash).digest();

    if (!crypto.timingSafeEqual(storedHashBuf, clientHashBuf)) {
      return null;
    }

    return session;
  }

  async getAvailableSlots(sessionId: string, startDate?: string, endDate?: string): Promise<InterviewerSlot[]> {
    await this.schedulingRepo.sweepExpiredHolds();

    const session = await this.schedulingRepo.findSessionById(sessionId);
    if (!session) {
      throw new Error("Invalid scheduling session.");
    }

    const providerSlots = await this.calendarProvider.searchAvailability(session.interviewerId, startDate, endDate);
    const repoSlots = await this.schedulingRepo.listSlots(session.interviewerId);
    const repoSlotMap = new Map(repoSlots.map(s => [s.id, s]));

    const availableSlots: InterviewerSlot[] = [];
    for (const pSlot of providerSlots) {
      const rSlot = repoSlotMap.get(pSlot.id);
      const status = rSlot ? rSlot.status : pSlot.status;
      if (status === "available") {
        availableSlots.push({ ...pSlot, status: "available" });
      }
    }

    await this.schedulingRepo.logAudit({
      sessionId: session.id,
      candidateId: session.candidateId,
      interviewerId: session.interviewerId,
      action: "slot_search",
      status: "success",
      details: { availableCount: availableSlots.length }
    });

    return availableSlots;
  }

  async selectSlot(
    sessionId: string, 
    tokenHeader: string, 
    slotId: string
  ): Promise<{ success: boolean; session?: SchedulingSession; error?: string; statusCode?: number }> {
    const session = await this.validateSessionToken(sessionId, tokenHeader);
    if (!session) {
      return { success: false, error: "Unauthorized or expired session token.", statusCode: 401 };
    }

    await this.schedulingRepo.sweepExpiredHolds();

    if (session.status === "confirmed") {
      return { success: false, error: "Session is already confirmed.", statusCode: 400 };
    }

    const slot = await this.schedulingRepo.findSlotById(slotId);
    if (!slot) {
      return { success: false, error: "Slot not found.", statusCode: 404 };
    }

    // Determine 48h hold expiry if autoBookEnabled is false
    const holdExpiresAt = session.autoBookEnabled 
      ? undefined 
      : new Date(Date.now() + 48 * 3600 * 1000).toISOString();

    // Attempt atomic lock
    const lockResult = await this.schedulingRepo.atomicLockSlot(slotId, session.id, holdExpiresAt);
    if (!lockResult.success) {
      await this.schedulingRepo.logAudit({
        sessionId: session.id,
        candidateId: session.candidateId,
        interviewerId: session.interviewerId,
        action: "slot_locked",
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd,
        status: "failure",
        details: { reason: lockResult.reason }
      });
      return { success: false, error: lockResult.reason || "Slot lock failed due to concurrency conflict.", statusCode: 409 };
    }

    // Also lock on calendar provider
    await this.calendarProvider.lockSlot(slotId, session.id);

    if (session.autoBookEnabled) {
      // Auto-booking mode: Create event immediately
      try {
        const calEvent = await this.calendarProvider.createEvent({
          interviewerId: session.interviewerId,
          candidateId: session.candidateId,
          candidateName: session.candidateName,
          slotStart: slot.slotStart,
          slotEnd: slot.slotEnd
        });

        await this.schedulingRepo.atomicBookSlot(slotId, session.id, calEvent.calendarEventId);

        session.status = "confirmed";
        session.selectedSlotId = slotId;
        session.selectedSlotStart = slot.slotStart;
        session.selectedSlotEnd = slot.slotEnd;
        session.updatedAt = new Date().toISOString();
        const updatedSession = await this.schedulingRepo.updateSession(session);

        await this.schedulingRepo.logAudit({
          sessionId: session.id,
          candidateId: session.candidateId,
          interviewerId: session.interviewerId,
          action: "slot_booked",
          slotStart: slot.slotStart,
          slotEnd: slot.slotEnd,
          status: "success",
          details: { calendarEventId: calEvent.calendarEventId, autoBookEnabled: true }
        });

        return { success: true, session: updatedSession };
      } catch (err: any) {
        // Rollback / Compensation
        let compensationSuccess = false;
        try {
          await this.schedulingRepo.atomicReleaseSlot(slotId, session.id);
          await this.calendarProvider.releaseSlot(slotId, session.id);
          compensationSuccess = true;
        } catch (compErr: any) {
          compensationSuccess = false;
        }

        if (!compensationSuccess) {
          session.status = "needs_human_review";
          session.updatedAt = new Date().toISOString();
          const flaggedSession = await this.schedulingRepo.updateSession(session);

          await this.schedulingRepo.logAudit({
            sessionId: session.id,
            candidateId: session.candidateId,
            interviewerId: session.interviewerId,
            action: "compensation_failed",
            slotStart: slot.slotStart,
            slotEnd: slot.slotEnd,
            status: "needs_human_review",
            details: {
              error: err.message || "Calendar event creation failed",
              compensationError: "Failed to release DB or calendar lock during compensation rollback"
            }
          });

          return { 
            success: false, 
            session: flaggedSession, 
            error: "Scheduling state inconsistent; flagged for recruiter review.", 
            statusCode: 500 
          };
        } else {
          await this.schedulingRepo.logAudit({
            sessionId: session.id,
            candidateId: session.candidateId,
            interviewerId: session.interviewerId,
            action: "slot_released",
            slotStart: slot.slotStart,
            slotEnd: slot.slotEnd,
            status: "failure",
            details: { error: err.message, rolledBack: true }
          });

          return { success: false, error: `Calendar booking failed: ${err.message}`, statusCode: 500 };
        }
      }
    } else {
      // Manual confirmation mode: Hold for 48h
      session.status = "pending_confirmation";
      session.selectedSlotId = slotId;
      session.selectedSlotStart = slot.slotStart;
      session.selectedSlotEnd = slot.slotEnd;
      session.updatedAt = new Date().toISOString();
      const updatedSession = await this.schedulingRepo.updateSession(session);

      await this.schedulingRepo.logAudit({
        sessionId: session.id,
        candidateId: session.candidateId,
        interviewerId: session.interviewerId,
        action: "slot_locked",
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd,
        status: "success",
        details: { holdExpiresAt, autoBookEnabled: false }
      });

      return { success: true, session: updatedSession };
    }
  }

  async confirmBooking(sessionId: string): Promise<{ success: boolean; session?: SchedulingSession; error?: string; statusCode?: number }> {
    const session = await this.schedulingRepo.findSessionById(sessionId);
    if (!session) {
      return { success: false, error: "Session not found.", statusCode: 404 };
    }

    if (session.status !== "pending_confirmation" || !session.selectedSlotId) {
      return { success: false, error: "Session is not pending confirmation.", statusCode: 400 };
    }

    const slot = await this.schedulingRepo.findSlotById(session.selectedSlotId);
    if (!slot) {
      return { success: false, error: "Selected slot not found.", statusCode: 404 };
    }

    try {
      const calEvent = await this.calendarProvider.createEvent({
        interviewerId: session.interviewerId,
        candidateId: session.candidateId,
        candidateName: session.candidateName,
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd
      });

      await this.schedulingRepo.atomicBookSlot(slot.id, session.id, calEvent.calendarEventId);

      session.status = "confirmed";
      session.updatedAt = new Date().toISOString();
      const updatedSession = await this.schedulingRepo.updateSession(session);

      await this.schedulingRepo.logAudit({
        sessionId: session.id,
        candidateId: session.candidateId,
        interviewerId: session.interviewerId,
        action: "booking_confirmed",
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd,
        status: "success",
        details: { calendarEventId: calEvent.calendarEventId }
      });

      return { success: true, session: updatedSession };
    } catch (err: any) {
      let compensationSuccess = false;
      try {
        await this.schedulingRepo.atomicReleaseSlot(slot.id, session.id);
        await this.calendarProvider.releaseSlot(slot.id, session.id);
        compensationSuccess = true;
      } catch (compErr) {
        compensationSuccess = false;
      }

      if (!compensationSuccess) {
        session.status = "needs_human_review";
        session.updatedAt = new Date().toISOString();
        const flaggedSession = await this.schedulingRepo.updateSession(session);

        await this.schedulingRepo.logAudit({
          sessionId: session.id,
          candidateId: session.candidateId,
          interviewerId: session.interviewerId,
          action: "compensation_failed",
          slotStart: slot.slotStart,
          slotEnd: slot.slotEnd,
          status: "needs_human_review",
          details: { error: err.message, compensationError: "Failed during recruiter confirmation compensation" }
        });

        return { success: false, session: flaggedSession, error: "Confirmation failed; flagged for human review.", statusCode: 500 };
      } else {
        return { success: false, error: `Recruiter confirmation failed: ${err.message}`, statusCode: 500 };
      }
    }
  }

  async cancelBooking(
    sessionId: string, 
    reason?: string,
    tokenHeader?: string,
    isAdmin: boolean = false
  ): Promise<{ success: boolean; session?: SchedulingSession; error?: string; statusCode?: number }> {
    if (!isAdmin) {
      if (!tokenHeader || typeof tokenHeader !== "string") {
        return { success: false, error: "Missing session token. Provide X-Session-Token header.", statusCode: 401 };
      }
      const validSession = await this.validateSessionToken(sessionId, tokenHeader);
      if (!validSession) {
        return { success: false, error: "Unauthorized or expired session token.", statusCode: 401 };
      }
    }

    const session = await this.schedulingRepo.findSessionById(sessionId);
    if (!session) {
      return { success: false, error: "Session not found.", statusCode: 404 };
    }

    if (session.status === "cancelled") {
      return { success: false, error: "Booking is already cancelled.", statusCode: 400 };
    }

    if (session.selectedSlotId) {
      await this.schedulingRepo.atomicReleaseSlot(session.selectedSlotId, session.id);
      await this.calendarProvider.releaseSlot(session.selectedSlotId, session.id);
    }

    session.status = "cancelled";
    session.updatedAt = new Date().toISOString();
    const updatedSession = await this.schedulingRepo.updateSession(session);

    await this.schedulingRepo.logAudit({
      sessionId: session.id,
      candidateId: session.candidateId,
      interviewerId: session.interviewerId,
      action: "booking_cancelled",
      status: "success",
      details: { 
        reason: reason || (isAdmin ? "Admin cancelled booking" : "Candidate cancelled booking"),
        cancelledBy: isAdmin ? "admin" : "candidate"
      }
    });

    return { success: true, session: updatedSession, statusCode: 200 };
  }

  async listAuditLogs(sessionId?: string): Promise<SchedulingAuditLog[]> {
    return this.schedulingRepo.listAuditLogs(sessionId);
  }

  async listSessions(): Promise<SchedulingSession[]> {
    await this.schedulingRepo.sweepExpiredHolds();
    return this.schedulingRepo.listSessions();
  }
}
