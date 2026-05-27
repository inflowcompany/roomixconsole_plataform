// Thin auth client for the Platform Console.
//
// All requests use first-party cookies via the Vite proxy (see
// vite.config.ts) so the SaaS session cookie travels naturally. We
// never read or write tokens manually; the cookie is HttpOnly upstream.

export interface PlatformConsoleUser {
  id: string;
  name: string;
  email: string;
  role: string;
  securityRole: string;
  isPlatformUser: boolean;
  tenantId?: string | null;
  organizationId?: string | null;
  workspaceId?: string | null;
  propertyIds?: string[];
  activePropertyId?: string | null;
  preferredLanguage?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface FirstAccessInput {
  email: string;
  password: string;
  name?: string;
}

class AuthApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message?: string) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

const json = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });
  const text = await response.text();
  const payload = text ? safeJsonParse(text) : {};
  if (!response.ok) {
    const code = typeof payload?.error === "string" ? payload.error : `HTTP_${response.status}`;
    throw new AuthApiError(response.status, code);
  }
  return payload as T;
};

const safeJsonParse = (text: string): Record<string, unknown> => {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
};

export interface PasswordResetRequestInput {
  email: string;
}

export interface PasswordResetConfirmInput {
  token: string;
  password: string;
}

export const authApi = {
  async login(input: LoginInput): Promise<{ user: PlatformConsoleUser }> {
    return json<{ user: PlatformConsoleUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  async firstAccess(input: FirstAccessInput): Promise<{ user: PlatformConsoleUser }> {
    return json<{ user: PlatformConsoleUser }>("/api/platform/auth/first-access", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  async me(): Promise<{ user: PlatformConsoleUser }> {
    return json<{ user: PlatformConsoleUser }>("/api/auth/me");
  },
  async logout(): Promise<{ ok: boolean }> {
    return json<{ ok: boolean }>("/api/auth/logout", {
      method: "POST",
    });
  },
  // ---- Password reset --------------------------------------------------
  // Both endpoints are PUBLIC on the SaaS side (no session). The request
  // endpoint always responds 200 neutral to avoid user enumeration. The
  // confirm endpoint returns RESET_TOKEN_INVALID / PASSWORD_TOO_SHORT
  // etc only after the operator submitted a token.
  async passwordResetRequest(input: PasswordResetRequestInput): Promise<{ ok: boolean; message: string }> {
    return json<{ ok: boolean; message: string }>(
      "/api/platform/auth/password-reset/request",
      { method: "POST", body: JSON.stringify(input) },
    );
  },
  async passwordResetConfirm(input: PasswordResetConfirmInput): Promise<{ ok: boolean; message: string }> {
    return json<{ ok: boolean; message: string }>(
      "/api/platform/auth/password-reset/confirm",
      { method: "POST", body: JSON.stringify(input) },
    );
  },
};

export { AuthApiError };
