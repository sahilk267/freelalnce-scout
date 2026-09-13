import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { getAdminApiKey, getCsrfToken } from './utils/apiAuth';

// Global window.fetch interceptor: Ensures credentials="include" and attaches CSRF token from readable cookie
try {
  const originalFetch = typeof window !== "undefined" && window.fetch ? window.fetch.bind(window) : (typeof fetch !== "undefined" ? fetch : null);
  if (originalFetch) {
    const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      let urlStr = "";
      if (typeof input === "string") {
        urlStr = input;
      } else if (input instanceof URL) {
        urlStr = input.pathname;
      } else if (input && typeof (input as any).url === "string") {
        try {
          const parsed = new URL((input as any).url, window.location.origin);
          urlStr = parsed.pathname;
        } catch {
          urlStr = (input as any).url;
        }
      }

      const isInternalApi =
        urlStr.startsWith("/api/") ||
        urlStr.startsWith("api/") ||
        (urlStr.includes("/api/") && (!urlStr.startsWith("http://") && !urlStr.startsWith("https://") || urlStr.includes(window.location.host)));

      if (isInternalApi) {
        const adminKey = getAdminApiKey();
        const csrfToken = getCsrfToken();
        const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
        const isStateChanging = ["POST", "PUT", "DELETE", "PATCH"].includes(method);
        const isDangerousAction =
          method === "DELETE" ||
          urlStr === "/api/terminal/execute" ||
          (urlStr === "/api/persistence/config" && method === "POST") ||
          urlStr === "/api/persistence/backup" ||
          urlStr === "/api/persistence/restore" ||
          urlStr === "/api/persistence/migrate" ||
          urlStr.startsWith("/api/persistence/download") ||
          urlStr === "/api/freelance/clear" ||
          urlStr.includes("/submit");

        if (typeof Request !== "undefined" && input instanceof Request) {
          const headers = new Headers(input.headers);
          if (isStateChanging && csrfToken && !headers.has("X-CSRF-Token")) {
            headers.set("X-CSRF-Token", csrfToken);
          }
          if (adminKey && !headers.has("X-API-Key") && !headers.has("Authorization")) {
            headers.set("X-API-Key", adminKey);
          }
          if (isDangerousAction && !headers.has("X-Confirm-Dangerous-Action")) {
            headers.set("X-Confirm-Dangerous-Action", "true");
          }
          input = new Request(input, { headers, credentials: "include" });
        } else {
          init = init || {};
          const headers = new Headers(init.headers || {});
          if (isStateChanging && csrfToken && !headers.has("X-CSRF-Token")) {
            headers.set("X-CSRF-Token", csrfToken);
          }
          if (adminKey && !headers.has("X-API-Key") && !headers.has("Authorization")) {
            headers.set("X-API-Key", adminKey);
          }
          if (isDangerousAction && !headers.has("X-Confirm-Dangerous-Action")) {
            headers.set("X-Confirm-Dangerous-Action", "true");
          }
          init.headers = headers;
          init.credentials = "include";
        }
      }

      const response = await originalFetch(input, init);

      if (response.status === 401 && isInternalApi) {
        window.dispatchEvent(new CustomEvent("aziz-api-unauthorized", { detail: { url: urlStr } }));
      }

      return response;
    };

    // Safely assign fetch avoiding "Cannot set property fetch which has only a getter"
    try {
      Object.defineProperty(window, "fetch", {
        value: customFetch,
        writable: true,
        configurable: true,
        enumerable: true
      });
    } catch {
      try {
        (window as any).fetch = customFetch;
      } catch {
        // Fetch is read-only in this iframe environment; fallback smoothly
      }
    }
  }
} catch (e) {
  console.warn("Could not patch window.fetch:", e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
