// Roomix Platform Console — adapter for /api/platform/commercial-requests.
//
// Backend contract:
//   GET   /api/platform/commercial-requests?limit=N   → { requests: [...] }
//   PATCH /api/platform/commercial-requests/:requestId → { request: {...} }
//
// Both routes are superadmin-only (requireDbPermission("commercial:diagnose")
// + requirePlatformSuperadmin) and audit-logged on the server side.
//
// Lifecycle (driven by the backend CHECK constraint):
//   "requested" → "in_review" → "approved" | "rejected"
//                            ↓
//                       "completed" | "cancelled"
//
// The Console treats "requested" and "in_review" as the "pending"
// states so a single counter drives the sidebar badge + the toast
// that fires when a new request arrives.

export type CommercialRequestStatus =
  | "requested"
  | "in_review"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled";

export interface CommercialRequest {
  id: string;
  tenantId: string;
  organizationId: string;
  propertyId: string;
  requestedByUserId: string;
  requestedModule: string;
  requestedPlan: string | null;
  status: CommercialRequestStatus;
  message: string | null;
  sourcePage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCommercialRequestInput {
  status?: CommercialRequestStatus;
  message?: string | null;
}

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
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

export const isPendingStatus = (status: CommercialRequestStatus): boolean =>
  status === "requested" || status === "in_review";

export const commercialRequestsApi = {
  list: async (limit = 200): Promise<CommercialRequest[]> => {
    const clamped = Math.min(Math.max(Math.floor(limit), 1), 500);
    const payload = await requestJson<{ requests?: CommercialRequest[] }>(
      `/api/platform/commercial-requests?limit=${clamped}`,
    );
    return Array.isArray(payload.requests) ? payload.requests : [];
  },
  update: async (requestId: string, input: UpdateCommercialRequestInput): Promise<CommercialRequest> => {
    const payload = await requestJson<{ request: CommercialRequest }>(
      `/api/platform/commercial-requests/${encodeURIComponent(requestId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    return payload.request;
  },
};

export type CommercialRequestsApi = typeof commercialRequestsApi;
