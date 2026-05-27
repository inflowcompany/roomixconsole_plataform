// Roomix Platform Console — overbooking incident adapter.
//
// Reads global aggregate via /api/platform/overbookings (superadmin
// only, read-only). Mutations (resolve/ignore/relocate) route through
// the existing per-property endpoints — the Console attaches the
// property cookie automatically via the Vite proxy.

export interface PlatformOverbookingRow {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyCity: string | null;
  status: "open" | "resolved" | "ignored" | string;
  severity: string;
  unit: string | null;
  channel: string | null;
  period: string | null;
  incoming: string | null;
  existing: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface PlatformOverbookingsResponse {
  incidents: PlatformOverbookingRow[];
  totals: { open: number; resolved: number; ignored: number; all: number };
  ts: string;
}

export interface AvailableRoom {
  id: string;
  code: string | null;
  name: string | null;
  isCurrent: boolean;
}

export interface IncidentDetail {
  id: string;
  propertyId: string;
  status: string;
  incomingReservationId?: string | null;
  existingReservationId?: string | null;
  sourceChannel?: string | null;
  roomId?: string | null;
  roomLabel?: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  createdAt?: string;
  resolvedAt?: string | null;
  notes?: string | null;
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

export const overbookingsApi = {
  /** Global aggregate — superadmin only. */
  list(status?: "open" | "resolved" | "ignored") {
    const qs = status ? `?status=${status}` : "";
    return json<PlatformOverbookingsResponse>(`/api/platform/overbookings${qs}`);
  },
  /** Per-property detail. */
  detail(propertyId: string, incidentId: string) {
    return json<{ incident: IncidentDetail }>(
      `/api/properties/${encodeURIComponent(propertyId)}/overbooking/incidents/${encodeURIComponent(incidentId)}`,
    );
  },
  /** Per-property: list of rooms where the incident can be relocated. */
  availableRooms(propertyId: string, incidentId: string) {
    return json<{ incident: IncidentDetail; currentRoomId: string; availableRooms: AvailableRoom[] }>(
      `/api/properties/${encodeURIComponent(propertyId)}/overbooking/incidents/${encodeURIComponent(incidentId)}/available-rooms`,
    );
  },
  resolve(propertyId: string, incidentId: string, notes?: string) {
    return json<{ incident: IncidentDetail }>(
      `/api/properties/${encodeURIComponent(propertyId)}/overbooking/incidents/${encodeURIComponent(incidentId)}/resolve`,
      { method: "POST", body: JSON.stringify({ notes: notes || null }) },
    );
  },
  ignore(propertyId: string, incidentId: string, notes: string) {
    return json<{ incident: IncidentDetail }>(
      `/api/properties/${encodeURIComponent(propertyId)}/overbooking/incidents/${encodeURIComponent(incidentId)}/ignore`,
      { method: "POST", body: JSON.stringify({ notes }) },
    );
  },
  relocate(propertyId: string, incidentId: string, targetRoomId: string, notes?: string) {
    return json<{ incident: IncidentDetail }>(
      `/api/properties/${encodeURIComponent(propertyId)}/overbooking/incidents/${encodeURIComponent(incidentId)}/relocate`,
      { method: "POST", body: JSON.stringify({ targetRoomId, notes: notes || null }) },
    );
  },
};
