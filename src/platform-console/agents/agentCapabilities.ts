// Helpers for displaying agent capabilities consistently across the
// Agent Center and Agentes Roomix views.

import type {
  AgentDataSource,
  AgentDefinition,
  AgentRuntimeStatus,
} from "./agentRegistry";

/**
 * Runtime payload that the backend can return per agent. Every field is
 * optional — the UI uses the registry's defaults to fill the gaps.
 */
export interface AgentRuntime {
  id: string;
  status?: AgentRuntimeStatus;
  currentTask?: string;
  lastRun?: string;
  actions24h?: number;
  scope?: string;
  notes?: string;
}

export interface AgentView {
  definition: AgentDefinition;
  runtime: AgentRuntime;
  /**
   * Whether the runtime payload came from the real backend (true) or
   * from the registry's `defaults` block (false). Drives the "não
   * conectado" badge in the UI.
   */
  hasRuntime: boolean;
}

export const mergeAgent = (
  definition: AgentDefinition,
  runtime?: AgentRuntime,
): AgentView => {
  const hasRuntime = Boolean(runtime && runtime.status);
  const status = runtime?.status ?? definition.defaults.runtimeStatus;
  return {
    definition,
    runtime: {
      id: definition.id,
      status,
      currentTask: runtime?.currentTask ?? definition.defaults.currentTask,
      lastRun: runtime?.lastRun ?? definition.defaults.lastRun,
      actions24h: runtime?.actions24h ?? definition.defaults.actions24h,
      scope: runtime?.scope ?? definition.defaults.scope,
      notes: runtime?.notes,
    },
    hasRuntime,
  };
};

export const STATUS_LABEL: Record<AgentRuntimeStatus, { label: string; tone: "success" | "warning" | "danger" | "ghost" | "info" }> = {
  connected: { label: "ativo", tone: "success" },
  "read-only": { label: "modo leitura", tone: "info" },
  "not-connected": { label: "não conectado", tone: "ghost" },
  "config-required": { label: "configuração pendente", tone: "warning" },
};

export const DATA_SOURCE_LABEL: Record<AgentDataSource, string> = {
  "roomix-saas": "Roomix SaaS",
  "roomix-channel-manager": "Channel Manager",
  "audit-logs": "Audit logs",
  billing: "Billing",
  fnrh: "FNRH",
  overbookings: "Overbookings",
  communications: "Comunicação",
  "design-tokens": "Design tokens",
  documentation: "Docs",
};

export const categoryAccent = (category: AgentDefinition["category"]): string => {
  switch (category) {
    case "security":
    case "data":
      return "rgba(242,85,85,0.16)";
    case "operations":
      return "rgba(245,165,36,0.16)";
    case "billing":
    case "commercial":
      return "rgba(24,211,154,0.16)";
    case "compliance":
      return "rgba(79,139,245,0.16)";
    case "design":
    case "documentation":
      return "rgba(183,157,255,0.16)";
    case "orchestration":
    case "communication":
    default:
      return "rgba(255,255,255,0.06)";
  }
};
