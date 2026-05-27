// Agent Center — operational overview of every agent in the Roomix registry.
//
// Reads the static registry merged with optional runtime data from the
// SaaS endpoint /api/platform/agents/status. Different from the
// "Agentes Roomix" detail view: here we focus on global posture —
// counts, status spread, per-agent quick actions (Detalhes, Pausar /
// Retomar), and the commercial-requests-by-agent breakdown.
//
// All header actions are REAL:
//   • Atualizar    → useAgents().refresh() + toast feedback
//   • Pausar todas → ConfirmActionModal → batch PATCH per agent
//   • Reativar suspensos → ConfirmActionModal → batch PATCH per agent
//
// Per-agent "Detalhes" opens the existing AgentConfigModal (same modal
// used in the dedicated Agentes Roomix view). No fake-success: any
// PATCH failure surfaces as a toast and counts are honest.

import React, { useCallback, useMemo, useState } from "react";
import { Badge, Icon, Metric, Panel, RiskPill, SectionHeader } from "../components";
import { useAgents } from "../agents/useAgents";
import {
  DATA_SOURCE_LABEL,
  STATUS_LABEL,
  categoryAccent,
  type AgentView,
} from "../agents/agentCapabilities";
import { CommercialRequestsByAgent } from "../components/CommercialRequestsByAgent";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { AgentConfigModal } from "../components/AgentConfigModal";
import { useToast } from "../components/Toast";
import { agentsApi } from "../services/agentsApi";
import type { AgentDefinition } from "../agents/agentRegistry";

interface ViewAgentCenterProps {
  onOpenCommercialRequests?: () => void;
}

type BatchKind = "pause-all" | "resume-suspended";

