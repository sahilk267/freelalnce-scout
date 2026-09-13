/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserPublicProfile, UserRole } from "../domain/models/User";

export const ADMIN_API_KEY_STORAGE_KEY = "AZIZ_API_KEY";

// In-memory user profile cache (No sensitive JWT token stored in JS-accessible memory or Web Storage)
let memoryUser: UserPublicProfile | null = null;

/**
 * Legacy stub: JWT is now transported exclusively via HttpOnly Secure SameSite=Strict cookies.
 * Browser JavaScript never accesses or stores the raw JWT.
 */
export function getAuthToken(): string {
  return "";
}

/**
 * Retrieves the readable double-submit CSRF token from document.cookie.
 */
export function getCsrfToken(): string {
  if (typeof document === "undefined" || !document.cookie) return "";
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]).trim() : "";
}

/**
 * Retrieves the currently logged-in user profile from in-memory state.
 */
export function getAuthUser(): UserPublicProfile | null {
  return memoryUser;
}

/**
 * Stores the authenticated user profile in memory (JWT is held exclusively in HttpOnly cookie).
 * Accepts either setAuthSession(user) or setAuthSession(token, user) for backwards compatibility.
 */
export function setAuthSession(userOrToken: UserPublicProfile | string | null, user?: UserPublicProfile | null): void {
  let profile: UserPublicProfile | null = null;
  if (typeof userOrToken === "string") {
    profile = user || null;
  } else {
    profile = userOrToken || user || null;
  }

  memoryUser = profile;

  // Clean any old legacy tokens from Web Storage if they linger
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("AZIZ_JWT_TOKEN");
      sessionStorage.removeItem("AZIZ_AUTH_USER");
    }
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("AZIZ_JWT_TOKEN");
      localStorage.removeItem("AZIZ_AUTH_USER");
    }
  } catch {
    // Ignore storage errors
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("aziz-auth-changed", { detail: { user: profile } }));
  }
}

/**
 * Clears user session, invalidates cookies on server, and revokes token in server denylist.
 */
export function clearAuthSession(): void {
  memoryUser = null;

  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("AZIZ_JWT_TOKEN");
      sessionStorage.removeItem("AZIZ_AUTH_USER");
      sessionStorage.removeItem(ADMIN_API_KEY_STORAGE_KEY);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("AZIZ_JWT_TOKEN");
      localStorage.removeItem("AZIZ_AUTH_USER");
      localStorage.removeItem(ADMIN_API_KEY_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }

  // Terminate session on server: clears HttpOnly session cookie, CSRF cookie, and denylists JWT
  if (typeof fetch !== "undefined") {
    const csrfToken = getCsrfToken();
    fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: {
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
      }
    }).catch(() => {
      // Ignore background logout errors
    });
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("aziz-auth-changed", { detail: { user: null } }));
  }
}

/**
 * Checks if the current user has one of the allowed roles.
 */
export function hasRole(...allowedRoles: UserRole[]): boolean {
  const user = getAuthUser();
  if (!user) return false;
  return allowedRoles.includes(user.role);
}

/**
 * Convenience helper: Checks if current user is an active Administrator.
 */
export function isAdmin(): boolean {
  return hasRole("admin");
}

/**
 * Retrieves the current administrative API key (legacy machine/CI fallback).
 */
export function getAdminApiKey(): string {
  try {
    if (typeof localStorage !== "undefined") {
      const local = localStorage.getItem(ADMIN_API_KEY_STORAGE_KEY);
      if (local && local.trim()) {
        return local.trim();
      }
    }
    if (typeof sessionStorage !== "undefined") {
      const session = sessionStorage.getItem(ADMIN_API_KEY_STORAGE_KEY);
      if (session && session.trim()) {
        return session.trim();
      }
    }
  } catch {
    // Ignore storage access errors in restrictive environments
  }
  return "";
}

/**
 * Persists the administrative API key across storage mechanisms and notifies listeners.
 */
export function setAdminApiKey(key: string): void {
  try {
    const cleanKey = key.trim();
    if (cleanKey) {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, cleanKey);
      }
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, cleanKey);
      }
    } else {
      clearAdminApiKey();
      return;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aziz-api-key-updated", { detail: { key: cleanKey } }));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clears stored administrative API key across storage.
 */
export function clearAdminApiKey(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(ADMIN_API_KEY_STORAGE_KEY);
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(ADMIN_API_KEY_STORAGE_KEY);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aziz-api-key-updated", { detail: { key: "" } }));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Generates Headers object with CSRF token and machine fallback key if configured.
 * Session JWT is automatically attached via HttpOnly cookie by the browser.
 */
export function getAdminAuthHeaders(existingHeaders?: HeadersInit): Headers {
  const headers = new Headers(existingHeaders || {});
  
  // Attach CSRF token if present
  const csrfToken = getCsrfToken();
  if (csrfToken && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  // Fallback to machine-to-machine AZIZ_API_KEY if present
  const apiKey = getAdminApiKey();
  if (apiKey && !headers.has("X-API-Key") && !headers.has("Authorization")) {
    headers.set("X-API-Key", apiKey);
  }
  return headers;
}

/**
 * Generates Headers object with elevation confirmation header attached for dangerous actions.
 */
export function getDangerousActionHeaders(existingHeaders?: HeadersInit): Headers {
  const headers = getAdminAuthHeaders(existingHeaders);
  headers.set("X-Confirm-Dangerous-Action", "true");
  return headers;
}

/**
 * Performs an authenticated fetch call ensuring credentials: "include" and double-submit CSRF headers.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = getAdminAuthHeaders(init?.headers);
  const method = (init?.method || "GET").toUpperCase();
  const isStateChanging = ["POST", "PUT", "DELETE", "PATCH"].includes(method);
  const csrfToken = getCsrfToken();

  if (isStateChanging && csrfToken && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  const options: RequestInit = {
    ...init,
    headers,
    credentials: "include"
  };

  const res = await fetch(input, options);
  if ((res.status === 401 || res.status === 403) && typeof window !== "undefined") {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (res.status === 401 && !url.includes("/api/auth/login")) {
      memoryUser = null;
    }
    window.dispatchEvent(new CustomEvent("aziz-api-unauthorized", { detail: { url, status: res.status } }));
  }
  return res;
}
