/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15"
];

interface CacheEntry {
  timestamp: number;
  data: string;
}

const fetchCache = new Map<string, CacheEntry>();
const lastRequestTime = new Map<string, number>();

export interface ResilientFetchOptions {
  timeoutMs?: number;
  retryCount?: number;
  providerName: string;
  isDevMode?: boolean;
  cacheTtlMs?: number;
  throttleDelayMs?: number;
}

/**
 * A highly resilient fetching wrapper designed for scraping operations.
 * Features:
 * - Exponential backoff retry loop
 * - Timeout handling via AbortController
 * - Rotating User-Agents
 * - Strict rate-limit / access-denied detection (429 / 403 status codes)
 * - Smart in-memory caching to avoid redundant downstream server requests
 * - Client-side throttling to pace requests
 */
export async function resilientFetch(
  url: string,
  options: ResilientFetchOptions,
  fetchOptions: RequestInit = {}
): Promise<string> {
  const {
    timeoutMs = 10000,
    retryCount = 3,
    providerName,
    isDevMode = true,
    cacheTtlMs = 5 * 60 * 1000,
    throttleDelayMs = 1000
  } = options;

  const isTestEnv = process.env.NODE_ENV === "test" || !!process.env.VITEST;
  const effectiveTimeoutMs = isTestEnv ? Math.min(timeoutMs, 1000) : timeoutMs;
  const effectiveRetryCount = isTestEnv ? 1 : retryCount;
  const effectiveThrottle = isTestEnv ? 0 : throttleDelayMs;

  const now = Date.now();

  // 1. Smart Caching
  const cached = fetchCache.get(url);
  if (cached && now - cached.timestamp < cacheTtlMs) {
    console.log(`[ResilientFetch] [${providerName}] Serving cached response for URL: ${url}`);
    return cached.data;
  }

  // 2. Throttling
  const lastTime = lastRequestTime.get(providerName) || 0;
  const timeSinceLast = now - lastTime;
  if (!isTestEnv && timeSinceLast < effectiveThrottle) {
    const delay = effectiveThrottle - timeSinceLast;
    console.log(`[ResilientFetch] [${providerName}] Throttling request for ${delay}ms`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  lastRequestTime.set(providerName, Date.now());

  let attempt = 0;
  let backoffDelay = 500;

  while (attempt < effectiveRetryCount) {
    attempt++;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), effectiveTimeoutMs);

    const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const mergedHeaders = {
      "User-Agent": randomUA,
      ...(fetchOptions.headers || {})
    };

    try {
      console.log(`[ResilientFetch] [${providerName}] Fetching attempt ${attempt}/${retryCount} for URL: ${url}`);
      const response = await fetch(url, {
        ...fetchOptions,
        headers: mergedHeaders,
        signal: controller.signal
      });

      clearTimeout(id);

      if (response.status === 429) {
        throw new Error(`Rate-limited (HTTP 429) by remote server.`);
      }
      if (response.status === 403 || response.status === 401) {
        clearTimeout(id);
        if (isDevMode) {
          console.info(`[ResilientFetch] [${providerName}] Access restricted by remote platform (HTTP ${response.status}). Gracefully activating local fallback.`);
          return "";
        }
        throw new Error(`Access Forbidden/Blocked (HTTP ${response.status}) by remote server.`);
      }
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status} from server.`);
      }

      const text = await response.text();
      fetchCache.set(url, { timestamp: Date.now(), data: text });
      return text;

    } catch (err: any) {
      clearTimeout(id);
      const isTimeout = err.name === "AbortError";
      const errMsg = isTimeout ? `Request Timeout after ${timeoutMs}ms` : (err.message || String(err));

      const isAccessBlocked = errMsg.includes("HTTP 403") || errMsg.includes("HTTP 401") || errMsg.includes("Forbidden");
      if (isAccessBlocked) {
        if (isDevMode) {
          console.info(`[ResilientFetch] [${providerName}] Remote server restricted automated access. Gracefully activating local fallback.`);
          return "";
        }
        throw new Error(`Access restricted by remote server: ${errMsg}`);
      }

      console.warn(`[ResilientFetch] [${providerName}] Attempt ${attempt} failed: ${errMsg}`);

      if (attempt >= effectiveRetryCount) {
        if (isDevMode) {
          console.info(`[ResilientFetch] [${providerName}] Dev Mode fallback triggered. Serving local fallback data.`);
          return "";
        }
        throw new Error(`All ${effectiveRetryCount} attempts failed: ${errMsg}`);
      }

      console.log(`[ResilientFetch] [${providerName}] Retrying in ${backoffDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      backoffDelay *= 2;
    }
  }

  return "";
}

export function clearFetchCache(): void {
  fetchCache.clear();
}
