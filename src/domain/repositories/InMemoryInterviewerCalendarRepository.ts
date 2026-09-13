/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  CalendarConnectionStatus, 
  InterviewerCalendarAccount, 
  WorkingHoursConfig 
} from "../models/InterviewerCalendarAccount";
import { IInterviewerCalendarRepository } from "./IInterviewerCalendarRepository";

export class InMemoryInterviewerCalendarRepository implements IInterviewerCalendarRepository {
  private accounts: Map<string, InterviewerCalendarAccount> = new Map();

  async saveAccount(account: InterviewerCalendarAccount): Promise<void> {
    this.accounts.set(account.interviewerId, { ...account });
  }

  async getAccount(interviewerId: string): Promise<InterviewerCalendarAccount | null> {
    const acc = this.accounts.get(interviewerId);
    return acc ? { ...acc } : null;
  }

  async listAccounts(): Promise<InterviewerCalendarAccount[]> {
    return Array.from(this.accounts.values()).map((acc) => ({ ...acc }));
  }

  async updateStatus(interviewerId: string, status: CalendarConnectionStatus, error?: string): Promise<void> {
    const acc = this.accounts.get(interviewerId);
    if (acc) {
      acc.status = status;
      acc.lastError = error;
      acc.lastSyncAt = new Date().toISOString();
      this.accounts.set(interviewerId, acc);
    }
  }

  async updateWorkingHours(interviewerId: string, config: WorkingHoursConfig): Promise<void> {
    const acc = this.accounts.get(interviewerId);
    if (acc) {
      acc.workingHours = { ...config };
      acc.lastSyncAt = new Date().toISOString();
      this.accounts.set(interviewerId, acc);
    }
  }

  async deleteAccount(interviewerId: string): Promise<void> {
    this.accounts.delete(interviewerId);
  }

  // Test helper
  clear(): void {
    this.accounts.clear();
  }
}
