/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IScreeningRepository } from "./IScreeningRepository";
import { ScreeningSession } from "../models/ScreeningSession";

export class InMemoryScreeningRepository implements IScreeningRepository {
  private sessions: Map<string, ScreeningSession> = new Map();

  async save(session: ScreeningSession): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async findById(id: string): Promise<ScreeningSession | null> {
    const session = this.sessions.get(id);
    return session ? { ...session } : null;
  }

  async findByCandidateId(candidateId: string): Promise<ScreeningSession[]> {
    return Array.from(this.sessions.values())
      .filter((s) => s.candidateId === candidateId)
      .map((s) => ({ ...s }));
  }

  async findByJobId(jobId: string): Promise<ScreeningSession[]> {
    return Array.from(this.sessions.values())
      .filter((s) => s.jobId === jobId)
      .map((s) => ({ ...s }));
  }

  async findByToken(token: string): Promise<ScreeningSession | null> {
    const found = Array.from(this.sessions.values()).find((s) => s.sessionToken === token);
    return found ? { ...found } : null;
  }
}
