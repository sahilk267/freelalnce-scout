/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { google, calendar_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { ICalendarProvider, InterviewerSlot } from "../models/Scheduling";
import { IInterviewerCalendarRepository } from "../repositories/IInterviewerCalendarRepository";
import { decryptRefreshToken } from "../utils/calendarEncryption";
import { RetryService } from "../services/RetryService";
import { PersistenceConfigService } from "../services/PersistenceConfigService";

export function isGoogleTokenRevocationError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  const dataErr = (err.response?.data?.error || "").toLowerCase();
  const dataDesc = (err.response?.data?.error_description || "").toLowerCase();

  return (
    msg.includes("invalid_grant") ||
    msg.includes("token has been expired or revoked") ||
    msg.includes("token revoked") ||
    dataErr.includes("invalid_grant") ||
    dataDesc.includes("revoked") ||
    dataDesc.includes("expired") ||
    (err.code === 401 && (msg.includes("auth") || msg.includes("credential") || msg.includes("token")))
  );
}

export interface GoogleCalendarProviderOptions {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  authClientFactory?: (refreshToken: string) => any;
  calendarApiFactory?: (auth: any) => calendar_v3.Calendar;
}

export class GoogleCalendarProvider implements ICalendarProvider {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private authClientFactory?: (refreshToken: string) => any;
  private calendarApiFactory?: (auth: any) => calendar_v3.Calendar;

  constructor(
    private calendarRepo: IInterviewerCalendarRepository,
    private retryService: RetryService,
    private configService?: PersistenceConfigService,
    options?: GoogleCalendarProviderOptions
  ) {
    this.clientId = options?.clientId || process.env.GOOGLE_CLIENT_ID || "";
    this.clientSecret = options?.clientSecret || process.env.GOOGLE_CLIENT_SECRET || "";
    this.redirectUri = 
      options?.redirectUri || 
      process.env.GOOGLE_REDIRECT_URI || 
      `${process.env.APP_URL || "http://localhost:3000"}/api/calendar/oauth/callback`;

    this.authClientFactory = options?.authClientFactory;
    this.calendarApiFactory = options?.calendarApiFactory;
  }

  /**
   * Helper: instantiate an authorized OAuth2 client using the interviewer's decrypted refresh token
   */
  private async getAuthenticatedClient(interviewerId: string): Promise<{
    oauth2Client: OAuth2Client;
    calendar: calendar_v3.Calendar;
    interviewerName?: string;
  }> {
    const account = await this.calendarRepo.getAccount(interviewerId);
    if (!account) {
      throw new Error(`No calendar connection found for interviewer [${interviewerId}]. Please connect via OAuth.`);
    }

    if (account.status === "needs_reconnect") {
      throw new Error(`Interviewer [${interviewerId}] calendar authorization expired or revoked. Reconnect required.`);
    }

    let plainRefreshToken: string;
    try {
      plainRefreshToken = decryptRefreshToken(account.encryptedRefreshToken);
    } catch (decryptErr: any) {
      await this.calendarRepo.updateStatus(interviewerId, "needs_reconnect", `Decryption error: ${decryptErr.message}`);
      throw new Error(`Failed to decrypt calendar credentials for interviewer [${interviewerId}]: ${decryptErr.message}`);
    }

    let oauth2Client: any;
    if (this.authClientFactory) {
      oauth2Client = this.authClientFactory(plainRefreshToken);
    } else {
      oauth2Client = new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
      oauth2Client.setCredentials({ refresh_token: plainRefreshToken });
    }

    let calendar: calendar_v3.Calendar;
    if (this.calendarApiFactory) {
      calendar = this.calendarApiFactory(oauth2Client);
    } else {
      calendar = google.calendar({ version: "v3", auth: oauth2Client as any });
    }

    return { oauth2Client, calendar, interviewerName: account.interviewerName };
  }

