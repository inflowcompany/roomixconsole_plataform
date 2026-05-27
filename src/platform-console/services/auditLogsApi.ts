// Roomix Platform Console — adapter for /api/platform/audit-logs.
//
// Read-only: lists persistent audit log entries already written by the
// SaaS via recordPersistentAudit(). The Console never mutates audit
// data — it only reads, filters and exports.
//
// Backend contract:
//   GET /api/platform/audit-logs?eventType=&severity=&propertyId=&limit=
//   superadmin-only (requirePlatformSuperadmin), the read itself is
//   audited so we keep a trail of who looked at what.

export type AuditLogSeverity = "info" | "warning" | "error";

export interface PlatformAuditLogEntry {
  id: string;
  tenantId?: string;
  organizationId?: string;
  propertyId?: string;
  actorUserId?: string;
  actorRole?: string;
  eventType: string;
  action: string;
  entityType: string;
  entityId?: string;
  severity: AuditLogSeverity;
  metadata: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface PlatformAuditLogsResponse {
  events: PlatformAuditLogEntry[];
  count: number;
  limit: number;
  ts: string;
}

export type AuditLogModule =
  | "console"
  | "saas"
  | "cm"
  | "agent"
  | "lgpd"
  | "fnrh"
  | "billing"
  | "security";

export interface AuditLogsFilter {
  eventType?: string;
  severity?: AuditLogSeverity;
  /** Optional — backend defaults to cross-tenant when omitted (superadmin global view). */
  tenantId?: string;
  propertyId?: string;
  actor?: string;
  module?: AuditLogModule;
  /** ISO date string (inclusive lower bound). */
  from?: string;
  /** ISO date string (inclusive upper bound). */
  to?: string;
  /** Free-text needle (matches action / eventType / entityType / entityId / actor). */
  q?: string;
  limit?: number;
}

const buildQuery = (filter: AuditLogsFilter): string => {
  const params = new URLSearchParams();
  if (filter.eventType) params.set("eventType", filter.eventType);
  if (filter.severity) params.set("severity", filter.severity);
  if (filter.tenantId) params.set("tenantId", filter.tenantId);
  if (filter.propertyId) params.set("propertyId", filter.propertyId);
  if (filter.actor) params.set("actor", filter.actor);
  if (filter.module) params.set("module", filter.module);
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  if (filter.q) params.set("q", filter.q);
  if (typeof filter.limit === "number" && filter.limit > 0) {
    params.set("limit", String(Math.min(Math.max(Math.floor(filter.limit), 1), 500)));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

// Map an audit log entry to the operator-facing "origem" bucket. This
// mirrors the MODULE_PREFIX table on the server but stays as a pure
// function so the UI can compute it without a roundtrip.
export function deriveOrigin(entry: { eventType?: string; action?: string }): AuditLogModule {
  const sample = `${entry.eventType || ""} ${entry.action || ""}`;
  if (/^channel_manager_|^channel_health_/.test(sample) || sample.includes(" channel_manager_")) return "cm";
  if (/^agent_|^agents_/.test(sample) || sample.includes(" agent_")) return "agent";
  if (/^lgpd_/.test(sample) || sample.includes(" lgpd_")) return "lgpd";
  if (/^fnrh_/.test(sample) || sample.includes(" fnrh_")) return "fnrh";
  if (/^billing_|^commercial_|^payment_/.test(sample) || sample.includes(" billing_")) return "billing";
  if (/^security_|^audit_|^auth_/.test(sample) || sample.includes(" security_")) return "security";
  if (/^platform_/.test(sample) || sample.includes(" platform_")) return "console";
  return "saas";
}

export const ORIGIN_LABEL: Record<AuditLogModule, string> = {
  console: "Console",
  saas: "SaaS",
  cm: "Channel Manager",
  agent: "Agent Center",
  lgpd: "LGPD",
  fnrh: "FNRH",
  billing: "Billing",
  security: "Security",
};

const request = async <T>(path: string): Promise<T> => {
  const response = await fetch(path, {
    credentials: "include",
    headers: { Accept: "application/json" },
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

export const auditLogsApi = {
  list: (filter: AuditLogsFilter = {}) =>
    request<PlatformAuditLogsResponse>(`/api/platform/audit-logs${buildQuery(filter)}`),
};

export type AuditLogsApi = typeof auditLogsApi;
