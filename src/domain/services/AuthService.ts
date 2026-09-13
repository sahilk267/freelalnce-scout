/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { 
  User, 
  UserRole, 
  UserInvite, 
  AuthTokenPayload, 
  UserPublicProfile, 
  toPublicProfile, 
  normalizeEmail, 
  isValidEmail 
} from "../models/User";
import { IUserRepository } from "../repositories/IUserRepository";

export interface RegisterParams {
  email: string;
  password: string;
  inviteToken?: string;
}

export interface LoginParams {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: UserPublicProfile;
  expiresIn: string;
}

export class AuthService {
  private userRepo: IUserRepository;
  private jwtSecret: string;
  private tokenExpiry = "12h";
  private tokenExpirySeconds = 12 * 60 * 60; // 12 hours in seconds

  constructor(userRepo: IUserRepository, jwtSecret: string) {
    if (!jwtSecret || jwtSecret.trim().length === 0) {
      throw new Error("[AuthService] Fail-Closed Security: A valid, non-empty JWT_SECRET is mandatory for boot.");
    }
    this.userRepo = userRepo;
    this.jwtSecret = jwtSecret;
  }

  /**
   * Generates a signed JWT with 12h expiry and unique JTI.
   */
  generateToken(user: User): string {
    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: crypto.randomUUID()
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: "12h"
    });
  }

  /**
   * Registers a new user account.
   * - If no users exist, the first user is bootstrapped automatically as "admin".
   * - If users already exist, a valid single-use inviteToken is strictly required.
   */
  async register(params: RegisterParams): Promise<AuthResult> {
    const email = normalizeEmail(params.email || "");
    const password = params.password || "";

    if (!isValidEmail(email)) {
      throw new Error("Invalid email format provided.");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters in length.");
    }

    const existingUser = await this.userRepo.findByEmail(email);
    if (existingUser) {
      throw new Error("An account with this email address already exists.");
    }

    const totalUsers = await this.userRepo.countUsers();
    let assignedRole: UserRole = "recruiter";
    let consumedInvite: UserInvite | null = null;

    if (totalUsers === 0) {
      // First-user bootstrap: Automatically elevate to admin
      assignedRole = "admin";
    } else {
      // System already has users: Require valid single-use invite
      if (!params.inviteToken || !params.inviteToken.trim()) {
        throw new Error("Registration is invite-only. A valid invite token is required.");
      }

      const inviteToken = params.inviteToken.trim();
      const invite = await this.userRepo.getInvite(inviteToken);
      if (!invite) {
        throw new Error("Invalid or unknown invite token.");
      }

      if (invite.used) {
        throw new Error("This invite token has already been redeemed.");
      }

      if (new Date(invite.expiresAt) <= new Date()) {
        throw new Error("This invite token has expired.");
      }

      if (invite.email && normalizeEmail(invite.email) !== email) {
        throw new Error(`This invite is restricted to email: ${invite.email}`);
      }

      assignedRole = invite.role;

      // Temporary ID for consumption tracking
      const prospectiveUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      consumedInvite = await this.userRepo.consumeInvite(inviteToken, prospectiveUserId);
      if (!consumedInvite) {
        throw new Error("Invite token could not be redeemed. It may have just been used or expired.");
      }
    }

    // Salt and hash password (bcrypt with 10 rounds)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await this.userRepo.createUser({
      id: consumedInvite?.usedBy,
      email,
      passwordHash,
      role: assignedRole,
      active: true
    });

    const token = this.generateToken(user);

    return {
      token,
      user: toPublicProfile(user),
      expiresIn: this.tokenExpiry
    };
  }

  /**
   * Authenticates user with email and password.
   */
  async login(params: LoginParams): Promise<AuthResult> {
    const email = normalizeEmail(params.email || "");
    const password = params.password || "";

    if (!email || !password) {
      throw new Error("Email and password are required.");
    }

    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new Error("Invalid email or password.");
    }

    if (!user.active) {
      throw new Error("Account has been deactivated. Please contact an administrator.");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new Error("Invalid email or password.");
    }

    // Update lastLoginAt
    const nowIso = new Date().toISOString();
    await this.userRepo.updateUser(user.id, { lastLoginAt: nowIso });
    user.lastLoginAt = nowIso;

    const token = this.generateToken(user);

    return {
      token,
      user: toPublicProfile(user),
      expiresIn: this.tokenExpiry
    };
  }

  /**
   * Logs out a session by denylisting the JWT and JTI.
   */
  async logout(token: string): Promise<void> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as AuthTokenPayload;
      const exp = decoded.exp || Math.floor(Date.now() / 1000) + this.tokenExpirySeconds;

      if (decoded.jti) {
        await this.userRepo.denylistToken(decoded.jti, exp, decoded.sub);
      }
      await this.userRepo.denylistToken(token, exp, decoded.sub);
    } catch {
      // If token is malformed/expired, denylist raw token string for remainder of default window
      const exp = Math.floor(Date.now() / 1000) + this.tokenExpirySeconds;
      await this.userRepo.denylistToken(token, exp);
    }
  }

  /**
   * Verifies a JWT token:
   * - checks signature & expiry
   * - checks denylist
   * - checks active user state in DB
   * - checks session revocation timestamp
   */
  async verifyToken(token: string): Promise<User> {
    let decoded: AuthTokenPayload;
    try {
      decoded = jwt.verify(token, this.jwtSecret) as AuthTokenPayload;
    } catch (err: any) {
      throw new Error(`Invalid or expired token: ${err.message}`);
    }

    // Check denylist for token string or JTI
    if (await this.userRepo.isTokenDenylisted(token)) {
      throw new Error("Token has been revoked.");
    }
    if (decoded.jti && await this.userRepo.isTokenDenylisted(decoded.jti)) {
      throw new Error("Token session has been revoked.");
    }

    // Fetch current user record to verify account is still active
    const user = await this.userRepo.findById(decoded.sub);
    if (!user) {
      throw new Error("Authenticated user no longer exists.");
    }

    if (!user.active) {
      throw new Error("User account has been deactivated.");
    }

    // Check if user sessions were revoked after this token was issued
    if (user.sessionsRevokedAt && decoded.iat) {
      const revokedTime = new Date(user.sessionsRevokedAt).getTime();
      const tokenIssuedTime = decoded.iat * 1000;
      if (tokenIssuedTime < revokedTime) {
        throw new Error("User session has been revoked by an administrator.");
      }
    }

    return user;
  }

  /**
   * Admin-only: Issues a single-use invite token.
   */
  async createInvite(params: {
    adminUserId: string;
    email?: string;
    role?: UserRole;
    expiresInHours?: number;
  }): Promise<UserInvite> {
    const admin = await this.userRepo.findById(params.adminUserId);
    if (!admin || admin.role !== "admin" || !admin.active) {
      throw new Error("Unauthorized: Only active administrators can issue invites.");
    }

    const hours = params.expiresInHours || 48;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const role = params.role || "recruiter";

    return this.userRepo.createInvite({
      email: params.email ? normalizeEmail(params.email) : undefined,
      role,
      invitedBy: admin.id,
      expiresAt
    });
  }

  /**
   * Admin-only: List all users.
   */
  async listUsers(adminUserId: string): Promise<UserPublicProfile[]> {
    const admin = await this.userRepo.findById(adminUserId);
    if (!admin || admin.role !== "admin" || !admin.active) {
      throw new Error("Unauthorized: Only administrators can view the user directory.");
    }

    const users = await this.userRepo.listUsers();
    return users.map(toPublicProfile);
  }

  /**
   * Admin-only: List pending invites.
   */
  async listPendingInvites(adminUserId: string): Promise<UserInvite[]> {
    const admin = await this.userRepo.findById(adminUserId);
    if (!admin || admin.role !== "admin" || !admin.active) {
      throw new Error("Unauthorized: Only administrators can view pending invites.");
    }

    return this.userRepo.listPendingInvites();
  }

  /**
   * Admin-only: Update user role.
   */
  async updateUserRole(targetUserId: string, newRole: UserRole, requestingAdminId: string): Promise<UserPublicProfile> {
    const admin = await this.userRepo.findById(requestingAdminId);
    if (!admin || admin.role !== "admin" || !admin.active) {
      throw new Error("Unauthorized: Only administrators can modify roles.");
    }

    const targetUser = await this.userRepo.findById(targetUserId);
    if (!targetUser) {
      throw new Error("Target user not found.");
    }

    // Guard: Prevent admin from demoting themselves if they are the only active admin
    if (targetUser.id === admin.id && newRole !== "admin") {
      const allUsers = await this.userRepo.listUsers();
      const activeAdmins = allUsers.filter(u => u.role === "admin" && u.active);
      if (activeAdmins.length <= 1) {
        throw new Error("Cannot demote the sole active administrator.");
      }
    }

    const updated = await this.userRepo.updateUser(targetUserId, { role: newRole });
    if (!updated) {
      throw new Error("Failed to update user role.");
    }

    return toPublicProfile(updated);
  }

  /**
   * Admin-only: Deactivate user (soft delete).
   */
  async deactivateUser(targetUserId: string, requestingAdminId: string): Promise<UserPublicProfile> {
    const admin = await this.userRepo.findById(requestingAdminId);
    if (!admin || admin.role !== "admin" || !admin.active) {
      throw new Error("Unauthorized: Only administrators can deactivate accounts.");
    }

    const targetUser = await this.userRepo.findById(targetUserId);
    if (!targetUser) {
      throw new Error("Target user not found.");
    }

    // Guard: Prevent admin from deactivating themselves if they are the only active admin
    if (targetUser.id === admin.id) {
      const allUsers = await this.userRepo.listUsers();
      const activeAdmins = allUsers.filter(u => u.role === "admin" && u.active);
      if (activeAdmins.length <= 1) {
        throw new Error("Cannot deactivate the sole active administrator.");
      }
    }

    // Deactivate user and immediately invalidate all sessions
    const updated = await this.userRepo.updateUser(targetUserId, {
      active: false,
      sessionsRevokedAt: new Date().toISOString()
    });

    if (!updated) {
      throw new Error("Failed to deactivate user.");
    }

    return toPublicProfile(updated);
  }

  /**
   * Admin-only: Reactivate a deactivated user.
   */
  async reactivateUser(targetUserId: string, requestingAdminId: string): Promise<UserPublicProfile> {
    const admin = await this.userRepo.findById(requestingAdminId);
    if (!admin || admin.role !== "admin" || !admin.active) {
      throw new Error("Unauthorized: Only administrators can reactivate accounts.");
    }

    const targetUser = await this.userRepo.findById(targetUserId);
    if (!targetUser) {
      throw new Error("Target user not found.");
    }

    const updated = await this.userRepo.updateUser(targetUserId, { active: true });
    if (!updated) {
      throw new Error("Failed to reactivate user.");
    }

    return toPublicProfile(updated);
  }

  /**
   * Admin-only: Revoke all active sessions for a user.
   */
  async revokeAllSessions(targetUserId: string, requestingAdminId: string): Promise<void> {
    const admin = await this.userRepo.findById(requestingAdminId);
    if (!admin || admin.role !== "admin" || !admin.active) {
      throw new Error("Unauthorized: Only administrators can revoke user sessions.");
    }

    const targetUser = await this.userRepo.findById(targetUserId);
    if (!targetUser) {
      throw new Error("Target user not found.");
    }

    await this.userRepo.revokeAllUserSessions(targetUserId);
  }

  /**
   * Check if any users exist in the system (used to indicate if bootstrap is available).
   */
  async isBootstrapAvailable(): Promise<boolean> {
    const count = await this.userRepo.countUsers();
    return count === 0;
  }
}
