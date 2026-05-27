import React, { useEffect, useRef, useState } from "react";
import {
  Badge,
  CMBadge,
  DemoSourceHint,
  FNRHBadge,
  Icon,
  Metric,
  Panel,
  PlanBadge,
  RiskPill,
  SectionHeader,
  SevBadge,
  Sparkline,
  StatusBadges,
  fmtBRL,
} from "../components";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import type { ConsoleOverview, ConsoleViewId } from "../types";

interface ViewOverviewProps {
  data: ConsoleOverview;
  onImpersonate: (name: string, id?: string) => void;
  onNav: (id: ConsoleViewId) => void;
  onRefresh: () => void;
}

// Metric cards that the operator can show/hide via the "Colunas"
// popover. Persisted per-browser in localStorage. Default = all on.
const METRIC_KEYS = [
  { key: "activeProperties", label: "Propriedades ativas" },
  { key: "units", label: "Unidades monitoradas" },
  { key: "mrr", label: "MRR atual" },
  { key: "revenue30d", label: "Receita prevista 30d" },
  { key: "openOverbookings", label: "Overbookings abertos" },
  { key: "cmIncidents", label: "Integrações com erro" },
  { key: "checkins", label: "Check-ins hoje" },
  { key: "fnrhPending", label: "Pendências FNRH" },
  { key: "overdueInvoices", label: "Faturas vencidas" },
  { key: "agents", label: "Agentes ativos" },
] as const;

type MetricKey = (typeof METRIC_KEYS)[number]["key"];
const COLUMNS_STORAGE_KEY = "roomix_console_overview_columns";

const allVisible = (): Record<MetricKey, boolean> =>
  METRIC_KEYS.reduce(
    (acc, m) => ({ ...acc, [m.key]: true }),
    {} as Record<MetricKey, boolean>,
  );

const loadVisibleMetrics = (): Record<MetricKey, boolean> => {
  if (typeof window === "undefined") return allVisible();
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return allVisible();
    const parsed = JSON.parse(raw) as Partial<Record<MetricKey, boolean>>;
    return METRIC_KEYS.reduce(
      (acc, m) => ({ ...acc, [m.key]: parsed[m.key] !== false }),
      {} as Record<MetricKey, boolean>,
    );
  } catch {
    return allVisible();
  }
};

