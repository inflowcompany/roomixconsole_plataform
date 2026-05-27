// Agentes Roomix — restauração 1:1 do layout original do Cloud Design
// (referência: _extracted_handoff/.../view-agents-logs.jsx → ViewAgents).
//
// O layout NÃO foi reinventado:
//   1. SectionHeader "Agentes Roomix" · sub fixo.
//   2. Painel "Aprovações humanas pendentes" com grid de approval-cards.
//   3. Grid 260px | 1fr:
//        • esquerda: Painel "Agentes" com lista selecionável (1 ícone + nome + ações + dot).
//        • direita: stack de painéis:
//             a. Detalhe do agente (Pausar/Config) + 4 MiniStats + Tarefa atual.
//             b. Skills ativas | Permissões (2 colunas).
//             c. Últimas decisões (table).
//             d. Ações sensíveis · exigem aprovação humana (badges + notice).
//
// A lógica nova permanece intacta:
//   • Lista de agentes vem do registry (`useAgents`), com 13 agentes
//     declarados em `agentRegistry.ts`.
//   • Aprovações vêm do payload do aggregator (`useConsoleData`) —
//     fallback `demoOverview.approvals` quando o backend não retorna.
//   • Permissões são derivadas do registry: reads → "permitido",
//     proposes → "requer aprovação", blockedSensitive → "negado".
//   • Skills, fontes de dados, ações sensíveis e risco vêm direto do
//     registry — UI somente renderiza o que está declarado.
//
// Os botões "Aprovar" / "Pausar" / "Config" são puramente visuais
// nesta sprint: nenhum executa ação real (todas as mutações sensíveis
// continuam bloqueadas por design).

import React, { useCallback, useEffect, useState } from "react";
import { Badge, Icon, Panel, RiskPill, SectionHeader, SevBadge } from "../components";
import { useAgents } from "../agents/useAgents";
import { STATUS_LABEL } from "../agents/agentCapabilities";
import { useConsoleData } from "../hooks/useConsoleData";
import { useToast } from "../components/Toast";
import { AgentConfigModal } from "../components/AgentConfigModal";
import { agentsApi } from "../services/agentsApi";
import type { ApprovalRequest } from "../types";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info"> = {
  connected: "success",
  "read-only": "info",
  "not-connected": "warning",
  "config-required": "warning",
};

const STATUS_LITERAL: Record<string, string> = {
  connected: "Ativo",
  "read-only": "Em leitura",
  "not-connected": "Não conectado",
  "config-required": "Config pendente",
};