export function ViewAgentCenter({ onOpenCommercialRequests }: ViewAgentCenterProps = {}) {
  const { agents, source, loading, refresh } = useAgents();
  const toast = useToast();
  const [batch, setBatch] = useState<BatchKind | null>(null);
  const [detailFor, setDetailFor] = useState<AgentDefinition | null>(null);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(
    () => ({
      total: agents.length,
      connected: agents.filter((a) => a.runtime.status === "connected" || a.runtime.status === "read-only").length,
      notConnected: agents.filter((a) => a.runtime.status === "not-connected").length,
      configRequired: agents.filter((a) => a.runtime.status === "config-required").length,
    }),
    [agents],
  );

  // "Active" = anything not explicitly paused/not-connected; "Suspended" =
  // anything currently paused. The agent runtime store maps
  // status="paused" to runtime.status="not-connected" in the GET
  // response, but we keep the local notion of pause separate so the
  // batch buttons describe the operation honestly.
  const activeIds = useMemo(
    () => agents.filter((a) => a.runtime.status === "connected" || a.runtime.status === "read-only").map((a) => a.definition.id),
    [agents],
  );
  const suspendedIds = useMemo(
    () => agents.filter((a) => a.runtime.status === "not-connected" || a.runtime.status === "config-required").map((a) => a.definition.id),
    [agents],
  );

  // Atualizar — re-fetch with a toast so the operator always sees a
  // reaction. When the runtime endpoint hasn't been wired yet, the
  // toast is honest about it ("registry · runtime não conectado").
  const handleRefresh = useCallback(() => {
    refresh();
    // The hook fires async; we don't await here because useAgents
    // doesn't expose a Promise. The toast is informative regardless.
    toast.show(
      source === "backend"
        ? "Agent Center atualizado · runtime conectado"
        : "Agent Center atualizado · runtime ainda não conectado (registry + APIs do Console)",
      source === "backend" ? "brand" : "info",
    );
  }, [refresh, source, toast]);

  // Pausar todas / Reativar suspensos — Option B from the spec:
  // iterate PATCH /api/platform/agents/:id/status. We catch per-id
  // failures, count successes, and surface a single summarized toast.
  const handleBatch = useCallback(
    async (kind: BatchKind) => {
      const targetIds = kind === "pause-all" ? activeIds : suspendedIds;
      const desired: "active" | "paused" = kind === "pause-all" ? "paused" : "active";
      if (targetIds.length === 0) {
        toast.show(
          kind === "pause-all" ? "Nenhum agente ativo para pausar" : "Nenhum agente suspenso para reativar",
          "info",
        );
        return;
      }
      setBusy(true);
      let ok = 0;
      let fail = 0;
      // Sequential to be friendly to the backend and to keep audit
      // logs ordered. Total volume is small (<= ~20 agents).
      for (const id of targetIds) {
        try {
          await agentsApi.updateStatus(id, desired);
          ok += 1;
        } catch (err) {
          fail += 1;
          // eslint-disable-next-line no-console
          console.warn(`[platform-console] batch ${kind} failed for ${id}:`, err instanceof Error ? err.message : err);
        }
      }
      setBusy(false);
      refresh();
      if (fail === 0) {
        toast.show(
          kind === "pause-all"
            ? `${ok} agente(s) pausado(s) · sem ações sensíveis disparadas`
            : `${ok} agente(s) retomado(s) em modo leitura`,
          kind === "pause-all" ? "warn" : "brand",
        );
      } else {
        toast.show(`Concluído com falhas · ${ok} ok / ${fail} falharam`, fail > ok ? "danger" : "warn");
      }
    },
    [activeIds, suspendedIds, refresh, toast],
  );

  return (
    <div className="stack-y">
      <SectionHeader
        title="Agent Center"
        sub={`${counts.total} agentes Roomix · ${counts.connected} em leitura · ${counts.notConnected} aguardando runtime`}
        action={
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" type="button" onClick={handleRefresh} disabled={loading || busy}>
              <Icon name="refresh-cw" size={12} /> Atualizar
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => setBatch("pause-all")}
              disabled={loading || busy || activeIds.length === 0}
              title={
                activeIds.length === 0
                  ? "Nenhum agente em estado ativo no momento"
                  : `Pausar ${activeIds.length} agente(s) ativo(s) · não toca em OTA/CM/gateway`
              }
            >
              <Icon name="pause" size={12} /> Pausar todas ({activeIds.length})
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => setBatch("resume-suspended")}
              disabled={loading || busy || suspendedIds.length === 0}
              title={
                suspendedIds.length === 0
                  ? "Nenhum agente suspenso/aguardando runtime"
                  : `Reativar ${suspendedIds.length} agente(s) suspenso(s) em modo leitura`
              }
            >
              <Icon name="play" size={12} /> Reativar suspensos ({suspendedIds.length})
            </button>
          </div>
        }
      />

      {source === "registry" && (
        <div className="notice info">
          <Icon name="lock" size={14} />
          <span>
            <strong className="hi">Runtime de agentes em modo leitura.</strong> Estes cards mostram a estrutura (skills,
            fontes de dados, permissões) do registry oficial. Cada card está marcado como "não conectado" enquanto a
            tabela <span className="mono">agent_runtime</span> persistente não estiver plugada — nenhum agente executa
            ação automática agora.
          </span>
        </div>
      )}

      <div className="grid-metrics">
        <Metric label="Agentes no registry" value={String(counts.total)} icon="sparkles" accent="brand" />
        <Metric label="Em leitura" value={String(counts.connected)} icon="activity" />
        <Metric
          label="Aguardando runtime"
          value={String(counts.notConnected)}
          icon="pause-circle"
          accent={counts.notConnected > 0 ? "warning" : undefined}
        />
        <Metric
          label="Config pendente"
          value={String(counts.configRequired)}
          icon="settings"
          accent={counts.configRequired > 0 ? "warning" : undefined}
        />
        <Metric
          label="Fonte"
          value={source === "backend" ? "API" : "registry"}
          icon="git-branch"
          ctx={source === "backend" ? "live" : "fallback"}
        />
      </div>

      <Panel title="Agentes" icon="sparkles" sub="estrutura, skills, fontes de dados e ações rápidas">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
          {agents.map((a) => (
            <AgentCard
              key={a.definition.id}
              agent={a}
              onDetails={() => setDetailFor(a.definition)}
            />
          ))}
        </div>
      </Panel>

      <CommercialRequestsByAgent onOpenView={onOpenCommercialRequests} />

      <ConfirmActionModal
        open={batch === "pause-all"}
        onClose={() => setBatch(null)}
        title="Pausar todas as políticas"
        sub={`${activeIds.length} agente(s) ativo(s) · estado vira "paused" no runtime`}
        icon="pause"
        severity="warn"
        confirmLabel="Pausar todas"
        requireJustification
        justificationPlaceholder="Motivo (ex.: incidente em apuração, manutenção, troca de turno)"
        details={[
          "Itera PATCH /api/platform/agents/:id/status com status=paused para cada agente ativo.",
          "Não chama OTA, gateway, Channel Manager production nem FNRH production.",
          "Cada agente pausado registra audit log individual (platform_agents_status_update).",
          "Para retomar, use Reativar suspensos ou Pausar/Retomar individual em Agentes Roomix.",
        ]}
        onConfirm={async () => {
          await handleBatch("pause-all");
        }}
      />

      <ConfirmActionModal
        open={batch === "resume-suspended"}
        onClose={() => setBatch(null)}
        title="Reativar agentes suspensos"
        sub={`${suspendedIds.length} agente(s) em pausa serão retomados em modo leitura`}
        icon="play"
        severity="brand"
        confirmLabel="Reativar suspensos"
        details={[
          "Itera PATCH /api/platform/agents/:id/status com status=active para cada agente pausado/aguardando.",
          "Agentes voltam ao modo leitura — sem disparar ações sensíveis automaticamente.",
          "Audit log: platform_agents_status_update para cada um.",
        ]}
        onConfirm={async () => {
          await handleBatch("resume-suspended");
        }}
      />

      <AgentConfigModal
        open={detailFor !== null}
        onClose={() => setDetailFor(null)}
        definition={detailFor}
        onMutated={refresh}
      />
    </div>
  );
}

