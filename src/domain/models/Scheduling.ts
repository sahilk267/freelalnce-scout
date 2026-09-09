/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from "crypto";

export type SlotStatus = "available" | "locked" | "booked" | "pending_confirmation";

export type SchedulingSessionStatus = 
  | "invited" 
  | "slot_selected" 
  | "pending_confirmation" 
  | "confirmed" 
  | "cancelled" 
  | "needs_human_review" 
  | "hold_expired";

export interface InterviewerSlot {
  id: string;
  interviewerId: string;
  interviewerName: string;
  slotStart: string; // ISO 8601
  slotEnd: string;   // ISO 8601
  status: SlotStatus;
  lockedBySessionId?: string;
  lockedAt?: string;
  holdExpiresAt?: string;
  calendarEventId?: string;
}

export interface SchedulingSession {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  interviewerId: string;
  interviewerName: string;
  sessionTokenHash: string;
  tokenExpiresAt: string;
  status: SchedulingSessionStatus;
  selectedSlotId?: string;
  selectedSlotStart?: string;
  selectedSlotEnd?: string;
  autoBookEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SchedulingAuditAction = 
  | "slot_search" 
  | "slot_locked" 
  | "slot_booked" 
  | "slot_released" 
  | "booking_confirmed" 
  | "booking_cancelled" 
  | "compensation_failed" 
  | "hold_expired";

export interface SchedulingAuditLog {
  id: string;
  timestamp: string; // ISO 8601
  sessionId: string;
  candidateId: string;
  interviewerId: string;
  action: SchedulingAuditAction;
  slotStart?: string;
  slotEnd?: string;
  status: "success" | "failure" | "needs_human_review";
  details?: Record<string, any>;
}

export interface ICalendarProvider {
  searchAvailability(interviewerId: string, startDate?: string, endDate?: string): Promise<InterviewerSlot[]>;
  lockSlot(slotId: string, sessionId: string): Promise<boolean>;
  releaseSlot(slotId: string, sessionId: string): Promise<boolean>;
  createEvent(params: {
    interviewerId: string;
    candidateId: string;
    candidateName: string;
    slotStart: string;
    slotEnd: string;
  }): Promise<{ calendarEventId: string }>;
  cancelEvent(eventId: string): Promise<boolean>;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateSchedulingToken(): string {
  return crypto.randomBytes(24).toString("hex");
}
