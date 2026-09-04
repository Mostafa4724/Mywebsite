/* Shared browser authentication.
   Access + refresh tokens live in localStorage so all tabs share one session.
   Existing sessionStorage keys are kept as a compatibility bridge for older
   pages while the site is migrated to Auth.*.
*/
(() => {
  "use strict";

  const ACCESS_KEY = "auth_token";
  const REFRESH_KEY = "auth_refresh_token";
  const USER_KEY = "auth_user";
  const LEGACY_TOKEN = "token";

  const read = (key) => {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  };

  const write = (key, value) => {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  };

  const decodePayload = (token) => {
    try {
      const part = token.split(".")[1];
      const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(
        atob(normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, "="))
          .split("")
          .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      ));
    } catch (_) {
      return null;
    }
  };

  const getToken = () => read(ACCESS_KEY) || sessionStorage.getItem(LEGACY_TOKEN);
  const getRefreshToken = () => read(REFRESH_KEY);
  const getUser = () => {
    try {
      const raw = read(USER_KEY) || sessionStorage.getItem("auth_user") || sessionStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  };

  const syncLegacy = () => {
    const token = read(ACCESS_KEY);
    const user = read(USER_KEY);
    try {
      if (token) sessionStorage.setItem(LEGACY_TOKEN, token);
      else sessionStorage.removeItem(LEGACY_TOKEN);
      if (user) {
        sessionStorage.setItem("auth_user", user);
        sessionStorage.setItem("user", user);
      } else {
        sessionStorage.removeItem("auth_user");
        sessionStorage.removeItem("user");
      }
      if (token) sessionStorage.setItem("adminLoggedIn", getUser()?.role === "admin" ? "true" : "false");
      else sessionStorage.removeItem("adminLoggedIn");
    } catch (_) {}
  };

  // One-time migration from the old per-tab session.
  if (!read(ACCESS_KEY)) {
    const oldToken = sessionStorage.getItem(LEGACY_TOKEN);
    const oldUser = sessionStorage.getItem("auth_user") || sessionStorage.getItem("user");
    if (oldToken) write(ACCESS_KEY, oldToken);
    if (oldUser) write(USER_KEY, oldUser);
  }
  syncLegacy();

  let refreshPromise = null;

  const setSession = (data) => {
    if (!data || !data.token) throw new Error("Invalid authentication response.");
    write(ACCESS_KEY, data.token);
    if (data.refresh_token) write(REFRESH_KEY, data.refresh_token);
    if (data.user) write(USER_KEY, JSON.stringify(data.user));
    syncLegacy();
    window.dispatchEvent(new CustomEvent("auth:changed", { detail: data }));
  };

  const clear = () => {
    write(ACCESS_KEY, null);
    write(REFRESH_KEY, null);
    write(USER_KEY, null);
    syncLegacy();
    window.dispatchEvent(new Event("auth:logout"));
  };

  const refresh = async () => {
    if (refreshPromise) return refreshPromise;

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clear();
      return null;
    }

    refreshPromise = (async () => {
      try {
        const response = await window.__authOriginalFetch(`${window.API}/refresh`, {
          method: "POST",
          headers: { Authorization: `Bearer ${refreshToken}` }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success || !data.token) {
          clear();
          return null;
        }
        setSession(data);
        return data.token;
      } catch (_) {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  };

  const needsRefresh = () => {
    const token = getToken();
    if (!token) return false;
    const payload = decodePayload(token);
    if (!payload || !payload.exp) return true;
    return (payload.exp * 1000 - Date.now()) < 60 * 1000;
  };

  const ensureFresh = async () => {
    if (needsRefresh()) return !!(await refresh());
    return !!getToken();
  };

  const logout = async () => {
    const token = getToken();
    try {
      if (token) {
        await window.__authOriginalFetch(`${window.API}/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (_) {}
    clear();
  };

  const fetchWithAuth = async (url, options = {}, retry = true) => {
    const opts = { ...options, headers: new Headers(options.headers || {}) };
    const isApiRequest = typeof url === "string" && window.API && url.startsWith(window.API);

    if (isApiRequest && opts.headers.has("Authorization")) {
      await ensureFresh();
      const current = getToken();
      if (current) opts.headers.set("Authorization", `Bearer ${current}`);
    }

    let response = await window.__authOriginalFetch(url, opts);

    if (isApiRequest && retry && response.status === 401 && opts.headers.has("Authorization")) {
      const newToken = await refresh();
      if (newToken) {
        opts.headers.set("Authorization", `Bearer ${newToken}`);
        response = await window.__authOriginalFetch(url, opts);
      }
    }

    return response;
  };

  const requireUser = () => {
    if (!getToken() || !getUser()) {
      const target = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `../page/login.html?next=${target}`;
      return false;
    }
    return true;
  };

  const requireAdmin = () => {
    const user = getUser();
    if (!getToken() || !user || user.role !== "admin") {
      window.location.href = "../page/login.html";
      return false;
    }
    return true;
  };

  const Auth = {
    getToken,
    getRefreshToken,
    getUser,
    getAccountId: () => getUser()?.id ?? null,
    isLoggedIn: () => !!getToken(),
    isAdmin: () => getUser()?.role === "admin",
    setSession,
    clear,
    logout,
    refresh,
    fetch: fetchWithAuth,
    requireUser,
    requireAdmin
  };

  window.Auth = Auth;
  window.__authOriginalFetch = window.fetch.bind(window);
  window.fetch = fetchWithAuth;

  window.addEventListener("storage", (event) => {
    if ([ACCESS_KEY, REFRESH_KEY, USER_KEY].includes(event.key)) {
      syncLegacy();
      window.dispatchEvent(new Event(event.newValue ? "auth:changed" : "auth:logout"));
    }
  });
})();
