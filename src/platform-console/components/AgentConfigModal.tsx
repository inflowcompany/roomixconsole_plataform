// AgentConfigModal — read-mostly inspector for a single Roomix agent.
//
// Shows the operator everything they need to decide whether to keep the
// agent running, pause it, or trigger a defensive context-only check:
//   • Identification (name, role, category, risk).
//   • Skills (from registry).
//   • Data sources the agent can read (Roomix SaaS / Channel Manager /
//     audit logs / billing / FNRH / …).
//   • Permissions split into reads / proposes / blocked-sensitive.
//   • LLM provider config — comes from the backend, NEVER includes
//     the key. Shows `configured` / `enabled` flags + provider/model.
//   • Runtime status (active / paused) + a "run check" CTA.
//
// Mutations:
//   • Status toggle  → PATCH /api/platform/agents/:id/status
//   • Run check      → POST  /api/platform/agents/:id/run-check
//
// All mutations are audit-logged on the server. The modal never
// renders an LLM key, never accepts one as input, and never holds
// state that could leak a secret.

import React, { useCallback, useEffect, useState } from "react";
import { Badge, Icon } from "../components";
import { Modal } from "./Modal";
import { useToast } from "./Toast";
import {
  agentsApi,
  type AgentConfigResponse,
  type AgentRunCheckResult,
} from "../services/agentsApi";
import type { AgentDefinition } from "../agents/agentRegistry";

interface AgentConfigModalProps {
  open: boolean;
  onClose: () => void;
  definition: AgentDefinition | null;
  /** Fires after a successful status mutation so the parent re-fetches. */
  onMutated?: () => void;
}

