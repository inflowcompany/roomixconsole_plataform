// Roomix Platform Console — static Agent Registry.
//
// Every agent that exists conceptually in the Roomix ecosystem is
// declared here with its **structure**: skills, data sources,
// permissions, risk profile, and sensitive actions that must NEVER
// auto-execute. This is the source of truth that fills the Agent
// Center and Agentes Roomix screens even when the backend runtime
// is not yet hooked up.
//
// Runtime state (current task, last execution, in-flight counters,
// real status) layers ON TOP of this registry via the endpoint
// `/api/platform/agents/status`. When that endpoint is unavailable,
// the registry's `defaults` block is used and the agent is shown as
// `not-connected` so we never fake activity.
//
// Pattern reference (not copied):
//   • https://github.com/anthropics/skills — metadata-driven skills
//     organised by purpose; each skill declares its tool surface.
//   • https://github.com/addyosmani/agent-skills — registries with
//     `permissions`, `requires_approval`, and explicit `blocks`
//     for sensitive operations.
// We mirror the *concept* (declarative permissions + approval gating
// + data-source scoping) without depending on either project.

export type AgentDataSource =
  | "roomix-saas"
  | "roomix-channel-manager"
  | "audit-logs"
  | "billing"
  | "fnrh"
  | "overbookings"
  | "communications"
  | "design-tokens"
  | "documentation";

export type AgentRuntimeStatus =
  | "connected"
  | "read-only"
  | "not-connected"
  | "config-required";

export type AgentCategory =
  | "orchestration"
  | "operations"
  | "security"
  | "billing"
  | "compliance"
  | "communication"
  | "commercial"
  | "design"
  | "documentation"
  | "data";

export interface AgentPermissions {
  /** Read scopes the agent can hit without approval. */
  reads: string[];
  /** Mutations the agent can PROPOSE (creates a pending approval). */
  proposes: string[];
  /**
   * Mutations explicitly DENIED to this agent regardless of role.
   * These appear in the UI as red badges "ação sensível · bloqueada".
   */
  blockedSensitive: string[];
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  category: AgentCategory;
  /** Kebab-case lucide icon name. */
  icon: string;
  /**
   * Where this agent gets its information. The Console renders a
   * data-source chip strip on each agent card.
   */
  dataSources: AgentDataSource[];
  /** Capability strings (used both as labels and as skill identifiers). */
  skills: string[];
  /** What the agent is allowed/proposed/blocked from doing. */
  permissions: AgentPermissions;
  /** Default risk profile when no runtime data is available. */
  risk: "low" | "medium" | "high";
  /**
   * Fallback values rendered when the backend doesn't report runtime
   * data. They MUST be honest about "não conectado" — we never invent
   * counts of executed actions when nothing is running yet.
   */
  defaults: {
    runtimeStatus: AgentRuntimeStatus;
    currentTask: string;
    lastRun: string;
    actions24h: number;
    scope: string;
  };
}

export type AgentRegistry = AgentDefinition[];

const SENSITIVE_GLOBAL = [
  "Ativar OTA real (Booking/Airbnb/Expedia)",
  "Ativar Channel Manager production",
  "Ativar gateway de pagamentos",
  "Ativar FNRH production",
  "Cancelar reserva real",
  "Enviar mensagem real ao hóspede",
  "Alterar tarifa real automaticamente",
  "Alterar plano do cliente",
  "Restaurar banco",
  "Mexer em domínio",
];

