/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalendarConnectionStatus, InterviewerCalendarAccount, WorkingHoursConfig } from "../models/InterviewerCalendarAccount";

export interface IInterviewerCalendarRepository {
  saveAccount(account: InterviewerCalendarAccount): Promise<void>;
  getAccount(interviewerId: string): Promise<InterviewerCalendarAccount | null>;
  listAccounts(): Promise<InterviewerCalendarAccount[]>;
  updateStatus(interviewerId: string, status: CalendarConnectionStatus, error?: string): Promise<void>;
  updateWorkingHours(interviewerId: string, config: WorkingHoursConfig): Promise<void>;
  deleteAccount(interviewerId: string): Promise<void>;
}
