/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, UserInvite, UserRole } from "../models/User";

export interface CreateUserData {
  id?: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active?: boolean;
}

export interface UpdateUserData {
  role?: UserRole;
  active?: boolean;
  passwordHash?: string;
  lastLoginAt?: string;
  sessionsRevokedAt?: string;
}

export interface CreateInviteData {
  token?: string;
  email?: string;
  role: UserRole;
  invitedBy: string;
  expiresAt?: string;
}

export interface IUserRepository {
  /**
   * Find a user by their normalized lowercase email.
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Find a user by their unique primary key ID.
   */
  findById(id: string): Promise<User | null>;

  /**
   * Create a new user record.
   */
  createUser(data: CreateUserData): Promise<User>;

  /**
   * Update fields on an existing user.
   */
  updateUser(id: string, updates: UpdateUserData): Promise<User | null>;

  /**
   * Retrieve all registered users.
   */
  listUsers(): Promise<User[]>;

  /**
   * Return the total count of existing users.
   */
  countUsers(): Promise<number>;

  /**
   * Issue a new single-use invite token.
   */
  createInvite(data: CreateInviteData): Promise<UserInvite>;

  /**
   * Retrieve invite token metadata.
   */
  getInvite(token: string): Promise<UserInvite | null>;

  /**
   * Atomically mark an invite token as consumed.
   * Returns the consumed invite if valid, not expired, and not previously used; otherwise null.
   */
  consumeInvite(token: string, usedByUserId: string): Promise<UserInvite | null>;

  /**
   * List all active (unused, unexpired) invites.
   */
  listPendingInvites(): Promise<UserInvite[]>;

  /**
   * Check if a token string or JTI is recorded in the denylist.
   */
  isTokenDenylisted(tokenOrJti: string): Promise<boolean>;

  /**
   * Add a token string or JTI to the immediate revocation denylist.
   */
  denylistToken(tokenOrJti: string, expiresAt: number, userId?: string): Promise<void>;

  /**
   * Revoke all active sessions for a user by timestamp.
   */
  revokeAllUserSessions(userId: string): Promise<void>;

  /**
   * Optional cleanup/close handle.
   */
  close?(): void;
}