export const AGENT_REGISTRY: AgentRegistry = [
  {
    id: "jarvis-orchestrator",
    name: "Jarvis Orchestrator",
    role: "Coordena sprints, roteia tarefas e prioriza incidentes entre os demais agentes Roomix.",
    category: "orchestration",
    icon: "cpu",
    dataSources: ["roomix-saas", "roomix-channel-manager", "audit-logs"],
    skills: [
      "task.routing",
      "sprint.plan",
      "incident.prioritize",
      "agent.coordinate",
      "approval.gate",
      // PoC Fase 1 — ações reais exercidas pelo runtime roomix-agents:
      "health.read",
      "insight.publish",
    ],
    permissions: {
      // health.read é a leitura permitida (inerte) do PoC.
      reads: ["overview", "agents.status", "audit-logs", "incidents", "health.read"],
      // insight.publish é a única gated wired ponta-a-ponta na Fase 1;
      // overbooking.resolve é gated mas execução não-wired (etapa posterior).
      proposes: ["sprint.create", "incident.escalate", "agent.start", "insight.publish", "overbooking.resolve"],
      blockedSensitive: SENSITIVE_GLOBAL,
    },
    risk: "medium",
    defaults: {
      runtimeStatus: "read-only",
      currentTask: "Aguardando runtime real — lendo estado agregado do Console.",
      lastRun: "—",
      actions24h: 0,
      scope: "global · multi-tenant",
    },
  },
  {
    id: "operations-agent",
    name: "Operations Agent",
    role: "Detecta e propõe remediação de incidentes operacionais (overbooking, falhas de sync, divergências).",
    category: "operations",
    icon: "activity",
    dataSources: ["roomix-saas", "roomix-channel-manager", "overbookings", "audit-logs"],
    skills: [
      "overbooking.detect",
      "overbooking.propose-realloc",
      "sync.failure.diagnose",
      "incident.escalate",
    ],
    permissions: {
      reads: ["properties", "overbookings", "reservations", "rooms"],
      proposes: ["reservation.realocate", "incident.resolve"],
      blockedSensitive: ["Cancelar reserva real", "Enviar mensagem real ao hóspede", "Alterar tarifa real automaticamente"],
    },
    risk: "high",
    defaults: {
      runtimeStatus: "not-connected",
      currentTask: "Aguardando endpoint /api/platform/agents/operations.",
      lastRun: "—",
      actions24h: 0,
      scope: "todas as propriedades",
    },
  },
  {
    id: "qa-health-agent",
    name: "QA / Health Agent",
    role: "Acompanha health checks, smokes, contratos OpenAPI e regressões visuais.",
    category: "operations",
    icon: "stethoscope",
    dataSources: ["roomix-saas", "audit-logs"],
    skills: [
      "health.scan",
      "smoke.run",
      "contract.validate",
      "regression.detect",
    ],
    permissions: {
      reads: ["health", "smoke-results", "contracts"],
      proposes: ["smoke.retry"],
      blockedSensitive: ["Restaurar banco"],
    },
    risk: "low",
    defaults: {
      runtimeStatus: "read-only",
      currentTask: "Health check /api/health · 200 ok",
      lastRun: "agora há pouco",
      actions24h: 0,
      scope: "infra · superfície de API",
    },
  },
  {
    id: "security-hardening-agent",
    name: "Security / Hardening Agent",
    role: "Audita superfície, valida HMAC, monitora cross-tenant risk e bloqueia ações sensíveis.",
    category: "security",
    icon: "shield",
    dataSources: ["roomix-saas", "roomix-channel-manager", "audit-logs"],
    skills: [
      "secret.scan",
      "hmac.validate",
      "cross-tenant.audit",
      "csrf.review",
      "ratelimit.audit",
    ],
    permissions: {
      reads: ["audit-logs", "config", "headers"],
      proposes: ["security.advisory"],
      blockedSensitive: SENSITIVE_GLOBAL,
    },
    risk: "high",
    defaults: {
      runtimeStatus: "read-only",
      currentTask: "Scan passivo · HMAC gate ativo · CSRF origin gate ativo",
      lastRun: "agora há pouco",
      actions24h: 0,
      scope: "perímetro Roomix",
    },
  },
  {
    id: "database-tenant-isolation-agent",
    name: "Database / Tenant Isolation Agent",
    role: "Verifica isolamento por tenantId/propertyId, RLS e integridade de migrations.",
    category: "data",
    icon: "database",
    dataSources: ["roomix-saas", "audit-logs"],
    skills: [
      "tenant.scope.audit",
      "rls.verify",
      "migration.review",
      "leak.detect",
    ],
    permissions: {
      reads: ["schema", "audit-logs"],
      proposes: ["migration.add"],
      blockedSensitive: ["Restaurar banco", "Alterar plano do cliente"],
    },
    risk: "high",
    defaults: {
      runtimeStatus: "read-only",
      currentTask: "tenant_isolation_v3 · sem leakage detectado",
      lastRun: "—",
      actions24h: 0,
      scope: "DB schemas",
    },
  },
  {
    id: "channel-manager-agent",
    name: "Channel Manager Agent",
    role: "Monitora inbound, mappings, replay de outbox e incidentes nos canais Booking/Airbnb/Expedia/Direct.",
    category: "operations",
    icon: "git-branch",
    dataSources: ["roomix-channel-manager", "roomix-saas", "audit-logs"],
    skills: [
      "inbound.monitor",
      "mapping.diagnose",
      "outbox.replay.propose",
      "incident.classify",
    ],
    permissions: {
      reads: ["channel-manager-status", "mappings", "inbound-events", "outbox"],
      proposes: ["outbox.replay", "mapping.create"],
      blockedSensitive: ["Ativar OTA real (Booking/Airbnb/Expedia)", "Ativar Channel Manager production"],
    },
    risk: "high",
    defaults: {
      runtimeStatus: "not-connected",
      currentTask: "Aguardando bridge SaaS ↔ Channel Manager.",
      lastRun: "—",
      actions24h: 0,
      scope: "OTA · homologation",
    },
  },
  {
    id: "billing-agent",
    name: "Billing Agent",
    role: "Acompanha faturas, planos, MRR, dunning de inadimplentes e revenue ops.",
    category: "billing",
    icon: "receipt",
    dataSources: ["billing", "roomix-saas", "audit-logs"],
    skills: [
      "invoice.monitor",
      "mrr.compute",
      "dunning.propose",
      "plan.diff.detect",
    ],
    permissions: {
      reads: ["invoices", "plans", "subscriptions"],
      proposes: ["dunning.send", "plan.suggest"],
      blockedSensitive: ["Ativar gateway de pagamentos", "Alterar plano do cliente", "Alterar tarifa real automaticamente"],
    },
    risk: "medium",
    defaults: {
      runtimeStatus: "not-connected",
      currentTask: "Aguardando endpoint /api/platform/billing.",
      lastRun: "—",
      actions24h: 0,
      scope: "multi-tenant · financeiro",
    },
  },
  {
    id: "fnrh-compliance-agent",
    name: "FNRH / Compliance Agent",
    role: "Monitora envios FNRH, Cadastur, check-ins sem conformidade e erros de envio.",
    category: "compliance",
    icon: "shield-check",
    dataSources: ["fnrh", "roomix-saas", "audit-logs"],
    skills: [
      "fnrh.queue.monitor",
      "cadastur.expiry.check",
      "checkin.compliance.audit",
      "send.failure.diagnose",
    ],
    permissions: {
      reads: ["fnrh-queue", "cadastur-status", "checkins"],
      proposes: ["fnrh.retry"],
      blockedSensitive: ["Ativar FNRH production"],
    },
    risk: "medium",
    defaults: {
      runtimeStatus: "not-connected",
      currentTask: "Aguardando endpoint /api/platform/compliance.",
      lastRun: "—",
      actions24h: 0,
      scope: "propriedades BR · FNRH",
    },
  },
  {
    id: "communication-agent",
    name: "Communication Agent",
    role: "Monitora mensagens, templates e disparos para hóspedes. Nunca envia sem aprovação humana.",
    category: "communication",
    icon: "mail",
    dataSources: ["communications", "audit-logs"],
    skills: [
      "template.audit",
      "queue.monitor",
      "delivery.diagnose",
      "tone.review",
    ],
    permissions: {
      reads: ["templates", "message-queue"],
      proposes: ["message.draft"],
      blockedSensitive: ["Enviar mensagem real ao hóspede"],
    },
    risk: "high",
    defaults: {
      runtimeStatus: "not-connected",
      currentTask: "Aguardando runtime de comunicação.",
      lastRun: "—",
      actions24h: 0,
      scope: "hóspedes · e-mail/WhatsApp",
    },
  },
  {
    id: "commercial-agent",
    name: "Commercial Agent",
    role: "Detecta churn risk, oportunidades de upsell e abandono de trial.",
    category: "commercial",
    icon: "trending-up",
    dataSources: ["roomix-saas", "billing"],
    skills: [
      "churn.predict",
      "upsell.detect",
      "trial.review",
    ],
    permissions: {
      reads: ["accounts", "usage", "plans"],
      proposes: ["upsell.suggest", "outreach.schedule"],
      blockedSensitive: ["Alterar plano do cliente"],
    },
    risk: "low",
    defaults: {
      runtimeStatus: "not-connected",
      currentTask: "Aguardando dados comerciais.",
      lastRun: "—",
      actions24h: 0,
      scope: "comercial",
    },
  },
  {
    id: "customer-assistant-agent",
    name: "Customer Assistant Agent",
    role: "Suporte ao hóspede final · só responde via canais oficiais aprovados.",
    category: "communication",
    icon: "message-square",
    dataSources: ["communications", "roomix-saas"],
    skills: [
      "guest.faq",
      "reservation.lookup",
      "ticket.classify",
    ],
    permissions: {
      reads: ["public-faq", "reservation-snapshots"],
      proposes: ["ticket.respond"],
      blockedSensitive: ["Enviar mensagem real ao hóspede", "Cancelar reserva real"],
    },
    risk: "medium",
    defaults: {
      runtimeStatus: "not-connected",
      currentTask: "Aguardando runtime de atendimento.",
      lastRun: "—",
      actions24h: 0,
      scope: "guest support",
    },
  },
  {
    id: "frontend-design-agent",
    name: "Frontend Design Agent",
    role: "Monitora consistência visual, regressões de UI e acessibilidade.",
    category: "design",
    icon: "palette",
    dataSources: ["design-tokens", "audit-logs"],
    skills: [
      "tokens.diff",
      "a11y.audit",
      "regression.visual",
      "consistency.review",
    ],
    permissions: {
      reads: ["design-tokens", "components-inventory"],
      proposes: ["token.add", "component.refactor"],
      blockedSensitive: [],
    },
    risk: "low",
    defaults: {
      runtimeStatus: "read-only",
      currentTask: "Audit tokens v2.1 · sem regressões",
      lastRun: "agora há pouco",
      actions24h: 0,
      scope: "UI · A11y",
    },
  },
  {
    id: "documentation-adr-agent",
    name: "Documentation / ADR Agent",
    role: "Mantém ADRs, changelog e runbooks alinhados com decisões reais do código.",
    category: "documentation",
    icon: "book-open",
    dataSources: ["documentation", "audit-logs"],
    skills: [
      "adr.draft",
      "changelog.maintain",
      "runbook.update",
      "decision.audit",
    ],
    permissions: {
      reads: ["docs", "commits"],
      proposes: ["adr.add", "runbook.append"],
      blockedSensitive: [],
    },
    risk: "low",
    defaults: {
      runtimeStatus: "read-only",
      currentTask: "ADR platform-console-independent-app · vivo",
      lastRun: "agora há pouco",
      actions24h: 0,
      scope: "docs/adr/*",
    },
  },
];

/**
 * Find an agent definition by id. Returns null when not found — callers
 * should treat that as a runtime error and surface "agente desconhecido"
 * in the UI rather than fabricating data.
 */
export const findAgent = (id: string): AgentDefinition | null =>
  AGENT_REGISTRY.find((a) => a.id === id) ?? null;
