/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InterviewerSlot, SchedulingAuditLog, SchedulingSession } from "../models/Scheduling";

export interface ISchedulingRepository {
  createSession(session: SchedulingSession): Promise<SchedulingSession>;
  findSessionById(id: string): Promise<SchedulingSession | null>;
  updateSession(session: SchedulingSession): Promise<SchedulingSession>;
  listSessions(): Promise<SchedulingSession[]>;

  createSlot(slot: InterviewerSlot): Promise<InterviewerSlot>;
  saveSlot(slot: InterviewerSlot): Promise<InterviewerSlot>;
  findSlotById(slotId: string): Promise<InterviewerSlot | null>;
  listSlots(interviewerId?: string): Promise<InterviewerSlot[]>;

  atomicLockSlot(
    slotId: string, 
    sessionId: string, 
    holdExpiresAt?: string
  ): Promise<{ success: boolean; reason?: string }>;

  atomicBookSlot(
    slotId: string, 
    sessionId: string, 
    calendarEventId: string
  ): Promise<boolean>;

  atomicReleaseSlot(
    slotId: string, 
    sessionId: string
  ): Promise<boolean>;

  logAudit(entry: Omit<SchedulingAuditLog, "id" | "timestamp">): Promise<SchedulingAuditLog>;
  listAuditLogs(sessionId?: string): Promise<SchedulingAuditLog[]>;

  sweepExpiredHolds(): Promise<{ expiredCount: number; expiredSessionIds: string[] }>;
}
