// Roomix Platform Console — approval queue adapter.
//
// Reads the real human-approval queue via /api/platform/approvals (superadmin
// only, read-only) and drives the two human decisions: approve / reject.
// Approving triggers the backend dispatcher to execute the now-approved action
// server-side; the Console never executes anything itself. There is NO mock
// fallback — if the backend is unreachable the panel shows an honest error.

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type ApprovalRiskLevel = "low" | "medium" | "high";
export type ApprovalExecutionStatus = "none" | "executing" | "executed" | "failed";

export interface PlatformApprovalRequest {
  id: string;
  tenantId: string;
  organizationId: string;
  propertyId: string | null;
  agentId: string;
  proposedByActor: string;
  proposedByRole: string | null;
  actionType: string;
  targetEntityType: string | null;
  targetEntityId: string | null;
  payload: Record<string, unknown>;
  payloadHash: string;
  reason: string | null;
  riskLevel: ApprovalRiskLevel;
  status: ApprovalStatus;
  decidedByActor: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  executionStatus: ApprovalExecutionStatus;
  executionResult: Record<string, unknown> | null;
  executionError: string | null;
  executedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalExecutionOutcome {
  status: "executed" | "failed" | "skipped";
  result?: Record<string, unknown> | null;
  error?: string | null;
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
  const payload = text
    ? (() => {
        try {
          return JSON.parse(text) as Record<string, unknown>;
        } catch {
          return {};
        }
      })()
    : {};
  if (!response.ok) {
    const code = typeof payload?.error === "string" ? (payload.error as string) : `HTTP_${response.status}`;
    const err = new Error(code);
    (err as { status?: number }).status = response.status;
    throw err;
  }
  return payload as T;
};

export const approvalsApi = {
  /** List proposals (default: pending). Superadmin only, read-only. */
  list(status: ApprovalStatus | "all" = "pending", limit = 100) {
    const qs = `?status=${encodeURIComponent(status)}&limit=${limit}`;
    return json<{ requests: PlatformApprovalRequest[] }>(`/api/platform/approvals${qs}`);
  },
  detail(id: string) {
    return json<{ request: PlatformApprovalRequest }>(
      `/api/platform/approvals/${encodeURIComponent(id)}`,
    );
  },
  /** Human approval → backend dispatcher executes the action server-side. */
  approve(id: string, note?: string) {
    return json<{ request: PlatformApprovalRequest; execution: ApprovalExecutionOutcome }>(
      `/api/platform/approvals/${encodeURIComponent(id)}/approve`,
      { method: "POST", body: JSON.stringify({ note: note || null }) },
    );
  },
  /** Human rejection → no side effect, just audited. */
  reject(id: string, note?: string) {
    return json<{ request: PlatformApprovalRequest }>(
      `/api/platform/approvals/${encodeURIComponent(id)}/reject`,
      { method: "POST", body: JSON.stringify({ note: note || null }) },
    );
  },
};
