// Auth provider for the Roomix Platform Console.
//
// State machine:
//   "checking"  → app just booted, asking /api/auth/me whether there
//                 is an existing session cookie.
//   "anonymous" → no valid session; LoginScreen is shown.
//   "denied"    → session exists but user is not SUPER_ADMIN_ROOMIX.
//                 We show a 403-ish "Acesso restrito" screen and offer
//                 a logout so they can try a different account.
//   "authenticated" → SUPER_ADMIN_ROOMIX session active; dashboard is
//                     mounted.
//
// We never store the session token client-side. The SaaS sets an
// HttpOnly cookie; this app only reads the user metadata returned by
// /api/auth/login and /api/auth/me.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, AuthApiError, type PlatformConsoleUser } from "./api";

export type AuthStatus = "checking" | "anonymous" | "denied" | "authenticated";

interface AuthState {
  status: AuthStatus;
  user: PlatformConsoleUser | null;
  errorCode: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  firstAccess: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const initialState: AuthState = {
  status: "checking",
  user: null,
  errorCode: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

const isSuperadmin = (user: PlatformConsoleUser | null | undefined) =>
  Boolean(user && (user.securityRole === "SUPER_ADMIN_ROOMIX" || user.isPlatformUser));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  const resolveSession = useCallback(async () => {
    try {
      const { user } = await authApi.me();
      if (isSuperadmin(user)) {
        setState({ status: "authenticated", user, errorCode: null });
      } else {
        setState({ status: "denied", user, errorCode: "SUPERADMIN_REQUIRED" });
      }
    } catch (err) {
      if (err instanceof AuthApiError && (err.status === 401 || err.code === "UNAUTHENTICATED")) {
        setState({ status: "anonymous", user: null, errorCode: null });
        return;
      }
      // Unknown failures (server down, 500, etc.) — treat as anonymous so
      // we still render the login form rather than a blank app.
      setState({
        status: "anonymous",
        user: null,
        errorCode: err instanceof AuthApiError ? err.code : "NETWORK_ERROR",
      });
    }
  }, []);

  useEffect(() => {
    void resolveSession();
  }, [resolveSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      setState((prev) => ({ ...prev, errorCode: null }));
      try {
        const { user } = await authApi.login({ email, password });
        if (isSuperadmin(user)) {
          setState({ status: "authenticated", user, errorCode: null });
          return;
        }
        // Login worked but the account is not a superadmin — block
        // immediately and offer logout. The SaaS session is now active
        // for them but they can't reach any Console screen.
        setState({ status: "denied", user, errorCode: "SUPERADMIN_REQUIRED" });
      } catch (err) {
        const code = err instanceof AuthApiError ? err.code : "NETWORK_ERROR";
        setState({ status: "anonymous", user: null, errorCode: code });
        throw err;
      }
    },
    [],
  );

  const firstAccess = useCallback(
    async (email: string, password: string, name?: string) => {
      setState((prev) => ({ ...prev, errorCode: null }));
      try {
        const { user } = await authApi.firstAccess({ email, password, name });
        if (isSuperadmin(user)) {
          setState({ status: "authenticated", user, errorCode: null });
          return;
        }
        // Backend granted the claim but role is unexpected — defensive
        // bail-out into denied state.
        setState({ status: "denied", user, errorCode: "SUPERADMIN_REQUIRED" });
      } catch (err) {
        const code = err instanceof AuthApiError ? err.code : "NETWORK_ERROR";
        setState({ status: "anonymous", user: null, errorCode: code });
        throw err;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Logout should never block the UI from clearing state. Even if
      // the server roundtrip fails, we drop the local user.
    }
    setState({ status: "anonymous", user: null, errorCode: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      firstAccess,
      logout,
      refresh: resolveSession,
    }),
    [state, login, firstAccess, logout, resolveSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("[platform-console] useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