  /**
   * Computes available slots against the interviewer's working hours (default 9am-6pm)
   * filtered by Google Calendar Freebusy query.
   * Internal slot timestamps are strictly formatted in ISO 8601 UTC.
   */
  async searchAvailability(
    interviewerId: string, 
    startDate?: string, 
    endDate?: string
  ): Promise<InterviewerSlot[]> {
    let authContext;
    try {
      authContext = await this.getAuthenticatedClient(interviewerId);
    } catch (error: any) {
      console.warn(`[GoogleCalendarProvider] Skipping slots for interviewer [${interviewerId}]: ${error.message}`);
      // Do not crash other interviewers; return empty available slots for this specific interviewer
      return [];
    }

    const { calendar, interviewerName } = authContext;
    const account = await this.calendarRepo.getAccount(interviewerId);

    // Working hours (defaults: 9:00 to 18:00 UTC)
    const workingHours = account?.workingHours || {
      startHour: 9,
      endHour: 18,
      timeZone: "UTC",
      daysOfWeek: [1, 2, 3, 4, 5] // Mon-Fri
    };

    // Determine query window in UTC
    const now = new Date();
    const queryStart = startDate ? new Date(startDate) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    const queryEnd = endDate ? new Date(endDate) : new Date(Date.UTC(queryStart.getUTCFullYear(), queryStart.getUTCMonth(), queryStart.getUTCDate() + 5, 23, 59, 59));

    // 1. Query Freebusy API with exponential backoff retry
    let busyPeriods: Array<{ start?: string | null; end?: string | null }> = [];
    try {
      const freebusyRes = await this.retryService.executeWithRetry(
        async () => {
          return await calendar.freebusy.query({
            requestBody: {
              timeMin: queryStart.toISOString(),
              timeMax: queryEnd.toISOString(),
              items: [{ id: "primary" }]
            }
          });
        },
        `Google Calendar Freebusy Query for [${interviewerId}]`,
        undefined,
        (err) => !isGoogleTokenRevocationError(err)
      );

      const calendars = freebusyRes.data?.calendars;
      if (calendars && calendars["primary"]?.busy) {
        busyPeriods = calendars["primary"].busy;
      }
    } catch (apiError: any) {
      if (isGoogleTokenRevocationError(apiError)) {
        console.error(`[GoogleCalendarProvider] Refresh token revoked for [${interviewerId}]. Marking needs_reconnect.`);
        await this.calendarRepo.updateStatus(interviewerId, "needs_reconnect", apiError.message);
      } else {
        console.error(`[GoogleCalendarProvider] Freebusy query failed for [${interviewerId}]:`, apiError.message);
      }
      return [];
    }

    // 2. Generate candidate slot intervals in UTC
    const availableSlots: InterviewerSlot[] = [];
    const currentDay = new Date(Date.UTC(queryStart.getUTCFullYear(), queryStart.getUTCMonth(), queryStart.getUTCDate()));
    const endDay = new Date(Date.UTC(queryEnd.getUTCFullYear(), queryEnd.getUTCMonth(), queryEnd.getUTCDate()));

    const activeDaysOfWeek = new Set(workingHours.daysOfWeek || [1, 2, 3, 4, 5]);

    while (currentDay <= endDay) {
      const dayOfWeek = currentDay.getUTCDay();
      if (activeDaysOfWeek.has(dayOfWeek)) {
        for (let hour = workingHours.startHour; hour < workingHours.endHour; hour++) {
          const slotStartTime = new Date(Date.UTC(
            currentDay.getUTCFullYear(),
            currentDay.getUTCMonth(),
            currentDay.getUTCDate(),
            hour,
            0,
            0
          ));
          const slotEndTime = new Date(Date.UTC(
            currentDay.getUTCFullYear(),
            currentDay.getUTCMonth(),
            currentDay.getUTCDate(),
            hour + 1,
            0,
            0
          ));

          // Only consider future slots
          if (slotStartTime.getTime() > now.getTime()) {
            const slotStartIso = slotStartTime.toISOString();
            const slotEndIso = slotEndTime.toISOString();

            // Check overlap with busy intervals
            const isBusy = busyPeriods.some((busy) => {
              if (!busy.start || !busy.end) return false;
              const bStart = new Date(busy.start).getTime();
              const bEnd = new Date(busy.end).getTime();
              return slotStartTime.getTime() < bEnd && slotEndTime.getTime() > bStart;
            });

            if (!isBusy) {
              const slotId = `slot_${interviewerId}_${slotStartTime.getTime()}`;
              availableSlots.push({
                id: slotId,
                interviewerId,
                interviewerName: interviewerName || "Interviewer",
                slotStart: slotStartIso,
                slotEnd: slotEndIso,
                status: "available"
              });
            }
          }
        }
      }
      // Advance 1 day in UTC
      currentDay.setUTCDate(currentDay.getUTCDate() + 1);
    }

    return availableSlots.sort((a, b) => a.slotStart.localeCompare(b.slotStart));
  }

  /**
   * Alias for searchAvailability matching prompt description
   */
  async getAvailableSlots(interviewerId: string, range?: { start?: string; end?: string } | string): Promise<InterviewerSlot[]> {
    if (typeof range === "string") {
      return this.searchAvailability(interviewerId, range);
    }
    return this.searchAvailability(interviewerId, range?.start, range?.end);
  }

  /**
   * Google Calendar has no concept of temporary slot locks.
   * Lock logic is atomic in the database repository.
   */
  async lockSlot(slotId: string, sessionId: string): Promise<boolean> {
    return true;
  }

  /**
   * Slot release is handled in DB repository.
   */
  async releaseSlot(slotId: string, sessionId: string): Promise<boolean> {
    return true;
  }

