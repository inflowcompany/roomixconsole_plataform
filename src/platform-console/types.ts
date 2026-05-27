// Roomix Platform Console — domain types shared by views and adapters.
// Mirrors the shape returned by /api/platform/console/* endpoints
// and the demo data in mockData.ts used as a fallback.

export type ConsoleStatus = "active" | "trial" | "suspended" | "demo";
export type ConsoleSeverity = "crit" | "warn" | "info" | "ok";
export type ConsoleRisk = "critical" | "high" | "medium" | "low" | null;
export type CMStatus = "ok" | "warn" | "err" | "off";
export type FNRHStatus = "ok" | "pending" | "error" | "n/a" | "demo";
export type ChannelToggle = "on" | "off" | "warn" | "err";
export type PlanName = "Starter" | "Growth" | "Evolution" | "Enterprise";

export interface PropertySummary {
  id: string;
  name: string;
  city: string;
  country: string;
  client: string;
  plan: PlanName | string;
  planTier?: number;
  status: ConsoleStatus | string;
  units: number;
  occupancy14: number;
  occupancyToday: number;
  revenueForecast: number;
  mrr: number;
  cm: ChannelToggle;
  cmStatus: CMStatus;
  fnrh: FNRHStatus;
  gateway: ChannelToggle;
  overbookings: number;
  lastLogin: string;
  lastSync: string;
  alerts: number;
  health: number;
  tags: string[];
}

export interface AlertItem {
  id: string;
  severity: ConsoleSeverity;
  kind: string;
  property: string;
  title: string;
  desc: string;
  time: string;
}

export interface TimelineEntry {
  id: string;
  kind: string;
  icon: string;
  tone: "brand" | "info" | "warn" | "danger";
  title: string;
  meta: string;
}

export interface OverbookingIncident {
  id: string;
  status: "open" | "resolved" | "ignored";
  sev: ConsoleSeverity;
  property: string;
  unit: string;
  channel: string;
  period: string;
  incoming: string;
  existing: string;
  created: string;
  resolvedBy?: string;
}

export interface CMFeedEvent {
  id: string;
  evt: string;
  prop: string;
  channel: string;
  t: string;
  status: "ok" | "warn" | "err";
}

export interface CMTableRow {
  prop: string;
  booking: ChannelToggle;
  airbnb: ChannelToggle;
  expedia: ChannelToggle;
  direct: ChannelToggle;
  mapping: CMStatus;
  inbound: CMStatus;
  outbox: number;
  last: string;
}

export interface AgentSummary {
  id: string;
  name: string;
  role: string;
  status: "active" | "paused" | "error";
  task: string;
  last: string;
  actions: number;
  risk: ConsoleRisk | string;
  icon: string;
  prop: string;
}

export interface ApprovalRequest {
  id: string;
  sev: ConsoleSeverity;
  title: string;
  desc: string;
  requested: string;
  requestedAt: string;
  impact: string;
}

export interface ClientSummary {
  id: string;
  name: string;
  property: string;
  plan: PlanName | string;
  mrr: number;
  status: "paid" | "overdue" | "trial" | "pending";
  next: string;
  last: string;
  units: number;
  addons: string[];
  risk: ConsoleRisk | string | null;
}

export interface AuditLogEntry {
  t: string;
  type: string;
  prop: string;
  user: string;
  action: string;
  status: "ok" | "warn" | "err";
  risk: ConsoleRisk | string;
}

export interface FnrhRow {
  prop: string;
  cadastur: "ativo" | "expirado" | "n/a";
  status: FNRHStatus;
  checkins: number;
  pending: number;
  last: string;
  err: number;
}

export interface PlanBreakdown {
  plan: PlanName | string;
  clients: number;
  mrr: number;
  color: string;
}

export interface OverviewMetrics {
  totalProperties: number;
  activeProperties: number;
  units: number;
  mrr: number;
  revenueForecast30d: number;
  openOverbookings: number;
  cmIncidents: number;
  checkinsToday: number;
  fnrhPending: number;
  overdueInvoices: number;
  overdueAmount: number;
  activeAgents: number;
  totalAgents: number;
}

export interface ConsoleOverview {
  metrics: OverviewMetrics;
  properties: PropertySummary[];
  alerts: AlertItem[];
  timeline: TimelineEntry[];
  cmTable: CMTableRow[];
  cmFeed: CMFeedEvent[];
  overbookings: OverbookingIncident[];
  agents: AgentSummary[];
  approvals: ApprovalRequest[];
  clients: ClientSummary[];
  logs: AuditLogEntry[];
  fnrh: FnrhRow[];
  plansData: PlanBreakdown[];
  mrrSeries: number[];
  reservationsSeries: number[];
  occupancySeries: number[];
  today: string;
  // Adapter source — never used as silent fallback. Each state is
  // rendered with its own honest hint:
  //   * "loading"  — initial state, waiting for the API.
  //   * "backend"  — real data from /api/platform/* (production baseline).
  //   * "error"    — backend call failed; data stays EMPTY (no leak).
  //   * "demo"     — operator set VITE_PLATFORM_CONSOLE_DEMO_DATA=true.
  source: "backend" | "demo" | "loading" | "error";
  // Optional partial-data flags; allow individual sections to be marked as
  // not-yet-connected without poisoning the whole payload.
  unavailable?: string[];
}

export type ConsoleViewId =
  | "overview"
  | "properties"
  | "overbookings"
  | "cm"
  | "fnrh"
  | "clients"
  | "payments"
  | "commercial-requests"
  | "agent-center"
  | "agents"
  | "automations"
  | "logs"
  | "settings";

export interface ImpersonationContext {
  propertyName: string | null;
  propertyId?: string | null;
}
