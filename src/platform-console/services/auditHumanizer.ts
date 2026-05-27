// Audit log presentation layer.
//
// Three concerns kept together so the Logs view stays declarative:
//   1. ACTION humanizer — turns eventType/action codes into a short
//      Portuguese sentence the operator can scan.
//   2. ACTOR humanizer — turns actorRole into a friendly type label
//      and groups roles into 7 actor "kinds" (Superadmin Roomix,
//      Property staff, Owner, Agent, System, Channel Manager,
//      API/Webhook).
//   3. PROPERTY resolver — builds a map of propertyId → summary that
//      the Logs view uses to render the property name + city in
//      place of bare UUIDs.
//
// Everything here is PURE — no fetch, no state. The caller (Logs.tsx)
// holds the property map (from useConsoleData) and passes it in.

import type { PlatformAuditLogEntry } from "./auditLogsApi";
import type { PropertySummary } from "../types";

// ---- ACTION ------------------------------------------------------

/**
 * Map of well-known eventType / action codes to human phrases. New
 * codes simply fall through to a deterministic, readable default
 * built from the technical name.
 */
const ACTION_MAP: Record<string, string> = {
  // Auth
  login_success: "Login realizado",
  login_failed: "Tentativa de login falhou",
  logout: "Logout efetuado",

  // Platform Console reads
  platform_audit_logs_read: "Visualizou Logs & Auditoria",
  platform_console_overview_read: "Abriu o Console (visão geral)",
  platform_console_integration_status_read: "Consultou status de integração",
  platform_console_agents_status_read: "Consultou status dos agentes",
  platform_console_invites_read: "Listou convites pendentes",
  platform_console_invites_create: "Criou convite de operador",
  platform_console_invites_revoke: "Revogou convite",
  platform_console_impersonation_started: "Abriu propriedade como superadmin",
  platform_console_impersonation_ended: "Encerrou impersonation",
  platform_console_properties_create: "Criou propriedade pelo Console",
  platform_console_properties_update: "Atualizou propriedade pelo Console",
  platform_console_demo_property_created: "Criou propriedade demo",

  // Commercial requests
  commercial_requests_platform_read: "Listou solicitações comerciais",
  commercial_request_status_updated: "Atualizou solicitação comercial",
  commercial_request_created: "Recebeu nova solicitação comercial",

  // Overbookings
  platform_overbookings_list: "Listou overbookings (global)",
  overbooking_resolved: "Marcou overbooking como resolvido",
  overbooking_ignored: "Ignorou overbooking",
  overbooking_relocated: "Realocou overbooking",
  overbooking_incident_created: "Detectou overbooking",

  // Channel Manager
  platform_channel_manager_action: "Acionou Channel Manager (console)",
  channel_manager_action_test_webhook: "Testou webhook do Channel Manager",
  channel_manager_action_replay_outbox: "Tentou replay da outbox",
  channel_manager_action_reprocess_all: "Tentou reprocessar tudo",
  channel_manager_inbound_event_received: "Recebeu evento inbound",
  channel_manager_mapping_updated: "Atualizou mapping de canal",
  channel_health_check_run: "Verificou saúde do Channel Manager",

  // Agents
  platform_agents_status_update: "Mudou status do agente",
  platform_agents_run_check: "Executou run-check do agente",
  platform_agents_run_check_skipped: "Run-check ignorado",
  platform_agents_config_read: "Consultou configuração do agente",

  // LGPD
  lgpd_request_created: "Abriu solicitação LGPD",
  lgpd_request_updated: "Atualizou solicitação LGPD",

  // Security
  audit_log_read: "Consultou audit log",
  audit_log_read_denied: "Acesso a audit log negado",
};