  /**
   * Creates a real Google Calendar event with the candidate as an attendee.
   * Sends Google Calendar invite emails automatically (sendUpdates: 'all').
   * If creation fails, throws error to trigger compensation-rollback in SchedulingServiceAgent.
   */
  async createEvent(params: {
    interviewerId: string;
    candidateId: string;
    candidateName: string;
    candidateEmail?: string;
    slotStart: string;
    slotEnd: string;
    summary?: string;
    description?: string;
  }): Promise<{ calendarEventId: string; eventId?: string; meetUrl?: string }> {
    let authContext;
    try {
      authContext = await this.getAuthenticatedClient(params.interviewerId);
    } catch (authErr: any) {
      throw new Error(`Google Calendar booking authorization failed: ${authErr.message}`);
    }

    const { calendar } = authContext;

    try {
      const result = await this.retryService.executeWithRetry(
        async () => {
          return await calendar.events.insert({
            calendarId: "primary",
            sendUpdates: "all", // Automatically sends Google Calendar email invitations
            conferenceDataVersion: 1,
            requestBody: {
              summary: params.summary || `Technical Interview: ${params.candidateName}`,
              description: params.description || `Aziz OS Technical Interview with ${params.candidateName} (Candidate ID: ${params.candidateId}). Scheduled via Aziz OS Autonomous Scheduling Agent.`,
              start: {
                dateTime: params.slotStart
              },
              end: {
                dateTime: params.slotEnd
              },
              conferenceData: {
                createRequest: {
                  requestId: `meet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  conferenceSolutionKey: { type: "hangoutsMeet" }
                }
              },
              attendees: params.candidateEmail ? [
                { email: params.candidateEmail, displayName: params.candidateName }
              ] : []
            }
          });
        },
        `Google Calendar Create Event for [${params.candidateName}]`,
        undefined,
        (err) => !isGoogleTokenRevocationError(err)
      );

      const eventId = result.data.id;
      if (!eventId) {
        throw new Error("Google Calendar API returned empty event ID.");
      }

      return { 
        calendarEventId: eventId,
        eventId,
        meetUrl: result.data.hangoutLink || result.data.conferenceData?.entryPoints?.[0]?.uri
      };
    } catch (error: any) {
      if (isGoogleTokenRevocationError(error)) {
        await this.calendarRepo.updateStatus(params.interviewerId, "needs_reconnect", error.message);
      }
      // Must throw so SchedulingServiceAgent triggers atomic compensation rollback
      throw error;
    }
  }

  /**
   * Alias for createEvent matching prompt description
   */
  async bookSlot(params: {
    interviewerId: string;
    candidateId: string;
    candidateName: string;
    candidateEmail?: string;
    slotStart: string;
    slotEnd: string;
  }): Promise<{ calendarEventId: string }> {
    return this.createEvent(params);
  }

  /**
   * Deletes/cancels the corresponding Calendar event in Google Calendar.
   */
  async cancelEvent(eventId: string, interviewerId?: string): Promise<boolean> {
    if (!eventId) return true;

    // If interviewerId is not provided, try to search connected accounts
    let targetInterviewerId = interviewerId;
    if (!targetInterviewerId) {
      const accounts = await this.calendarRepo.listAccounts();
      const connected = accounts.find((a) => a.status === "connected");
      targetInterviewerId = connected?.interviewerId;
    }

    if (!targetInterviewerId) {
      console.warn("[GoogleCalendarProvider] Cannot cancel Google Calendar event without interviewer account context.");
      return true;
    }

    try {
      const { calendar } = await this.getAuthenticatedClient(targetInterviewerId);

      await this.retryService.executeWithRetry(
        async () => {
          try {
            await calendar.events.delete({
              calendarId: "primary",
              eventId,
              sendUpdates: "all" // Notifies attendees of cancellation
            });
          } catch (delErr: any) {
            // If already deleted or not found (404/410), treat as successfully cancelled
            if (delErr.code === 404 || delErr.code === 410 || delErr.status === 404) {
              return;
            }
            throw delErr;
          }
        },
        `Google Calendar Cancel Event [${eventId}]`
      );

      return true;
    } catch (err: any) {
      if (isGoogleTokenRevocationError(err)) {
        await this.calendarRepo.updateStatus(targetInterviewerId, "needs_reconnect", err.message);
      }
      console.warn(`[GoogleCalendarProvider] Failed to cancel event [${eventId}]:`, err.message);
      return false;
    }
  }

  /**
   * Alias for cancelEvent matching prompt description
   */
  async cancelBooking(eventId: string, interviewerId?: string): Promise<boolean> {
    return this.cancelEvent(eventId, interviewerId);
  }
}
