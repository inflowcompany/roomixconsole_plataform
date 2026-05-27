// Roomix Platform Console — agent runtime adapter.
//
// Fetches per-agent runtime payloads from the SaaS backend. The static
// registry in `../agents/agentRegistry.ts` defines structure; this
// endpoint contributes live data (status, current task, action count).
// When the endpoint is unavailable, the UI falls back to the registry
// defaults and marks each agent as "não conectado".
//
// Mutations (status / run-check) are superadmin-only on the backend.
// The frontend never holds an LLM key — `fetchConfig` returns only the
// public flags (configured / enabled / provider / model).

import type { AgentRuntime } from "../agents/agentCapabilities";

export interface AgentsStatusResponse {
  agents: AgentRuntime[];
  /** Sections of the agent runtime that are not yet wired. */
  unavailable?: string[];
  /** "backend" when the SaaS returned real data; "registry" when fallback. */
  source: "backend" | "registry";
}

export interface AgentPublicLlmConfig {
  configured: boolean;
  enabled: boolean;
  provider: string | null;
  model: string | null;
}

export interface AgentConfigResponse {
  agentId: string;
  runtime: { status: "active" | "paused"; lastRun: string | null; actions24h: number };
  llm: AgentPublicLlmConfig;
  guarantees: {
    otaReal: boolean;
    channelManagerProduction: boolean;
    gatewayReal: boolean;
    fnrhProduction: boolean;
    guestMessaging: boolean;
    autoCancel: boolean;
    autoRateChange: boolean;
  };
  ts: string;
}

export type ReasoningMode = "no-llm" | "llm-ready-not-called" | "llm-called";

export interface AgentRunCheckResult {
  agentId: string;
  scope: string;
  runtimeStatus: "active" | "paused";
  result: {
    mode: ReasoningMode;
    summary: string;
    risk: "low" | "medium" | "high";
    recommendations: string[];
    suggestedActions: Array<{ id: string; label: string; requiresApproval: boolean }>;
    requiresApproval: boolean;
    evidenceRefs: string[];
    llmRoundtripMs?: number;
  };
  ts: string;
}

const json = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
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
      // fall through
    }
    const error = new Error(code);
    (error as { status?: number }).status = response.status;
    throw error;
  }
  return (await response.json()) as T;
};

export const agentsApi = {
  fetchStatus: () => json<AgentsStatusResponse>("/api/platform/agents/status"),
  fetchConfig: (agentId: string) =>
    json<AgentConfigResponse>(`/api/platform/agents/${encodeURIComponent(agentId)}/config`),
  updateStatus: (agentId: string, status: "active" | "paused") =>
    json<{ agentId: string; previous: "active" | "paused"; status: "active" | "paused"; ts: string }>(
      `/api/platform/agents/${encodeURIComponent(agentId)}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    ),
  runCheck: (agentId: string, scope?: string) =>
    json<AgentRunCheckResult>(`/api/platform/agents/${encodeURIComponent(agentId)}/run-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: scope || "platform-console" }),
    }),
};