export function ViewOverview({ data, onImpersonate, onNav, onRefresh }: ViewOverviewProps) {
  const [, setActiveAlert] = useState<string | null>(null);
  const M = data.metrics;
  const criticalAlerts = data.alerts.filter((a) => a.severity === "crit").length;
  const warnAlerts = data.alerts.filter((a) => a.severity === "warn").length;

  const [visibleMetrics, setVisibleMetrics] = useState<Record<MetricKey, boolean>>(() => loadVisibleMetrics());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [reprocessOpen, setReprocessOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(visibleMetrics));
    }
  }, [visibleMetrics]);

  useEffect(() => {
    if (!columnsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) setColumnsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setColumnsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [columnsOpen]);

  const toggleMetric = (key: MetricKey) =>
    setVisibleMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
  const restoreDefaults = () => setVisibleMetrics(allVisible());
  const hideAll = () =>
    setVisibleMetrics(
      METRIC_KEYS.reduce((acc, m) => ({ ...acc, [m.key]: false }), {} as Record<MetricKey, boolean>),
    );
  const visibleCount = Object.values(visibleMetrics).filter(Boolean).length;

  return (
    <div className="stack-y">
      <SectionHeader
        title="Visão Geral"
        sub={`${data.today} · ${data.properties.length} propriedades · ${M.openOverbookings} incidentes ativos · MRR ${fmtBRL(M.mrr)}`}
        action={
          <div className="row" style={{ gap: 8 }}>
            <div ref={columnsRef} style={{ position: "relative" }}>
              <button
                className="btn ghost"
                type="button"
                onClick={() => setColumnsOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={columnsOpen}
              >
                <Icon name="columns-3" size={12} /> Colunas
                <span className="mono dim" style={{ marginLeft: 4 }}>
                  {visibleCount}/{METRIC_KEYS.length}
                </span>
              </button>
              {columnsOpen && (
                <div
                  role="menu"
                  className="pc-select-popover"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    width: 260,
                    padding: 6,
                  }}
                >
                  <div style={{ padding: "8px 10px 6px", fontSize: 10.5, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                    Mostrar nas métricas
                  </div>
                  {METRIC_KEYS.map((m) => (
                    <label
                      key={m.key}
                      className="pc-select-option"
                      style={{ cursor: "pointer", justifyContent: "space-between" }}
                    >
                      <span className="pc-select-option-label">{m.label}</span>
                      <input
                        type="checkbox"
                        checked={visibleMetrics[m.key]}
                        onChange={() => toggleMetric(m.key)}
                        style={{ width: 14, height: 14, accentColor: "#18D39A" }}
                      />
                    </label>
                  ))}
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      padding: "6px 4px 4px",
                      marginTop: 4,
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <button
                      type="button"
                      className="btn ghost sm"
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={hideAll}
                    >
                      Ocultar todas
                    </button>
                    <button
                      type="button"
                      className="btn sm"
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={restoreDefaults}
                    >
                      Restaurar padrão
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              className="btn ghost"
              type="button"
              onClick={() => exportOverviewJson(data)}
              disabled={data.properties.length === 0}
              title="Baixar snapshot JSON (sem secrets)"
            >
              <Icon name="download" size={12} /> Exportar
            </button>
            <button className="btn" type="button" onClick={onRefresh}>
              <Icon name="refresh-cw" size={12} /> Sincronizar
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => setReprocessOpen(true)}
              title="Reprocessar dashboards agregados (sem ativar OTA/CM production)"
            >
              <Icon name="zap" size={12} /> Reprocessar tudo
            </button>
          </div>
        }
      />

      <ConfirmActionModal
        open={reprocessOpen}
        onClose={() => setReprocessOpen(false)}
        title="Reprocessar dashboards agregados"
        sub="Visão Geral · sem ativar OTA / CM production / gateway / FNRH"
        icon="zap"
        severity="warn"
        confirmLabel="Confirmar refresh"
        details={[
          "Recarrega overview, propriedades, integration status e agentes.",
          "Não chama Booking, Airbnb, Expedia, gateway de pagamento nem FNRH production.",
          "Reprocessamento global de incidentes ainda não está conectado — só o cache local do Console é atualizado.",
          "Audit log: platform_console_overview_reprocess.",
        ]}
        onConfirm={async () => {
          try {
            await fetch("/api/platform/console/overview/reprocess", {
              method: "POST",
              credentials: "include",
              headers: { Accept: "application/json", "Content-Type": "application/json" },
              body: JSON.stringify({ scope: "console-overview" }),
            }).catch(() => {
              /* endpoint optional — degrade silently */
            });
          } finally {
            // Always refresh locally, even if the backend endpoint
            // is not wired yet. Operator sees fresh data either way.
            if (onRefresh) onRefresh();
          }
        }}
      />

      <DemoSourceHint source={data.source} />

      <div className="grid-metrics">
        {visibleMetrics.activeProperties && (
          <Metric label="Propriedades ativas" value={String(M.activeProperties)} icon="building-2" accent="brand" />
        )}
        {visibleMetrics.units && <Metric label="Unidades monitoradas" value={String(M.units)} icon="bed-double" />}
        {visibleMetrics.mrr && (
          <Metric label="MRR atual" value={`${(M.mrr / 1000).toFixed(1)}k`} unit="BRL" icon="trending-up" accent="brand" />
        )}
        {visibleMetrics.revenue30d && (
          <Metric
            label="Receita prevista 30d"
            value={`${(M.revenueForecast30d / 1000).toFixed(0)}k`}
            unit="BRL"
            icon="line-chart"
          />
        )}
        {visibleMetrics.openOverbookings && (
          <Metric
            label="Overbookings abertos"
            value={String(M.openOverbookings)}
            icon="alert-octagon"
            accent={M.openOverbookings > 0 ? "danger" : undefined}
            ctx={M.openOverbookings > 0 ? `${M.openOverbookings} aberto(s)` : "sem incidentes"}
          />
        )}
        {visibleMetrics.cmIncidents && (
          <Metric
            label="Integrações com erro"
            value={String(M.cmIncidents)}
            icon="git-branch"
            accent={M.cmIncidents > 0 ? "warning" : undefined}
            ctx="Channel Manager"
          />
        )}
        {visibleMetrics.checkins && (
          <Metric label="Check-ins hoje" value={String(M.checkinsToday)} icon="door-open" ctx={`${M.fnrhPending} sem FNRH`} />
        )}
        {visibleMetrics.fnrhPending && (
          <Metric
            label="Pendências FNRH"
            value={String(M.fnrhPending)}
            icon="shield-alert"
            accent={M.fnrhPending > 0 ? "warning" : undefined}
          />
        )}
        {visibleMetrics.overdueInvoices && (
          <Metric
            label="Faturas vencidas"
            value={String(M.overdueInvoices)}
            icon="receipt"
            ctx={M.overdueAmount > 0 ? `${fmtBRL(M.overdueAmount)} em risco` : undefined}
            accent={M.overdueInvoices > 0 ? "danger" : undefined}
          />
        )}
        {visibleMetrics.agents && (
          <Metric
            label="Agentes ativos"
            value={String(M.activeAgents)}
            unit={`/${M.totalAgents}`}
            icon="sparkles"
            accent="info"
          />
        )}
      </div>

      <div className="panel">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "var(--line)" }}>
          <TrendCell label="MRR · 14 dias" value={M.mrr > 0 ? fmtBRL(M.mrr) : "—"} series={data.mrrSeries} color="var(--brand)" />
          <TrendCell
            label="Reservas · 14 dias"
            value={data.reservationsSeries.length ? String(data.reservationsSeries[data.reservationsSeries.length - 1]) : "—"}
            series={data.reservationsSeries}
            color="#4F8BF5"
          />
          <TrendCell
            label="Ocupação média · 14 dias"
            value={data.occupancySeries.length ? `${data.occupancySeries[data.occupancySeries.length - 1]}%` : "—"}
            series={data.occupancySeries}
            color="#B79DFF"
          />
        </div>
      </div>

      <div className="grid-3">
        <Panel
          title="Mapa operacional"
          icon="building-2"
          sub={`${data.properties.length} propriedades`}
          dense
          action={
            <div className="row" style={{ gap: 6 }}>
              <button className="btn sm ghost" type="button" onClick={() => onNav("properties")}>
                Ver todas <Icon name="arrow-right" size={11} />
              </button>
            </div>
          }
        >
          <div className="tbl-scroll" style={{ maxHeight: 520 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Propriedade</th>
                  <th>Plano</th>
                  <th>Status</th>
                  <th className="num">Ocup.</th>
                  <th className="num">Receita 30d</th>
                  <th>CM</th>
                  <th>FNRH</th>
                  <th className="num">OB</th>
                  <th>Sync</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.properties.map((p) => (
                  <tr key={p.id} onClick={() => onImpersonate(p.name, p.id)}>
                    <td>
                      <div className="cell-strong">
                        {p.name}{" "}
                        {p.tags.includes("safe-env") && (
                          <Badge tone="violet" style={{ marginLeft: 6 }}>
                            ambiente seguro
                          </Badge>
                        )}
                      </div>
                      <div className="cell-mute">
                        {p.city} · {p.units} UH
                      </div>
                    </td>
                    <td>
                      <PlanBadge plan={p.plan} />
                    </td>
                    <td>{StatusBadges[p.status] || <Badge tone="neutral">{p.status}</Badge>}</td>
                    <td className="num">
                      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        <span className="hi">{p.occupancy14}%</span>
                        <div className="bar thin" style={{ width: 40 }}>
                          <span style={{ width: `${p.occupancy14}%`, background: p.occupancy14 >= 80 ? "var(--brand)" : "rgba(255,255,255,0.25)" }} />
                        </div>
                      </div>
                    </td>
                    <td className="num">{fmtBRL(p.revenueForecast)}</td>
                    <td>
                      <CMBadge status={p.cmStatus} />
                    </td>
                    <td>
                      <FNRHBadge status={p.fnrh} />
                    </td>
                    <td className="num">
                      {p.overbookings > 0 ? (
                        <Badge tone="danger" dot pulse>
                          {p.overbookings}
                        </Badge>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="mono dim">{p.lastSync.slice(11, 16)}</td>
                    <td>
                      <div className="row" style={{ gap: 2 }}>
                        <button
                          className="icon-btn"
                          title="Visualizar como propriedade"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onImpersonate(p.name, p.id);
                          }}
                        >
                          <Icon name="external-link" size={12} />
                        </button>
                        <button className="icon-btn" type="button" title="Mais">
                          <Icon name="more-horizontal" size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Alertas críticos"
          icon="alert-triangle"
          sub={`${criticalAlerts} críticos · ${warnAlerts} avisos`}
          dense
        >
          <div style={{ maxHeight: 520, overflow: "auto" }}>
            {data.alerts.map((a) => (
              <div key={a.id} className={`alert-row sev-${a.severity}`} onClick={() => setActiveAlert(a.id)}>
                <div className="grow">
                  <div className="alert-meta">
                    <SevBadge sev={a.severity} />
                    <span className="muted" style={{ fontSize: 11 }}>
                      {a.property}
                    </span>
                    <span className="alert-time">· {a.time}</span>
                  </div>
                  <div className="alert-title" style={{ marginTop: 4 }}>
                    {a.title}
                  </div>
                  <div className="alert-desc">{a.desc}</div>
                </div>
                <div style={{ alignSelf: "center" }}>
                  <button className="icon-btn" type="button" aria-label="Detalhes">
                    <Icon name="chevron-right" size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Linha do tempo" icon="activity" sub="hoje" dense>
          <div style={{ maxHeight: 520, overflow: "auto" }}>
            {data.timeline.map((t) => (
              <div key={t.id} className="timeline-row">
                <div className={`timeline-icon ${t.tone}`}>
                  <Icon name={t.icon} size={13} />
                </div>
                <div className="timeline-body">
                  <div className="timeline-title">{t.title}</div>
                  <div className="timeline-meta">{t.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid-2-side">
        <Panel
          title="Agentes Roomix · estado atual"
          icon="cpu"
          sub={`${data.agents.length} agentes · ${M.activeAgents} ativos`}
          action={
            <button className="btn sm ghost" type="button" onClick={() => onNav("agent-center")}>
              Abrir Agent Center <Icon name="arrow-right" size={11} />
            </button>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {data.agents.slice(0, 6).map((a) => (
              <div key={a.id} className="agent-card" style={{ padding: 12 }}>
                <div className="agent-head">
                  <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                    <div className="agent-icon" style={{ width: 28, height: 28 }}>
                      <Icon name={a.icon} size={14} />
                    </div>
                    <div>
                      <div className="agent-name" style={{ fontSize: 12 }}>
                        {a.name}
                      </div>
                      <div className="agent-role" style={{ fontSize: 10.5 }}>
                        {a.role}
                      </div>
                    </div>
                  </div>
                  {a.status === "active" && (
                    <Badge tone="success" dot pulse>
                      ativo
                    </Badge>
                  )}
                  {a.status === "paused" && (
                    <Badge tone="warning" dot>
                      pausado
                    </Badge>
                  )}
                  {a.status === "error" && (
                    <Badge tone="danger" dot pulse>
                      erro
                    </Badge>
                  )}
                </div>
                <div className="text-xs muted" style={{ lineHeight: 1.4 }}>
                  {a.task}
                </div>
                <div className="row-between text-xs">
                  <span className="muted">
                    {a.last} · {a.actions} ações
                  </span>
                  <RiskPill risk={a.risk} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="stack-y">
          <Panel title="Homologation Mode" icon="shield" sub="ambiente seguro">
            <div className="col">
              <ToggleRow label="Inbound webhooks" value="ON" tone="success" />
              <ToggleRow label="Outbox worker" value="OFF" tone="warning" />
              <ToggleRow label="OTA real (Booking/Airbnb)" value="OFF" tone="danger" />
              <ToggleRow label="HMAC gate" value="ativo" tone="success" />
              <div className="notice warn">
                <Icon name="alert-triangle" size={14} />
                <span>Production mode exige aprovação humana e desbloqueio pelo Security Agent.</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function TrendCell({ label, value, series, color }: { label: string; value: string; series: number[]; color: string }) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        justifyContent: "space-between",
      }}
    >
      <div>
        <div className="text-xs muted" style={{ textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10.5 }}>
          {label}
        </div>
        <div className="row" style={{ gap: 10, marginTop: 4 }}>
          <span className="font-display" style={{ fontSize: 22, color: "var(--text-hi)", letterSpacing: "-0.01em" }}>
            {value}
          </span>
        </div>
      </div>
      <div>
        <Sparkline data={series} color={color} width={150} height={36} />
      </div>
    </div>
  );
}

function ToggleRow({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "danger" | "info" }) {
  return (
    <div className="row-between" style={{ fontSize: 12 }}>
      <span className="muted">{label}</span>
      <Badge tone={tone} dot>
        {value}
      </Badge>
    </div>
  );
}

// ---- Overview export -------------------------------------------
// Snapshot includes only what the operator already sees on screen.
// Excludes raw audit metadata, tokens, secrets, full PII. The result
// is safe to share for offline ops review.
function exportOverviewJson(data: ConsoleOverview) {
  const snap = {
    capturedAt: new Date().toISOString(),
    today: data.today,
    source: data.source,
    metrics: data.metrics,
    properties: data.properties.map((p) => ({
      id: p.id,
      name: p.name,
      city: p.city,
      country: p.country,
      client: p.client,
      plan: p.plan,
      status: p.status,
      units: p.units,
      occupancyToday: p.occupancyToday,
      mrr: p.mrr,
      cm: p.cm,
      fnrh: p.fnrh,
      overbookings: p.overbookings,
    })),
    plansData: data.plansData,
    cmTable: data.cmTable,
    fnrh: data.fnrh,
    unavailable: data.unavailable,
  };
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `roomix-overview-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
