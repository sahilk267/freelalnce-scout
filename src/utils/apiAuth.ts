/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const ADMIN_API_KEY_STORAGE_KEY = "AZIZ_API_KEY";

/**
 * Retrieves the current administrative API key from localStorage, sessionStorage, or cookies.
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
    if (typeof document !== "undefined" && document.cookie) {
      const match = document.cookie.match(/(?:^|;\s*)aziz_api_key=([^;]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]).trim();
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
      if (typeof document !== "undefined") {
        document.cookie = `aziz_api_key=${encodeURIComponent(cleanKey)}; path=/; SameSite=Lax`;
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
 * Clears stored administrative API key across storage and cookies.
 */
export function clearAdminApiKey(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(ADMIN_API_KEY_STORAGE_KEY);
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(ADMIN_API_KEY_STORAGE_KEY);
    }
    if (typeof document !== "undefined") {
      document.cookie = "aziz_api_key=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aziz-api-key-updated", { detail: { key: "" } }));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Generates Headers object with X-API-Key attached if administrative key is present.
 */
export function getAdminAuthHeaders(existingHeaders?: HeadersInit): Headers {
  const headers = new Headers(existingHeaders || {});
  const apiKey = getAdminApiKey();
  if (apiKey && !headers.has("X-API-Key") && !headers.has("Authorization")) {
    headers.set("X-API-Key", apiKey);
  }
  return headers;
}

/**
 * Generates Headers object with both X-API-Key and elevated confirmation header attached for dangerous actions.
 */
export function getDangerousActionHeaders(existingHeaders?: HeadersInit): Headers {
  const headers = getAdminAuthHeaders(existingHeaders);
  headers.set("X-Confirm-Dangerous-Action", "true");
  return headers;
}

/**
 * Performs an authenticated fetch call ensuring admin credentials are automatically injected.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = getAdminAuthHeaders(init?.headers);
  const options: RequestInit = {
    ...init,
    headers,
    credentials: init?.credentials || "same-origin"
  };

  const res = await fetch(input, options);
  if (res.status === 401 && typeof window !== "undefined") {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    window.dispatchEvent(new CustomEvent("aziz-api-unauthorized", { detail: { url } }));
  }
  return res;
}
