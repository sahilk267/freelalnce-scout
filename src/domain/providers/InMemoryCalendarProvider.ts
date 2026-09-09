/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ICalendarProvider, InterviewerSlot } from "../models/Scheduling";

export class InMemoryCalendarProvider implements ICalendarProvider {
  private slots: Map<string, InterviewerSlot> = new Map();
  private events: Map<string, { id: string; interviewerId: string; candidateId: string; slotStart: string; slotEnd: string }> = new Map();

  constructor(initialSlots: InterviewerSlot[] = []) {
    if (initialSlots.length > 0) {
      for (const slot of initialSlots) {
        this.slots.set(slot.id, { ...slot });
      }
    } else {
      // Seed default slots for default interviewers
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

  async searchAvailability(interviewerId: string, startDate?: string, endDate?: string): Promise<InterviewerSlot[]> {
    const results: InterviewerSlot[] = [];
    const startIso = startDate ? new Date(startDate).toISOString() : null;
    const endIso = endDate ? new Date(endDate).toISOString() : null;

    for (const slot of this.slots.values()) {
      if (interviewerId && slot.interviewerId !== interviewerId) continue;
      if (startIso && slot.slotStart < startIso) continue;
      if (endIso && slot.slotEnd > endIso) continue;

      results.push({ ...slot });
    }

    return results.sort((a, b) => a.slotStart.localeCompare(b.slotStart));
  }

  async lockSlot(slotId: string, sessionId: string): Promise<boolean> {
    const slot = this.slots.get(slotId);
    if (!slot) return false;
    if (slot.status !== "available" && slot.lockedBySessionId !== sessionId) {
      return false;
    }

    slot.status = "locked";
    slot.lockedBySessionId = sessionId;
    slot.lockedAt = new Date().toISOString();
    return true;
  }

  async releaseSlot(slotId: string, sessionId: string): Promise<boolean> {
    const slot = this.slots.get(slotId);
    if (!slot) return false;
    if (slot.lockedBySessionId === sessionId || slot.status === "locked" || slot.status === "pending_confirmation") {
      slot.status = "available";
      delete slot.lockedBySessionId;
      delete slot.lockedAt;
      delete slot.holdExpiresAt;
      return true;
    }
    return false;
  }

  async createEvent(params: {
    interviewerId: string;
    candidateId: string;
    candidateName: string;
    slotStart: string;
    slotEnd: string;
  }): Promise<{ calendarEventId: string }> {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.events.set(eventId, {
      id: eventId,
      ...params
    });
    return { calendarEventId: eventId };
  }

  async cancelEvent(eventId: string): Promise<boolean> {
    return this.events.delete(eventId);
  }

  // Helper method for tests to simulate failure
  public addSlot(slot: InterviewerSlot) {
    this.slots.set(slot.id, slot);
  }
}