export function AgentConfigModal({ open, onClose, definition, onMutated }: AgentConfigModalProps) {
  const [config, setConfig] = useState<AgentConfigResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"pause" | "resume" | "run" | null>(null);
  const [lastRun, setLastRun] = useState<AgentRunCheckResult | null>(null);
  const toast = useToast();

  const fetchConfig = useCallback(async () => {
    if (!definition) return;
    setLoading(true);
    setError(null);
    try {
      const next = await agentsApi.fetchConfig(definition.id);
      setConfig(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED");
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [definition]);

  useEffect(() => {
    if (open && definition) {
      void fetchConfig();
      setLastRun(null);
    }
  }, [open, definition, fetchConfig]);

  const handleToggleStatus = useCallback(async () => {
    if (!definition || !config) return;
    const next = config.runtime.status === "active" ? "paused" : "active";
    setBusyAction(next === "paused" ? "pause" : "resume");
    try {
      await agentsApi.updateStatus(definition.id, next);
      toast.show(
        next === "paused"
          ? `Agente ${definition.name} pausado · sem execuções até retomar`
          : `Agente ${definition.name} retomado`,
        next === "paused" ? "warn" : "brand",
      );
      await fetchConfig();
      onMutated?.();
    } catch (err) {
      const code = err instanceof Error ? err.message : "FAILED";
      toast.show(`Falha ao atualizar status: ${code}`, "danger");
    } finally {
      setBusyAction(null);
    }
  }, [definition, config, fetchConfig, onMutated, toast]);

  const handleRunCheck = useCallback(async () => {
    if (!definition) return;
    setBusyAction("run");
    setLastRun(null);
    try {
      const result = await agentsApi.runCheck(definition.id);
      setLastRun(result);
      const modeLabel =
        result.result.mode === "no-llm"
          ? "modo contexto-only"
          : result.result.mode === "llm-ready-not-called"
            ? "LLM pronto · sem chamada upstream"
            : "LLM chamado";
      toast.show(`Run-check concluído · ${modeLabel}`, "info");
      onMutated?.();
    } catch (err) {
      const code = err instanceof Error ? err.message : "FAILED";
      if (code === "AGENT_PAUSED") {
        toast.show("Run-check ignorado — agente está pausado", "warn");
      } else {
        toast.show(`Falha no run-check: ${code}`, "danger");
      }
    } finally {
      setBusyAction(null);
    }
  }, [definition, onMutated, toast]);

  if (!open || !definition) {
    return (
      <Modal open={false} onClose={onClose} title="">
        <div />
      </Modal>
    );
  }

  const skills = definition.skills;
  const reads = definition.permissions.reads;
  const proposes = definition.permissions.proposes;
  const blocked = definition.permissions.blockedSensitive;

  return (
    <Modal
      open
      onClose={onClose}
      icon={definition.icon}
      title={definition.name}
      sub={definition.role}
      width="xl"
      headerActions={
        <button className="btn ghost" type="button" onClick={fetchConfig} disabled={loading}>
          <Icon name="refresh-cw" size={12} /> Recarregar
        </button>
      }
    >
      {error && (
        <div className="notice danger" style={{ marginBottom: 14 }}>
          <Icon name="x-circle" size={14} />
          <span>
            Falha ao carregar config do agente: <span className="mono">{error}</span>.
          </span>
        </div>
      )}

      {/* Identificação */}
      <div className="pc-section-head" style={{ marginTop: 0, paddingTop: 0 }}>
        <span className="pc-section-num">01</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Identificação</span>
          <span className="pc-section-sub">Categoria, risco e papel deste agente</span>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "10px 16px",
          marginBottom: 6,
          fontSize: 12,
        }}
      >
        <ItemLabel label="Nome" value={definition.name} strong />
        <ItemLabel label="Categoria" value={definition.category} mono />
        <ItemLabel label="Risco automação" value={definition.risk} mono />
        <ItemLabel
          label="Runtime"
          value={
            <Badge
              tone={
                config?.runtime.status === "paused"
                  ? "warning"
                  : config
                    ? "success"
                    : "ghost"
              }
              dot
            >
              {config?.runtime.status === "paused"
                ? "Pausado"
                : config
                  ? "Ativo · leitura"
                  : "Carregando…"}
            </Badge>
          }
        />
      </div>

      {/* Skills */}
      <div className="pc-section-head">
        <span className="pc-section-num">02</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Skills ativas</span>
          <span className="pc-section-sub">Capacidades declaradas no registry oficial</span>
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
        {skills.length === 0 ? (
          <span className="muted text-xs">Nenhuma skill declarada.</span>
        ) : (
          skills.map((s) => (
            <Badge key={s} tone="neutral">
              {s}
            </Badge>
          ))
        )}
      </div>

      {/* Sistemas / Tools */}
      <div className="pc-section-head">
        <span className="pc-section-num">03</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Sistemas e fontes</span>
          <span className="pc-section-sub">APIs que o agente pode ler</span>
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {definition.dataSources.map((d) => (
          <Badge key={d} tone="neutral">
            {d}
          </Badge>
        ))}
      </div>

      {/* Permissões */}
      <div className="pc-section-head">
        <span className="pc-section-num">04</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Permissões</span>
          <span className="pc-section-sub">Leitura permitida · ações que exigem aprovação · ações bloqueadas</span>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 4,
        }}
      >
        <PermColumn title="Leitura permitida" items={reads} tone="success" />
        <PermColumn title="Requer aprovação" items={proposes} tone="warning" />
        <PermColumn title="Bloqueadas (negadas)" items={blocked} tone="danger" />
      </div>

      {/* LLM */}
      <div className="pc-section-head">
        <span className="pc-section-num">05</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">LLM / Provider</span>
          <span className="pc-section-sub">Chave fica no backend · nunca no frontend</span>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
          fontSize: 12,
        }}
      >
        <ItemLabel
          label="Provider"
          value={config?.llm.provider ? config.llm.provider : "—"}
          mono
        />
        <ItemLabel
          label="Modelo"
          value={config?.llm.model ? config.llm.model : "—"}
          mono
          small
        />
        <ItemLabel
          label="API key configurada"
          value={
            <Badge tone={config?.llm.configured ? "success" : "warning"} dot>
              {config?.llm.configured ? "sim" : "não configurada"}
            </Badge>
          }
        />
        <ItemLabel
          label="Chamadas reais"
          value={
            <Badge tone={config?.llm.enabled ? "success" : "ghost"} dot>
              {config?.llm.enabled ? "habilitadas" : "off (modo seguro)"}
            </Badge>
          }
        />
      </div>
      {config?.llm.configured === false && (
        <div className="notice info" style={{ marginTop: 12 }}>
          <Icon name="info" size={14} />
          <span>
            <strong className="hi">LLM não configurado.</strong> Defina{" "}
            <span className="mono">ANTHROPIC_API_KEY</span> ou{" "}
            <span className="mono">OPENAI_API_KEY</span> no <span className="mono">.env</span> do SaaS para habilitar
            inteligência real. Sem essa variável, o agente roda em modo contexto-only.
          </span>
        </div>
      )}
      {config?.llm.configured && !config.llm.enabled && (
        <div className="notice warn" style={{ marginTop: 12 }}>
          <Icon name="lock" size={14} />
          <span>
            <strong className="hi">Chamadas LLM reais desabilitadas.</strong> Para habilitar, defina{" "}
            <span className="mono">ROOMIX_AGENT_LLM_ENABLED=true</span> e reinicie o backend. Sem isso, run-check
            retorna apenas resumo determinístico (modo <span className="mono">llm-ready-not-called</span>).
          </span>
        </div>
      )}

      {/* Garantias de segurança */}
      <div className="pc-section-head">
        <span className="pc-section-num">06</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Garantias de segurança</span>
          <span className="pc-section-sub">Ações sensíveis que este agente NÃO pode disparar</span>
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
        {config && (
          <>
            <GuaranteeBadge label="OTA real" off={!config.guarantees.otaReal} />
            <GuaranteeBadge label="Channel Manager production" off={!config.guarantees.channelManagerProduction} />
            <GuaranteeBadge label="Gateway real" off={!config.guarantees.gatewayReal} />
            <GuaranteeBadge label="FNRH production" off={!config.guarantees.fnrhProduction} />
            <GuaranteeBadge label="Mensagem ao hóspede" off={!config.guarantees.guestMessaging} />
            <GuaranteeBadge label="Cancel automático" off={!config.guarantees.autoCancel} />
            <GuaranteeBadge label="Tarifa automática" off={!config.guarantees.autoRateChange} />
          </>
        )}
        {!config && <span className="muted text-xs">Carregando garantias…</span>}
      </div>

      {/* Last run */}
      {lastRun && (
        <>
          <div className="pc-section-head">
            <span className="pc-section-num">07</span>
            <div className="pc-section-titles">
              <span className="pc-section-title">Última execução (run-check)</span>
              <span className="pc-section-sub">
                Modo: <span className="mono">{lastRun.result.mode}</span> · risco{" "}
                <span className="mono">{lastRun.result.risk}</span>
              </span>
            </div>
          </div>
          <div
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: 12,
              fontSize: 12,
              color: "var(--text)",
              marginBottom: 4,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {lastRun.result.summary}
          </div>
          {lastRun.result.recommendations.length > 0 && (
            <ul style={{ paddingLeft: 18, marginTop: 8, marginBottom: 0, color: "var(--text-mute)", fontSize: 11.5 }}>
              {lastRun.result.recommendations.map((r) => (
                <li key={r} style={{ marginBottom: 3 }}>
                  {r}
                </li>
              ))}
            </ul>
          )}
          {lastRun.result.requiresApproval && (
            <div className="notice warn" style={{ marginTop: 10 }}>
              <Icon name="lock" size={14} />
              <span>
                Este run-check marcou ações que exigem <strong>aprovação humana</strong>. Nenhuma execução automática foi
                feita.
              </span>
            </div>
          )}
        </>
      )}

      {/* Footer actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 22,
          paddingTop: 14,
          borderTop: "1px solid var(--line)",
        }}
      >
        <button
          className="btn ghost"
          type="button"
          onClick={handleRunCheck}
          disabled={loading || busyAction !== null || config?.runtime.status === "paused"}
          title={
            config?.runtime.status === "paused"
              ? "Retome o agente antes de rodar um check"
              : "Roda um check defensivo · read-only · audit-logged"
          }
        >
          <Icon name="zap" size={12} /> {busyAction === "run" ? "Executando…" : "Rodar run-check"}
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={handleToggleStatus}
          disabled={loading || busyAction !== null || !config}
        >
          {config?.runtime.status === "paused" ? (
            <>
              <Icon name="play" size={12} /> {busyAction === "resume" ? "Retomando…" : "Retomar"}
            </>
          ) : (
            <>
              <Icon name="pause" size={12} /> {busyAction === "pause" ? "Pausando…" : "Pausar"}
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}

function ItemLabel({
  label,
  value,
  mono,
  small,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  small?: boolean;
  strong?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.11em",
          color: "var(--text-mute)",
        }}
      >
        {label}
      </span>
      <span
        className={mono ? "mono" : undefined}
        style={{
          fontSize: small ? 11 : 12,
          color: strong ? "#ECF0F5" : "#C7CFD9",
          fontWeight: strong ? 500 : 400,
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function PermColumn({ title, items, tone }: { title: string; items: string[]; tone: "success" | "warning" | "danger" }) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          letterSpacing: "0.11em",
          textTransform: "uppercase",
          color: tone === "success" ? "var(--brand)" : tone === "warning" ? "var(--warning)" : "var(--danger)",
          marginBottom: 8,
          fontWeight: 600,
        }}
      >
        {title}
      </div>
      {items.length === 0 ? (
        <span className="muted text-xs">Nenhum.</span>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
          {items.map((it) => (
            <li
              key={it}
              style={{
                fontSize: 11.5,
                color: "var(--text)",
                lineHeight: 1.4,
                paddingLeft: 12,
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 6,
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background:
                    tone === "success" ? "var(--brand)" : tone === "warning" ? "var(--warning)" : "var(--danger)",
                }}
              />
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GuaranteeBadge({ label, off }: { label: string; off: boolean }) {
  return (
    <Badge tone={off ? "neutral" : "danger"} dot={!off}>
      {label} {off ? "OFF" : "ON"}
    </Badge>
  );
}
