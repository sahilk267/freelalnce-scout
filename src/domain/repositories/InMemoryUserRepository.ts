/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, UserInvite, normalizeEmail } from "../models/User";
import { 
  IUserRepository, 
  CreateUserData, 
  UpdateUserData, 
  CreateInviteData 
} from "./IUserRepository";

export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map(); // id -> User
  private invites: Map<string, UserInvite> = new Map(); // token -> UserInvite
  private denylist: Map<string, { expiresAt: number; userId?: string; revokedAt: string }> = new Map();

  async findByEmail(email: string): Promise<User | null> {
    const normalized = normalizeEmail(email);
    for (const user of this.users.values()) {
      if (normalizeEmail(user.email) === normalized) {
        return { ...user };
      }
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async createUser(data: CreateUserData): Promise<User> {
    const normalized = normalizeEmail(data.email);
    for (const user of this.users.values()) {
      if (normalizeEmail(user.email) === normalized) {
        throw new Error(`User with email "${normalized}" already exists.`);
      }
    }

    const id = data.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const newUser: User = {
      id,
      email: normalized,
      passwordHash: data.passwordHash,
      role: data.role,
      active: data.active !== undefined ? data.active : true,
      createdAt: new Date().toISOString()
    };

    this.users.set(id, newUser);
    return { ...newUser };
  }

  async updateUser(id: string, updates: UpdateUserData): Promise<User | null> {
    const existing = this.users.get(id);
    if (!existing) return null;

    const updated: User = {
      ...existing,
      ...updates
    };

    this.users.set(id, updated);
    return { ...updated };
  }

  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values()).map(u => ({ ...u }));
  }

  async countUsers(): Promise<number> {
    return this.users.size;
  }

  async createInvite(data: CreateInviteData): Promise<UserInvite> {
    const token = data.token || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const expiresAt = data.expiresAt || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const invite: UserInvite = {
      token,
      email: data.email ? normalizeEmail(data.email) : undefined,
      role: data.role,
      invitedBy: data.invitedBy,
      expiresAt,
      used: false,
      createdAt: new Date().toISOString()
    };

    this.invites.set(token, invite);
    return { ...invite };
  }

  async getInvite(token: string): Promise<UserInvite | null> {
    const invite = this.invites.get(token);
    return invite ? { ...invite } : null;
  }

  async consumeInvite(token: string, usedByUserId: string): Promise<UserInvite | null> {
    const invite = this.invites.get(token);
    if (!invite) return null;

    // Check if already used
    if (invite.used) return null;

    // Check if expired
    const now = new Date();
    if (new Date(invite.expiresAt) <= now) return null;

    const consumed: UserInvite = {
      ...invite,
      used: true,
      usedAt: now.toISOString(),
      usedBy: usedByUserId
    };

    this.invites.set(token, consumed);
    return { ...consumed };
  }

  async listPendingInvites(): Promise<UserInvite[]> {
    const now = new Date();
    const result: UserInvite[] = [];
    for (const invite of this.invites.values()) {
      if (!invite.used && new Date(invite.expiresAt) > now) {
        result.push({ ...invite });
      }
    }
    return result;
  }

  async isTokenDenylisted(tokenOrJti: string): Promise<boolean> {
    const entry = this.denylist.get(tokenOrJti);
    if (!entry) return false;

    // Check if entry expired
    const nowSec = Math.floor(Date.now() / 1000);
    if (entry.expiresAt && nowSec > entry.expiresAt) {
      this.denylist.delete(tokenOrJti);
      return false;
    }
    return true;
  }

  async denylistToken(tokenOrJti: string, expiresAt: number, userId?: string): Promise<void> {
    this.denylist.set(tokenOrJti, {
      expiresAt,
      userId,
      revokedAt: new Date().toISOString()
    });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const existing = this.users.get(userId);
    if (existing) {
      existing.sessionsRevokedAt = new Date().toISOString();
      this.users.set(userId, existing);
    }
  }

  clear(): void {
    this.users.clear();
    this.invites.clear();
    this.denylist.clear();
  }
}
