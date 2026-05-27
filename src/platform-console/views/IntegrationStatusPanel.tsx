// Roomix Platform Console — Integration Status panel.
//
// Shown inside the Settings view. Calls GET /api/platform/integration-status
// (superadmin) and renders an honest snapshot of what's connected:
//   • Roomix SaaS — api, auth, properties, overbookings, billing, fnrh, logs
//   • Roomix Channel Manager — bridge status, inbound mode, OTA, HMAC, …
//   • Agents — registry + runtime
//
// Every section reports its own status. Anything `not-connected`
// renders a ghost badge — we never inflate the dashboard.

import React, { useCallback, useEffect, useState } from "react";
import { Badge, Icon, Panel } from "../components";
import { platformConsoleApi, type IntegrationStatus } from "../services/platformConsoleApi";

const statusBadge = (raw: string) => {
  if (raw === "online" || raw === "connected") return <Badge tone="success" dot>conectado</Badge>;
  if (raw === "connected-per-property") return <Badge tone="info" dot>conectado por propriedade</Badge>;
  if (raw === "configured") return <Badge tone="success" dot>configurado</Badge>;
  if (raw === "missing") return <Badge tone="danger" dot pulse>não configurado</Badge>;
  if (raw === "enabled") return <Badge tone="warning" dot>ligado</Badge>;
  if (raw === "off") return <Badge tone="ghost">desligado</Badge>;
  if (raw === "not-connected") return <Badge tone="ghost">não conectado</Badge>;
  if (raw === "error") return <Badge tone="danger" dot>erro</Badge>;
  if (raw === "mock") return <Badge tone="warning" dot>mock</Badge>;
  if (raw === "homologation") return <Badge tone="warning" dot>homologation</Badge>;
  return <Badge tone="neutral">{raw}</Badge>;
};

export function IntegrationStatusPanel() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await platformConsoleApi.fetchIntegrationStatus();
      setStatus(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "NETWORK_ERROR");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Panel
      title="Status de integração"
      icon="git-branch"
      sub={status ? `atualizado em ${new Date(status.ts).toLocaleTimeString("pt-BR")}` : "carregando…"}
      action={
        <button className="btn sm ghost" type="button" onClick={() => void load()} disabled={loading}>
          <Icon name="refresh-cw" size={11} /> Atualizar
        </button>
      }
    >
      {error && (
        <div className="pc-field-error">Falha ao buscar status: {error}</div>
      )}

      {status && (
        <div className="col" style={{ gap: 14 }}>
          {/* ROOMIX SAAS */}
          <div>
            <div className="text-xs muted" style={{ textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              Roomix SaaS
            </div>
            <Row label="API" value={statusBadge(status.saas.api.status)} extra={status.saas.api.base} />
            <Row label="Auth" value={statusBadge(status.saas.auth.status)} extra={`${status.saas.auth.endpoints.length} endpoints`} />
            <Row
              label="Propriedades"
              value={statusBadge(status.saas.properties.status)}
              extra={`${status.saas.properties.count} cadastrada(s)`}
            />
            <Row label="Overbookings" value={statusBadge(status.saas.overbookings.status)} extra={status.saas.overbookings.endpoint} />
            <Row label="Billing / planos" value={statusBadge(status.saas.billing.status)} />
            <Row label="FNRH / compliance" value={statusBadge(status.saas.fnrh.status)} />
            <Row label="Audit logs" value={statusBadge(status.saas.auditLogs.status)} extra={status.saas.auditLogs.table} />
          </div>

          {/* CHANNEL MANAGER */}
          <div>
            <div className="text-xs muted" style={{ textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              Roomix Channel Manager
            </div>
            <Row label="Bridge" value={statusBadge(status.channelManager.bridge.status)} extra={status.channelManager.bridge.reason} />
            <Row label="Inbound mode" value={statusBadge(status.channelManager.inboundMode)} />
            <Row label="Outbox worker" value={statusBadge(status.channelManager.outboxWorker)} />
            <Row label="OTA real" value={statusBadge(status.channelManager.otaReal)} extra="bloqueado por design" />
            <Row label="HMAC gate" value={statusBadge(status.channelManager.hmacGate)} />
            <Row label="Mappings" value={statusBadge(status.channelManager.mappings.status)} />
            <Row label="Inbound events" value={statusBadge(status.channelManager.inboundEvents.status)} />
          </div>

          {/* AGENTS */}
          <div>
            <div className="text-xs muted" style={{ textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              Agentes Roomix
            </div>
            <Row
              label="Registry"
              value={<Badge tone="success" dot>{status.agents.registry.count} agentes</Badge>}
              extra={status.agents.registry.source}
            />
            <Row label="Runtime" value={statusBadge(status.agents.runtime.status)} extra={status.agents.runtime.endpoint} />
          </div>

          {status.unavailable.length > 0 && (
            <div className="notice info" style={{ marginTop: 4 }}>
              <Icon name="lock" size={12} />
              <span>
                Seções "não conectado" hoje: {status.unavailable.map((s) => (
                  <span key={s} className="mono" style={{ color: "var(--text-hi)", marginRight: 8 }}>{s}</span>
                ))}
              </span>
            </div>
          )}
        </div>
      )}

      {!status && loading && (
        <div className="muted text-xs">Buscando status…</div>
      )}
    </Panel>
  );
}

function Row({ label, value, extra }: { label: string; value: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="row-between" style={{ padding: "6px 0", borderBottom: "1px dashed var(--line-faint)" }}>
      <div>
        <div className="text-sm hi">{label}</div>
        {extra && <div className="text-xs muted">{extra}</div>}
      </div>
      <div style={{ marginLeft: 12 }}>{value}</div>
    </div>
  );
}
