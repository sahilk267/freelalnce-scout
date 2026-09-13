/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CalendarConnectionStatus = "connected" | "needs_reconnect" | "disconnected";

export interface WorkingHoursConfig {
  startHour: number; // e.g. 9 (9:00 AM)
  endHour: number;   // e.g. 18 (6:00 PM)
  timeZone: string;  // e.g. "UTC"
  daysOfWeek?: number[]; // e.g. [1, 2, 3, 4, 5] (Monday-Friday)
}

export interface InterviewerCalendarAccount {
  interviewerId: string;
  interviewerName?: string;
  interviewerEmail?: string;
  encryptedRefreshToken: string;
  scope: string;
  connectedAt: string; // ISO 8601 UTC
  status: CalendarConnectionStatus;
  lastSyncAt?: string; // ISO 8601 UTC
  lastError?: string;
  workingHours?: WorkingHoursConfig;
}
