// Roomix Platform Console — read-only adapter for /api/platform/console/*.
//
// The backend endpoints return strictly read-only, superadmin-only data
// (`requirePlatformSuperadmin`). When the backend is unreachable, the
// hook in hooks/useConsoleData.ts falls back to the local demo dataset
// and tags `source: "demo"` so the UI can render a "demo data" hint
// without pretending the figures are live.

import type { ConsoleOverview } from "../types";

export interface PendingInvite {
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt?: string;
}

const buildUrl = (path: string) => {
  // The SaaS bundles the API on the same origin, so a relative URL is
  // enough. We do not allow callers to inject an absolute URL.
  if (!path.startsWith("/")) {
    throw new Error("platformConsoleApi: path must start with '/'");
  }
  return path;
};

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(buildUrl(path), {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (!response.ok) {
    let code = `HTTP_${response.status}`;
    try {
      const text = await response.text();
      const payload = text ? (JSON.parse(text) as { error?: string }) : {};
      if (typeof payload?.error === "string") code = payload.error;
    } catch {
      // fall through with HTTP_<status>
    }
    const error = new Error(code);
    (error as { status?: number }).status = response.status;
    throw error;
  }
  return (await response.json()) as T;
};

export interface IntegrationStatus {
  saas: {
    api: { status: string; base: string };
    auth: { status: string; endpoints: string[] };
    properties: { status: string; count: number; endpoint: string };
    overbookings: { status: string; endpoint: string };
    billing: { status: string; endpoint?: string };
    fnrh: { status: string };
    auditLogs: { status: string; table: string };
  };
  channelManager: {
    bridge: { status: string; reason: string };
    inboundMode: string;
    outboxWorker: string;
    otaReal: string;
    hmacGate: string;
    mappings: { status: string };
    inboundEvents: { status: string };
  };
  agents: {
    registry: { count: number; source: string };
    runtime: { status: string; endpoint: string };
  };
  unavailable: string[];
  ts: string;
}

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string;
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
  /** True when this row is the operator currently making the request. */
  isSelf: boolean;
}

export const platformConsoleApi = {
  fetchOverview: () => requestJson<ConsoleOverview>("/api/platform/console/overview"),
  listInvites: () =>
    requestJson<{ invites: PendingInvite[] }>("/api/platform/console/invites"),
  createInvite: (email: string, name?: string) =>
    requestJson<{ invite: PendingInvite }>("/api/platform/console/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    }),
  fetchIntegrationStatus: () =>
    requestJson<IntegrationStatus>("/api/platform/integration-status"),
  // Team management — superadmin-only on the backend.
  listTeamMembers: () =>
    requestJson<{ members: TeamMember[]; activeCount: number; ts: string }>("/api/platform/team/active"),
  suspendTeamMember: (userId: string) =>
    requestJson<{ user: { id: string; email: string; status: "suspended" }; previous: string; activeRemaining: number; ts: string }>(
      `/api/platform/team/${encodeURIComponent(userId)}/suspend`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    ),
  reactivateTeamMember: (userId: string) =>
    requestJson<{ user: { id: string; email: string; status: "active" }; ts: string }>(
      `/api/platform/team/${encodeURIComponent(userId)}/reactivate`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    ),
};

export type PlatformConsoleApi = typeof platformConsoleApi;
