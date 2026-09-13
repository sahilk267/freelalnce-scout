/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = "admin" | "recruiter";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean; // default true; if false, soft-deleted / deactivated
  createdAt: string; // ISO 8601 string
  lastLoginAt?: string; // ISO 8601 string
  sessionsRevokedAt?: string; // ISO 8601 string; tokens issued prior to this timestamp are rejected
}

export interface UserPublicProfile {
  id: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface UserInvite {
  token: string;
  email?: string; // optional pre-assigned target email
  role: UserRole;
  invitedBy: string; // userId of admin who created invite
  expiresAt: string; // ISO 8601 string
  used: boolean;
  createdAt: string;
  usedAt?: string;
  usedBy?: string;
}

export interface TokenDenylistEntry {
  tokenOrJti: string;
  userId?: string;
  expiresAt: number; // Unix timestamp in seconds
  revokedAt: string;
}

export interface AuthTokenPayload {
  sub: string; // User ID
  email: string;
  role: UserRole;
  jti: string; // Unique JWT identifier for individual revocation
  iat?: number;
  exp?: number;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function toPublicProfile(user: User): UserPublicProfile {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
  };
}