export function ViewAgents() {
  const { agents, source, refresh, loading } = useAgents();
  const { data } = useConsoleData();
  const toast = useToast();
  const [configOpen, setConfigOpen] = useState(false);
  const [busyToggle, setBusyToggle] = useState(false);

  const [selected, setSelected] = useState<string>(agents[0]?.definition.id ?? "");

  useEffect(() => {
    if (agents.length === 0) return;
    if (!agents.find((a) => a.definition.id === selected)) {
      setSelected(agents[0].definition.id);
    }
  }, [agents, selected]);

  const current = agents.find((a) => a.definition.id === selected) ?? agents[0];
  const approvals: ApprovalRequest[] = data.approvals ?? [];

  // Atualizar — re-fetch real do endpoint /api/platform/agents/status
  // com toast honesto se o runtime ainda não está conectado.
  const handleRefresh = useCallback(() => {
    refresh();
    toast.show(
      source === "backend"
        ? "Status dos agentes atualizado"
        : "Runtime ainda não conectado · usando registry como referência",
      source === "backend" ? "brand" : "info",
    );
  }, [refresh, source, toast]);

  // Pausar / Retomar — usa o PATCH real. Quando o runtime ainda não
  // tem o agente registrado, o backend cria o registro on-the-fly e
  // grava audit log; o próximo refresh já mostra o novo status.
  const handleTogglePause = useCallback(async () => {
    if (!current) return;
    const isPaused = current.runtime.status === "not-connected" || current.runtime.status === "config-required";
    const next = isPaused ? "active" : "paused";
    setBusyToggle(true);
    try {
      await agentsApi.updateStatus(current.definition.id, next);
      toast.show(
        next === "paused"
          ? `${current.definition.name} pausado · não executará run-checks`
          : `${current.definition.name} retomado · runtime em modo leitura`,
        next === "paused" ? "warn" : "brand",
      );
      refresh();
    } catch (err) {
      const code = err instanceof Error ? err.message : "FAILED";
      toast.show(`Falha ao atualizar status: ${code}`, "danger");
    } finally {
      setBusyToggle(false);
    }
  }, [current, refresh, toast]);

  // Derived rows for the "Permissões" panel — read straight from the
  // registry so the UI cannot drift away from the contract.
  const permissionRows = current
    ? [
        ...current.definition.permissions.reads.map((label) => ({ label, kind: "allowed" as const })),
        ...current.definition.permissions.proposes.map((label) => ({ label, kind: "gated" as const })),
        ...current.definition.permissions.blockedSensitive.map((label) => ({ label, kind: "denied" as const })),
      ]
    : [];

  // "Últimas decisões": honest empty-state for now. We render a single
  // row reflecting the registry default + a note that real history
  // comes from audit_logs once runtime is wired.
  const decisions = current
    ? [
        {
          t: current.runtime.lastRun || "—",
          action: current.runtime.currentTask,
          risk: current.definition.risk,
          outcome: source === "backend" ? "pending" : "awaiting_runtime",
        },
      ]
    : [];

  return (
    <div className="stack-y">
      <SectionHeader
        title="Agentes Roomix"
        sub="Skills, permissões, decisões recentes e aprovações humanas"
        action={
          <button className="btn ghost sm" type="button" onClick={handleRefresh} disabled={loading}>
            <Icon name="refresh-cw" size={11} /> Atualizar
          </button>
        }
      />

      {/* APROVAÇÕES HUMANAS PENDENTES (restored from Cloud Design) */}
      <Panel title="Aprovações humanas pendentes" icon="hand" sub={`${approvals.length} aguardando`}>
        {approvals.length === 0 ? (
          <div className="muted text-xs" style={{ padding: "12px 0" }}>
            Nenhuma aprovação pendente no momento.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {approvals.map((ap) => (
              <div key={ap.id} className={`approval-card ${ap.sev === "crit" ? "crit" : ""}`}>
                <div className="row-between">
                  <div className="row" style={{ gap: 8 }}>
                    <Icon
                      name={ap.sev === "crit" ? "alert-octagon" : "alert-triangle"}
                      size={14}
                      color={ap.sev === "crit" ? "var(--danger)" : "var(--warning)"}
                    />
                    <SevBadge sev={ap.sev} />
                  </div>
                  <span className="mono muted text-xs">{ap.requestedAt}</span>
                </div>
                <div className="hi" style={{ fontSize: 13, fontWeight: 500 }}>
                  {ap.title}
                </div>
                <div className="text-xs dim" style={{ lineHeight: 1.45 }}>
                  {ap.desc}
                </div>
                <div className="text-xs muted" style={{ borderTop: "1px solid var(--line-faint)", paddingTop: 6 }}>
                  <div>
                    <span className="muted">Solicitado por:</span>{" "}
                    <span className="mono hi">{ap.requested}</span>
                  </div>
                  <div style={{ marginTop: 2 }}>
                    <span className="muted">Impacto:</span> {ap.impact}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {/* Buttons are visual-only this sprint — every sensitive
                      action requires a human approval flow which is not
                      wired yet. Clicking does nothing on purpose. */}
                  <button
                    className="btn primary grow"
                    type="button"
                    style={{ justifyContent: "center" }}
                    title="Aprovação humana real ainda não habilitada"
                  >
                    <Icon name="check" size={12} /> Aprovar
                  </button>
                  <button className="btn ghost" type="button" style={{ justifyContent: "center" }} title="Rejeitar (em breve)">
                    <Icon name="x" size={12} />
                  </button>
                  <button className="btn ghost" type="button" style={{ justifyContent: "center" }} title="Comentar (em breve)">
                    <Icon name="message-square" size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Lista de Agentes + Detalhe */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 14, alignItems: "start" }}>
        <Panel title="Agentes" icon="cpu" dense>
          <div>
            {agents.map((a) => {
              const isActive = selected === a.definition.id;
              const status = a.runtime.status ?? "not-connected";
              const dotClass =
                status === "connected" ? "ok" : status === "config-required" ? "warn" : status === "not-connected" ? "dim" : "ok";
              return (
                <div
                  key={a.definition.id}
                  className="row"
                  style={{
                    gap: 10,
                    padding: "8px 14px",
                    cursor: "pointer",
                    background: isActive ? "rgba(24,211,154,0.06)" : "transparent",
                    borderLeft: isActive ? "2px solid var(--brand)" : "2px solid transparent",
                  }}
                  onClick={() => setSelected(a.definition.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(a.definition.id);
                    }
                  }}
                >
                  <div className="agent-icon" style={{ width: 24, height: 24 }}>
                    <Icon name={a.definition.icon} size={12} />
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="text-sm hi" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {a.definition.name}
                    </div>
                    <div className="text-xs muted">{a.runtime.actions24h ?? 0} ações</div>
                  </div>
                  <span className={`health-dot ${dotClass}`} />
                </div>
              );
            })}
          </div>
        </Panel>

        {current && (
          <div className="stack-y">
            {/* Cabeçalho do agente + 4 MiniStats + Tarefa atual */}
            <Panel
              title={current.definition.name}
              icon={current.definition.icon}
              sub={current.definition.role}
              action={
                <div className="row" style={{ gap: 6 }}>
                  <button
                    className="btn sm ghost"
                    type="button"
                    onClick={handleTogglePause}
                    disabled={busyToggle}
                    title={
                      current.runtime.status === "not-connected" || current.runtime.status === "config-required"
                        ? "Retomar runtime (modo leitura)"
                        : "Pausar — agente para de aceitar run-checks"
                    }
                  >
                    <Icon
                      name={
                        current.runtime.status === "not-connected" || current.runtime.status === "config-required"
                          ? "play"
                          : "pause"
                      }
                      size={11}
                    />{" "}
                    {current.runtime.status === "not-connected" || current.runtime.status === "config-required"
                      ? "Retomar"
                      : "Pausar"}
                  </button>
                  <button
                    className="btn sm"
                    type="button"
                    onClick={() => setConfigOpen(true)}
                    title="Abrir configuração detalhada do agente"
                  >
                    <Icon name="settings" size={11} /> Config
                  </button>
                </div>
              }
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
                <MiniStat
                  label="Status"
                  value={STATUS_LITERAL[current.runtime.status ?? "not-connected"]}
                  tone={STATUS_TONE[current.runtime.status ?? "not-connected"]}
                />
                <MiniStat label="Ações 24h" value={String(current.runtime.actions24h ?? 0)} />
                <MiniStat label="Última execução" value={current.runtime.lastRun ?? "—"} />
                <MiniStat
                  label="Risco automação"
                  value={current.definition.risk}
                  tone={current.definition.risk === "high" ? "danger" : current.definition.risk === "medium" ? "warning" : "success"}
                />
              </div>

              <div className="text-xs muted" style={{ textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                Tarefa atual
              </div>
              <div className="notice info">
                <Icon name="zap" size={14} />
                <span>{current.runtime.currentTask}</span>
              </div>
            </Panel>

            {/* Skills + Permissões lado a lado */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Panel title="Skills ativas" icon="puzzle">
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  {current.definition.skills.map((s) => (
                    <Badge key={s} tone="neutral">
                      {s}
                    </Badge>
                  ))}
                </div>
              </Panel>

              <Panel title="Permissões" icon="key">
                <div className="col" style={{ gap: 5 }}>
                  {permissionRows.length === 0 && <span className="muted text-xs">Nenhuma permissão declarada.</span>}
                  {permissionRows.map((row) => (
                    <PermRow
                      key={`${row.kind}-${row.label}`}
                      label={row.label}
                      allowed={row.kind === "allowed"}
                      gated={row.kind === "gated"}
                      denied={row.kind === "denied"}
                    />
                  ))}
                </div>
              </Panel>
            </div>

            {/* Últimas decisões */}
            <Panel
              title="Últimas decisões"
              icon="history"
              sub={source === "backend" ? "fonte: API" : "registry · runtime não conectado"}
              dense
            >
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Decisão</th>
                    <th>Risco</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.map((d, i) => (
                    <tr key={i}>
                      <td className="mono dim">{d.t}</td>
                      <td>{d.action}</td>
                      <td>
                        <RiskPill risk={d.risk} />
                      </td>
                      <td>
                        {d.outcome === "ok" && <Badge tone="success" dot>ok</Badge>}
                        {d.outcome === "pending" && <Badge tone="info" dot>em execução</Badge>}
                        {d.outcome === "awaiting_human" && <Badge tone="warning" dot pulse>aguarda humano</Badge>}
                        {d.outcome === "escalated" && <Badge tone="danger" dot>escalado</Badge>}
                        {d.outcome === "awaiting_runtime" && <Badge tone="ghost" dot>runtime não conectado</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {source !== "backend" && (
                <div className="notice info" style={{ marginTop: 12 }}>
                  <Icon name="lock" size={14} />
                  <span>
                    Histórico completo aparece quando o runtime de agentes for conectado · auditoria fica em{" "}
                    <span className="mono">audit_logs</span> no SaaS.
                  </span>
                </div>
              )}
            </Panel>

            {/* Ações sensíveis · exigem aprovação humana */}
            <Panel title="Ações sensíveis · exigem aprovação humana" icon="shield-alert">
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {current.definition.permissions.blockedSensitive.length === 0 ? (
                  <span className="muted text-xs">Este agente não tem ações sensíveis bloqueadas por design.</span>
                ) : (
                  current.definition.permissions.blockedSensitive.map((s) => (
                    <Badge key={s} tone="warning">
                      {s}
                    </Badge>
                  ))
                )}
              </div>
              <div className="notice warn" style={{ marginTop: 12 }}>
                <Icon name="lock" size={14} />
                <span>
                  Toda execução é registrada em logs de auditoria com hash do payload, decisão e identidade do superadmin que aprovou.
                </span>
              </div>
            </Panel>
          </div>
        )}
      </div>

      <AgentConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        definition={current?.definition ?? null}
        onMutated={refresh}
      />
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "danger" | "info";
}) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px" }}>
      <div className="text-xs muted" style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10 }}>
        {label}
      </div>
      <div
        className="hi"
        style={{
          fontSize: 14,
          marginTop: 4,
          fontWeight: 500,
          color:
            tone === "success"
              ? "var(--brand)"
              : tone === "warning"
                ? "var(--warning)"
                : tone === "danger"
                  ? "var(--danger)"
                  : tone === "info"
                    ? "var(--info)"
                    : "var(--text-hi)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PermRow({
  label,
  allowed,
  gated,
  denied,
}: {
  label: string;
  allowed?: boolean;
  gated?: boolean;
  denied?: boolean;
}) {
  return (
    <div className="row-between text-xs" style={{ padding: "4px 0" }}>
      <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>
        {label}
      </span>
      {allowed && <Badge tone="success">permitido</Badge>}
      {gated && <Badge tone="warning">requer aprovação</Badge>}
      {denied && <Badge tone="danger">negado</Badge>}
    </div>
  );
}
