// CommercialRequestsByAgent — small Panel that shows how many pending
// commercial requests belong to each Roomix agent category.
//
// Purpose: prepare the Agent Center to surface what each agent would
// need to triage if its runtime were connected. The mapping from
// `requestedModule` → agent category lives here as the single source
// of truth so we don't fan it out.
//
// Read-only: clicking a row navigates to the Solicitações view with
// the corresponding filter (today the view doesn't support deep-link
// filters yet, so we just open the view).
//
// No mock: the panel does its own fetch on mount and falls back to an
// honest empty state on error.

import React, { useEffect, useMemo, useState } from "react";
import { Badge, Icon, Panel } from "../components";
import {
  commercialRequestsApi,
  isPendingStatus,
  type CommercialRequest,
} from "../services/commercialRequestsApi";

export type AgentCategory =
  | "operations"
  | "billing"
  | "channel_manager"
  | "fnrh"
  | "agent_center"
  | "security";

const AGENT_LABEL: Record<AgentCategory, string> = {
  operations: "Operations Agent",
  billing: "Billing Agent",
  channel_manager: "Channel Manager Agent",
  fnrh: "FNRH / Compliance Agent",
  agent_center: "Agent Center",
  security: "Security Agent",
};

const AGENT_ICON: Record<AgentCategory, string> = {
  operations: "activity",
  billing: "receipt",
  channel_manager: "git-branch",
  fnrh: "shield-check",
  agent_center: "sparkles",
  security: "shield",
};

// Module → agent mapping. Anything we can't classify falls into
// "operations" as a safe default.
function categoryForModule(module: string): AgentCategory {
  const m = module.toLowerCase();
  if (m.includes("payment") || m === "upgrade" || m.includes("plan") || m.includes("billing")) return "billing";
  if (m.includes("channel")) return "channel_manager";
  if (m.includes("fnrh") || m.includes("compliance")) return "fnrh";
  if (m.includes("agent")) return "agent_center";
  if (m.includes("security") || m.includes("audit")) return "security";
  return "operations";
}

interface BreakdownEntry {
  category: AgentCategory;
  pending: number;
  total: number;
}

export function CommercialRequestsByAgent({
  onOpenView,
}: {
  onOpenView?: () => void;
}) {
  const [rows, setRows] = useState<CommercialRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    commercialRequestsApi
      .list(200)
      .then((list) => {
        if (cancelled) return;
        setRows(list);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const breakdown = useMemo<BreakdownEntry[]>(() => {
    const map = new Map<AgentCategory, { pending: number; total: number }>();
    for (const c of Object.keys(AGENT_LABEL) as AgentCategory[]) {
      map.set(c, { pending: 0, total: 0 });
    }
    for (const r of rows ?? []) {
      const cat = categoryForModule(r.requestedModule);
      const slot = map.get(cat)!;
      slot.total += 1;
      if (isPendingStatus(r.status)) slot.pending += 1;
    }
    return Array.from(map.entries()).map(([category, v]) => ({ category, ...v }));
  }, [rows]);

  const totalPending = breakdown.reduce((s, b) => s + b.pending, 0);

  return (
    <Panel
      title="Solicitações por categoria de agente"
      icon="message-square"
      sub={
        loading
          ? "carregando…"
          : error
            ? `falha: ${error}`
            : `${totalPending} pendente(s) aguardando análise humana`
      }
      action={
        onOpenView && (
          <button className="btn ghost" type="button" onClick={onOpenView} style={{ fontSize: 11 }}>
            <Icon name="external-link" size={11} /> Abrir Solicitações
          </button>
        )
      }
      dense
    >
      {loading ? (
        <div className="muted" style={{ textAlign: "center", padding: 16, fontSize: 12 }}>
          Consultando backend…
        </div>
      ) : error ? (
        <div className="notice danger" style={{ marginBottom: 0 }}>
          <Icon name="x-circle" size={14} />
          <span>
            Falha ao carregar: <span className="mono">{error}</span>
          </span>
        </div>
      ) : (
        <div className="notice info" style={{ marginBottom: 10 }}>
          <Icon name="info" size={14} />
          <span>
            Runtime de agentes <strong>não está conectado</strong>. Esta tabela só prepara o que cada agente
            <em> precisaria ler</em> se o runtime existisse. Aprovação continua sendo manual e via{" "}
            <span className="mono">/api/platform/commercial-requests</span>.
          </span>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
        {breakdown.map((b) => (
          <div
            key={b.category}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div className="row" style={{ alignItems: "center", gap: 6 }}>
                <Icon name={AGENT_ICON[b.category]} size={13} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-hi)" }}>
                  {AGENT_LABEL[b.category]}
                </span>
              </div>
              {b.pending > 0 && (
                <Badge tone="warning" dot>
                  {b.pending}
                </Badge>
              )}
            </div>
            <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: b.pending > 0 ? "var(--warning)" : "var(--text-hi)",
                  lineHeight: 1,
                }}
              >
                {b.pending}
              </span>
              <span className="muted" style={{ fontSize: 11 }}>
                pendente(s) · {b.total} total
              </span>
            </div>
            <span className="muted" style={{ fontSize: 10.5 }}>
              {b.pending > 0 ? "aguardando análise humana" : "sem solicitações pendentes"}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