export function formatAuditAction(entry: Pick<PlatformAuditLogEntry, "action" | "eventType">): string {
  const direct = ACTION_MAP[entry.eventType] || ACTION_MAP[entry.action];
  if (direct) return direct;
  // Fallback — take the technical name, drop common prefixes, replace
  // separators, capitalize the first word.
  const base = (entry.eventType || entry.action || "").replace(
    /^(platform_|channel_manager_|agent_|agents_|lgpd_|fnrh_|billing_|security_|audit_|auth_)/,
    "",
  );
  const cleaned = base.replace(/_/g, " ").trim();
  if (!cleaned) return entry.action || entry.eventType || "—";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// Suffix for "denied" actions so the operator immediately sees the
// outcome without reading the metadata.
export function isDeniedAction(entry: Pick<PlatformAuditLogEntry, "action" | "eventType">): boolean {
  return /_denied$|_skipped$/.test(entry.action) || /_denied$|_skipped$/.test(entry.eventType);
}

// ---- ACTOR -------------------------------------------------------

export type ActorKind =
  | "superadmin"
  | "tenant-owner"
  | "property-admin"
  | "property-staff"
  | "agent"
  | "system"
  | "channel-manager"
  | "webhook"
  | "unknown";

export interface ActorSummary {
  kind: ActorKind;
  label: string;
  sub: string;
}

const ROLE_TO_KIND: Record<string, ActorKind> = {
  SUPER_ADMIN_ROOMIX: "superadmin",
  SUPER_ADMIN: "superadmin",
  TENANT_OWNER: "tenant-owner",
  PROPERTY_ADMIN: "property-admin",
  MANAGER: "property-staff",
  STAFF: "property-staff",
  RECEPTION: "property-staff",
  HOUSEKEEPING: "property-staff",
  QA: "superadmin",
};

const KIND_LABEL: Record<ActorKind, { label: string; sub: string }> = {
  superadmin: { label: "Superadmin Roomix", sub: "equipe interna" },
  "tenant-owner": { label: "Proprietário", sub: "dono do tenant" },
  "property-admin": { label: "Admin da propriedade", sub: "operador autorizado" },
  "property-staff": { label: "Usuário da propriedade", sub: "operador" },
  agent: { label: "Agente Roomix", sub: "execução automática" },
  system: { label: "Sistema", sub: "evento automático" },
  "channel-manager": { label: "Channel Manager", sub: "bridge externa" },
  webhook: { label: "Webhook / API", sub: "integração externa" },
  unknown: { label: "Ator não identificado", sub: "sem role registrado" },
};

export function resolveActor(entry: Pick<PlatformAuditLogEntry, "actorRole" | "actorUserId" | "eventType">): ActorSummary {
  const role = (entry.actorRole || "").toUpperCase().trim();
  let kind: ActorKind;
  if (!entry.actorUserId && !role) {
    // No actor + event came from a known automatic path → system/webhook.
    if (/^channel_manager_inbound/.test(entry.eventType || "")) {
      kind = "channel-manager";
    } else if (/_webhook|_inbound|_callback/.test(entry.eventType || "")) {
      kind = "webhook";
    } else if (/^agent_|^agents_|^platform_agents_run_check$/.test(entry.eventType || "")) {
      kind = "agent";
    } else {
      kind = "system";
    }
  } else if (ROLE_TO_KIND[role]) {
    kind = ROLE_TO_KIND[role];
  } else if (/^agent[_-]/i.test(role) || /^bot[_-]/i.test(role)) {
    kind = "agent";
  } else {
    kind = "unknown";
  }
  const base = KIND_LABEL[kind];
  // Subline includes the technical role when meaningful.
  const sub = role && kind !== "system" && kind !== "channel-manager" && kind !== "webhook"
    ? `${base.sub} · ${role}`
    : base.sub;
  return { kind, label: base.label, sub };
}

// ---- PROPERTY ----------------------------------------------------

export interface ResolvedProperty {
  id: string;
  name: string;
  city?: string;
  exists: boolean;
}

/** Pre-compute a Map for O(1) lookup. */
export function buildPropertyIndex(properties: PropertySummary[]): Map<string, ResolvedProperty> {
  const map = new Map<string, ResolvedProperty>();
  for (const p of properties) {
    map.set(p.id, { id: p.id, name: p.name, city: p.city, exists: true });
  }
  return map;
}

export function resolveProperty(
  propertyId: string | undefined | null,
  index: Map<string, ResolvedProperty>,
): ResolvedProperty | null {
  if (!propertyId) return null;
  const hit = index.get(propertyId);
  if (hit) return hit;
  return { id: propertyId, name: "Propriedade não encontrada", exists: false };
}