function AgentCard({ agent, onDetails }: { agent: AgentView; onDetails: () => void }) {
  const statusInfo = STATUS_LABEL[agent.runtime.status ?? "not-connected"];
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: categoryAccent(agent.definition.category),
              border: "1px solid var(--line)",
              display: "grid",
              placeItems: "center",
              color: "var(--text-hi)",
              flexShrink: 0,
            }}
          >
            <Icon name={agent.definition.icon} size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-hi)",
                letterSpacing: "-0.005em",
                lineHeight: 1.3,
              }}
            >
              {agent.definition.name}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-mute)",
                marginTop: 3,
                lineHeight: 1.45,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {agent.definition.role}
            </div>
          </div>
        </div>
        <Badge tone={statusInfo.tone} dot pulse={agent.runtime.status === "connected"}>
          {statusInfo.label}
        </Badge>
      </div>

      {/* Tarefa atual */}
      <div
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--line-faint)",
          borderRadius: 8,
          padding: "8px 10px",
          fontSize: 11.5,
          color: "var(--text)",
          lineHeight: 1.45,
          minHeight: 44,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: "var(--text-mute)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 3,
          }}
        >
          Tarefa atual
        </div>
        {agent.runtime.currentTask}
      </div>

      {/* Fontes + Skills */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-mute)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 5,
            }}
          >
            Fontes ({agent.definition.dataSources.length})
          </div>
          <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
            {agent.definition.dataSources.map((src) => (
              <Badge key={src} tone="neutral">
                {DATA_SOURCE_LABEL[src]}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-mute)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 5,
            }}
          >
            Skills ({agent.definition.skills.length})
          </div>
          <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
            {agent.definition.skills.slice(0, 4).map((s) => (
              <Badge key={s} tone="ghost">
                {s}
              </Badge>
            ))}
            {agent.definition.skills.length > 4 && (
              <span className="muted text-xs" style={{ alignSelf: "center" }}>
                +{agent.definition.skills.length - 4}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid var(--line-faint)",
          paddingTop: 10,
          gap: 10,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11, minWidth: 0 }}>
          <span className="mono dim" style={{ fontSize: 10.5 }}>
            Última execução: {agent.runtime.lastRun || "—"}
          </span>
          <span className="muted" style={{ fontSize: 10.5 }}>
            {agent.runtime.actions24h ?? 0} ações em 24h
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RiskPill risk={agent.definition.risk} />
          <button
            className="btn sm ghost"
            type="button"
            onClick={onDetails}
            title="Abrir configuração detalhada deste agente"
          >
            <Icon name="settings" size={11} /> Detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
