/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InterviewerSlot, SchedulingAuditLog, SchedulingSession } from "../models/Scheduling";
import { ISchedulingRepository } from "./ISchedulingRepository";

export class InMemorySchedulingRepository implements ISchedulingRepository {
  private sessions: Map<string, SchedulingSession> = new Map();
  private slots: Map<string, InterviewerSlot> = new Map();
  private auditLogs: SchedulingAuditLog[] = [];

  // Seed default slots on init
  constructor(initialSlots: InterviewerSlot[] = []) {
    if (initialSlots.length > 0) {
      for (const slot of initialSlots) {
        this.slots.set(slot.id, { ...slot });
      }
    } else {
      this.seedDefaultSlots();
    }
  }

  private seedDefaultSlots() {
    const today = new Date();
    const interviewers = [
      { id: "int_01", name: "Sarah Connor (Eng Lead)" },
      { id: "int_02", name: "Alex Rivera (Engineering Director)" }
    ];

    for (let dayOffset = 1; dayOffset <= 5; dayOffset++) {
      for (const intv of interviewers) {
        for (const hour of [9, 11, 14, 16]) {
          const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, hour, 0, 0);
          const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, hour + 1, 0, 0);
          const slotId = `slot_${intv.id}_${start.getTime()}`;

          this.slots.set(slotId, {
            id: slotId,
            interviewerId: intv.id,
            interviewerName: intv.name,
            slotStart: start.toISOString(),
            slotEnd: end.toISOString(),
            status: "available"
          });
        }
      }
    }
  }

  async createSession(session: SchedulingSession): Promise<SchedulingSession> {
    this.sessions.set(session.id, { ...session });
    return { ...session };
  }

  async findSessionById(id: string): Promise<SchedulingSession | null> {
    const session = this.sessions.get(id);
    return session ? { ...session } : null;
  }

  async updateSession(session: SchedulingSession): Promise<SchedulingSession> {
    this.sessions.set(session.id, { ...session, updatedAt: new Date().toISOString() });
    return { ...this.sessions.get(session.id)! };
  }

  async listSessions(): Promise<SchedulingSession[]> {
    return Array.from(this.sessions.values()).map(s => ({ ...s }));
  }

  async createSlot(slot: InterviewerSlot): Promise<InterviewerSlot> {
    this.slots.set(slot.id, { ...slot });
    return { ...slot };
  }

  async saveSlot(slot: InterviewerSlot): Promise<InterviewerSlot> {
    this.slots.set(slot.id, { ...slot });
    return { ...slot };
  }

  async findSlotById(slotId: string): Promise<InterviewerSlot | null> {
    const slot = this.slots.get(slotId);
    return slot ? { ...slot } : null;
  }

  async listSlots(interviewerId?: string): Promise<InterviewerSlot[]> {
    const all = Array.from(this.slots.values());
    if (!interviewerId) return all.map(s => ({ ...s }));
    return all.filter(s => s.interviewerId === interviewerId).map(s => ({ ...s }));
  }

  async atomicLockSlot(
    slotId: string, 
    sessionId: string, 
    holdExpiresAt?: string
  ): Promise<{ success: boolean; reason?: string }> {
    const targetSlot = this.slots.get(slotId);
    if (!targetSlot) {
      return { success: false, reason: "Slot not found" };
    }

    // Check unique constraint on (interviewerId, slotStart) across locked/booked slots
    for (const slot of this.slots.values()) {
      if (
        slot.interviewerId === targetSlot.interviewerId &&
        slot.slotStart === targetSlot.slotStart &&
        slot.status !== "available" &&
        slot.lockedBySessionId !== sessionId
      ) {
        return { 
          success: false, 
          reason: `Concurrency conflict: Slot at ${slot.slotStart} for interviewer ${slot.interviewerId} is already locked/booked by another session.` 
        };
      }
    }

    if (targetSlot.status !== "available" && targetSlot.lockedBySessionId !== sessionId) {
      return { success: false, reason: "Slot is already occupied by another session." };
    }

    targetSlot.status = holdExpiresAt ? "pending_confirmation" : "locked";
    targetSlot.lockedBySessionId = sessionId;
    targetSlot.lockedAt = new Date().toISOString();
    targetSlot.holdExpiresAt = holdExpiresAt;

    return { success: true };
  }

  async atomicBookSlot(slotId: string, sessionId: string, calendarEventId: string): Promise<boolean> {
    const slot = this.slots.get(slotId);
    if (!slot) return false;
    
    slot.status = "booked";
    slot.lockedBySessionId = sessionId;
    slot.calendarEventId = calendarEventId;
    delete slot.holdExpiresAt;
    return true;
  }

  async atomicReleaseSlot(slotId: string, sessionId: string): Promise<boolean> {
    const slot = this.slots.get(slotId);
    if (!slot) return false;

    if (slot.lockedBySessionId === sessionId || slot.status === "locked" || slot.status === "pending_confirmation") {
      slot.status = "available";
      delete slot.lockedBySessionId;
      delete slot.lockedAt;
      delete slot.holdExpiresAt;
      delete slot.calendarEventId;
      return true;
    }

    return false;
  }

  async logAudit(entry: Omit<SchedulingAuditLog, "id" | "timestamp">): Promise<SchedulingAuditLog> {
    const fullLog: SchedulingAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.auditLogs.push(fullLog);
    return fullLog;
  }

  async listAuditLogs(sessionId?: string): Promise<SchedulingAuditLog[]> {
    if (!sessionId) return [...this.auditLogs];
    return this.auditLogs.filter(log => log.sessionId === sessionId);
  }

  async sweepExpiredHolds(): Promise<{ expiredCount: number; expiredSessionIds: string[] }> {
    const now = new Date();
    const expiredSessionIds: string[] = [];
    let expiredCount = 0;

    for (const slot of this.slots.values()) {
      if (slot.status === "pending_confirmation" && slot.holdExpiresAt) {
        if (new Date(slot.holdExpiresAt) < now) {
          const sessionId = slot.lockedBySessionId;
          slot.status = "available";
          delete slot.lockedBySessionId;
          delete slot.lockedAt;
          delete slot.holdExpiresAt;
          delete slot.calendarEventId;
          expiredCount++;

          if (sessionId) {
            expiredSessionIds.push(sessionId);
            const session = this.sessions.get(sessionId);
            if (session && session.status === "pending_confirmation") {
              session.status = "hold_expired";
              session.updatedAt = now.toISOString();

              this.auditLogs.push({
                id: `audit_exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                timestamp: now.toISOString(),
                sessionId: session.id,
                candidateId: session.candidateId,
                interviewerId: session.interviewerId,
                action: "hold_expired",
                slotStart: slot.slotStart,
                slotEnd: slot.slotEnd,
                status: "success",
                details: {
                  reason: "Recruiter confirmation hold timeout expired (48h)",
                  triggerOrigin: "system_timeout"
                }
              });
            }
          }
        }
      }
    }

    return { expiredCount, expiredSessionIds };
  }
}
