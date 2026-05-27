// Logs & Auditoria — consumer of /api/platform/audit-logs.
//
// Self-contained, fully wired to the Linear-inspired design system
// already defined in interactions.css (.pc-section-head / .pc-section-num
// / .pc-field-input / .pc-modal-*). No mock, no fabrication: empty
// result shows an honest empty state, error state shows the failure
// code with operator-friendly hints (e.g. 404 → "rota não live, reinicie
// o backend").
//
// Row actions:
//   • View details (drawer with sanitized metadata)
//   • Copy event id (clipboard)
//   • Open property deep-link (handleImpersonate)
//
// Filters supported (mirrored 1-to-1 with the backend):
//   q · severity · module · tenantId · propertyId · actor · from · to · limit

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Icon, Panel, SectionHeader } from "../components";
import { Modal } from "../components/Modal";
import { DateTimePicker } from "../components/DateTimePicker";
import { useToast } from "../components/Toast";
import {
  auditLogsApi,
  deriveOrigin,
  ORIGIN_LABEL,
  type AuditLogModule,
  type AuditLogSeverity,
  type AuditLogsFilter,
  type PlatformAuditLogEntry,
} from "../services/auditLogsApi";
import {
  buildPropertyIndex,
  formatAuditAction,
  isDeniedAction,
  resolveActor,
  resolveProperty,
  type ResolvedProperty,
} from "../services/auditHumanizer";
import type { PropertySummary } from "../types";

const SEVERITY_OPTIONS: Array<{ value: AuditLogSeverity | "todos"; label: string }> = [
  { value: "todos", label: "Todas severidades" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
];

const MODULE_OPTIONS: Array<{ value: AuditLogModule | "todos"; label: string }> = [
  { value: "todos", label: "Todas origens" },
  { value: "console", label: ORIGIN_LABEL.console },
  { value: "saas", label: ORIGIN_LABEL.saas },
  { value: "cm", label: ORIGIN_LABEL.cm },
  { value: "agent", label: ORIGIN_LABEL.agent },
  { value: "lgpd", label: ORIGIN_LABEL.lgpd },
  { value: "fnrh", label: ORIGIN_LABEL.fnrh },
  { value: "billing", label: ORIGIN_LABEL.billing },
  { value: "security", label: ORIGIN_LABEL.security },
];

const LIMIT_OPTIONS = [50, 100, 200, 500];

interface ViewLogsProps {
  onOpenProperty?: (propertyId: string, propertyName?: string) => void;
  /** Properties known to the Console — used to resolve UUID → name + city. */
  properties?: PropertySummary[];
}

export function ViewLogs({ onOpenProperty, properties = [] }: ViewLogsProps = {}) {
  const propertyIndex = useMemo(() => buildPropertyIndex(properties), [properties]);

  const [rows, setRows] = useState<PlatformAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [severity, setSeverity] = useState<AuditLogSeverity | "todos">("todos");
  const [moduleFilter, setModuleFilter] = useState<AuditLogModule | "todos">("todos");
  const [tenantId, setTenantId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState<number>(200);
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<PlatformAuditLogEntry | null>(null);
  const toast = useToast();

  const fetchLogs = useCallback(() => {
    setLoading(true);
    setError(null);
    setHttpStatus(null);
    const filter: AuditLogsFilter = { limit };
    if (severity !== "todos") filter.severity = severity;
    if (moduleFilter !== "todos") filter.module = moduleFilter;
    if (tenantId.trim()) filter.tenantId = tenantId.trim();
    if (propertyId.trim()) filter.propertyId = propertyId.trim();
    if (actor.trim()) filter.actor = actor.trim();
    if (from) filter.from = from;
    if (to) filter.to = to;
    if (q.trim()) filter.q = q.trim();
    auditLogsApi
      .list(filter)
      .then((res) => {
        setRows(res.events);
        setLoading(false);
      })
      .catch((err: Error & { status?: number }) => {
        // eslint-disable-next-line no-console
        console.warn("[platform-console] audit-logs load failed:", err.message);
        setRows([]);
        setError(err.message);
        setHttpStatus(err.status ?? null);
        setLoading(false);
      });
  }, [severity, moduleFilter, tenantId, propertyId, actor, from, to, q, limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const counts = useMemo(() => {
    let info = 0;
    let warning = 0;
    let errCount = 0;
    for (const r of rows) {
      if (r.severity === "warning") warning++;
      else if (r.severity === "error") errCount++;
      else info++;
    }
    return { info, warning, error: errCount };
  }, [rows]);

  const copyId = useCallback(
    (id: string) => {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(id).then(
          () => toast.show("ID copiado para a área de transferência", "brand"),
          () => toast.show("Não foi possível copiar — copie manualmente", "warn"),
        );
      } else {
        toast.show("Clipboard indisponível", "warn");
      }
    },
    [toast],
  );

  const clearFilters = useCallback(() => {
    setSeverity("todos");
    setModuleFilter("todos");
    setTenantId("");
    setPropertyId("");
    setActor("");
    setFrom("");
    setTo("");
    setQ("");
    setLimit(200);
  }, []);

  // Build a friendly error hint based on the HTTP status / code.
  const errorHint = useMemo(() => {
    if (!error) return null;
    if (httpStatus === 404 || error === "API_ROUTE_NOT_FOUND") {
      return "A rota não está registrada neste backend. Reinicie o SaaS — o dev-script é tsx server.ts sem watch, então rotas novas só ficam live após restart.";
    }
    if (httpStatus === 401 || error === "UNAUTHENTICATED") {
      return "Sessão expirou. Faça login novamente no Console.";
    }
    if (httpStatus === 403 || error === "SUPERADMIN_REQUIRED" || error === "PERMISSION_DENIED") {
      return "Sua sessão atual não tem permissão de Superadmin Roomix neste tenant.";
    }
    return "Tente atualizar. Se persistir, valide se o backend está rodando em http://localhost:3000.";
  }, [error, httpStatus]);

  return (
    <div className="stack-y">
      <SectionHeader
        title="Logs & Auditoria"
        sub={`Persistent audit · ${rows.length} eventos${error ? " · backend indisponível" : ""}`}
        action={
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" type="button" onClick={fetchLogs} disabled={loading}>
              <Icon name="refresh-cw" size={12} /> Atualizar
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => exportNdjson(rows)}
              disabled={rows.length === 0}
              title={rows.length === 0 ? "Nenhum log para exportar" : "Baixar NDJSON"}
            >
              <Icon name="download" size={12} /> NDJSON
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => exportCsv(rows)}
              disabled={rows.length === 0}
              title={rows.length === 0 ? "Nenhum log para exportar" : "Baixar CSV (sanitizado)"}
            >
              <Icon name="download" size={12} /> CSV
            </button>
          </div>
        }
      />

      {error && (
        <div className="notice danger">
          <Icon name="x-circle" size={14} />
          <span>
            <strong>Falha ao carregar audit logs.</strong>{" "}
            <span className="mono">{error}</span>
            {errorHint ? (
              <>
                <br />
                <span style={{ color: "var(--text-mute)" }}>{errorHint}</span>
              </>
            ) : null}
          </span>
        </div>
      )}

      <div className="notice info">
        <Icon name="shield" size={14} />
        <span>
          <strong className="hi">Eventos reais do Roomix SaaS</strong> · vindos da tabela{" "}
          <span className="mono">audit_logs</span> · sem secrets, sem tokens, sem PII. Cada acesso a esta tela
          gera um evento <span className="mono">platform_audit_logs_read</span>.
        </span>
      </div>

      <div className="grid-metrics" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <MiniCounter label="Info" value={counts.info} tone="info" />
        <MiniCounter label="Warning" value={counts.warning} tone="warning" />
        <MiniCounter label="Error" value={counts.error} tone="danger" />
      </div>

      {/* -------- FILTROS DE AUDITORIA (card próprio) -------- */}
      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "18px 20px 20px",
        }}
      >
        <div className="pc-section-head" style={{ marginTop: 0, paddingTop: 0 }}>
          <span className="pc-section-num">01</span>
          <div className="pc-section-titles">
            <span className="pc-section-title">Filtros de auditoria</span>
            <span className="pc-section-sub">
              Combine campos para focar o feed. Mudanças aplicam automaticamente.
            </span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 14,
            alignItems: "start",
          }}
        >
          <div className="pc-field">
            <label className="pc-field-label">Busca textual</label>
            <input
              placeholder="ação · eventType · ator · entityId"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pc-field-input"
            />
          </div>

          <div className="pc-field">
            <label className="pc-field-label">Severidade</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as AuditLogSeverity | "todos")}
              className="pc-field-input"
            >
              {SEVERITY_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="pc-field">
            <label className="pc-field-label">Origem / módulo</label>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value as AuditLogModule | "todos")}
              className="pc-field-input"
            >
              {MODULE_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="pc-field">
            <label className="pc-field-label">Tenant ID</label>
            <input
              placeholder="visão global se vazio"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="pc-field-input"
            />
          </div>

          <div className="pc-field">
            <label className="pc-field-label">Property ID</label>
            <input
              placeholder="uuid (opcional)"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="pc-field-input"
            />
          </div>

          <div className="pc-field">
            <label className="pc-field-label">Ator (user id)</label>
            <input
              placeholder="uuid do usuário"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              className="pc-field-input"
            />
          </div>

          <div className="pc-field">
            <label className="pc-field-label">Período inicial</label>
            <DateTimePicker value={from} onChange={setFrom} ariaLabel="De" />
          </div>

          <div className="pc-field">
            <label className="pc-field-label">Período final</label>
            <DateTimePicker value={to} onChange={setTo} ariaLabel="Até" />
          </div>

          <div className="pc-field">
            <label className="pc-field-label">Limite</label>
            <select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="pc-field-input"
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} eventos
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid var(--line-faint)",
          }}
        >
          <span className="muted" style={{ fontSize: 11 }}>
            {rows.length === 0 && !loading
              ? "Nenhum resultado"
              : `${rows.length} evento${rows.length === 1 ? "" : "s"} carregado${rows.length === 1 ? "" : "s"}`}
          </span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" type="button" onClick={clearFilters}>
              <Icon name="x" size={12} /> Limpar filtros
            </button>
            <button className="btn ghost" type="button" onClick={fetchLogs} disabled={loading}>
              <Icon name="refresh-cw" size={12} /> Aplicar / Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* -------- TABELA (card próprio) -------- */}
      <Panel title="Eventos" icon="file-text" sub={`${rows.length} resultado${rows.length === 1 ? "" : "s"}`} dense>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Origem</th>
                <th>Sev.</th>
                <th>Ação</th>
                <th>Ator</th>
                <th>Propriedade</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 28, color: "var(--text-mute)" }}>
                    Carregando audit logs do backend…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && !error && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 28, color: "var(--text-mute)" }}>
                    Nenhum evento encontrado para os filtros atuais.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((l) => {
                  const origin = deriveOrigin(l);
                  const actor = resolveActor(l);
                  const property = resolveProperty(l.propertyId, propertyIndex);
                  const humanAction = formatAuditAction(l);
                  const denied = isDeniedAction(l);
                  const canOpenProperty = Boolean(
                    property && property.exists && onOpenProperty,
                  );
                  return (
                    <tr key={l.id}>
                      <td className="mono dim" title={l.createdAt}>
                        {formatTs(l.createdAt)}
                      </td>
                      <td>
                        <Badge tone="neutral">{ORIGIN_LABEL[origin]}</Badge>
                      </td>
                      <td>
                        {l.severity === "error" && (
                          <Badge tone="danger" dot pulse>
                            error
                          </Badge>
                        )}
                        {l.severity === "warning" && (
                          <Badge tone="warning" dot>
                            warn
                          </Badge>
                        )}
                        {l.severity === "info" && (
                          <Badge tone="neutral" dot>
                            info
                          </Badge>
                        )}
                      </td>
                      <td>
                        <span
                          className="cell-strong"
                          style={{
                            fontSize: 12,
                            color: denied ? "var(--warning)" : "var(--text-hi)",
                          }}
                        >
                          {humanAction}
                        </span>
                        <br />
                        <span className="muted mono" style={{ fontSize: 10 }}>
                          {l.eventType || l.action}
                        </span>
                      </td>
                      <td style={{ fontSize: 11 }}>
                        <span className="cell-strong" style={{ fontSize: 11.5, color: "var(--text-hi)" }}>
                          {actor.label}
                        </span>
                        <br />
                        <span className="muted" style={{ fontSize: 10 }}>
                          {actor.sub}
                        </span>
                      </td>
                      <td style={{ fontSize: 11 }}>
                        {property ? (
                          <>
                            <span
                              className="cell-strong"
                              title={l.propertyId || undefined}
                              style={{
                                fontSize: 11.5,
                                color: property.exists ? "var(--text-hi)" : "var(--warning)",
                              }}
                            >
                              {property.name}
                            </span>
                            <br />
                            <span className="muted mono" style={{ fontSize: 10 }}>
                              {property.city ? `${property.city} · ` : ""}
                              {shortenId(property.id)}
                            </span>
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {denied ? (
                          <Badge tone="warning" dot>
                            negado
                          </Badge>
                        ) : l.severity === "error" ? (
                          <Badge tone="danger" dot>
                            erro
                          </Badge>
                        ) : l.severity === "warning" ? (
                          <Badge tone="warning" dot>
                            atenção
                          </Badge>
                        ) : (
                          <Badge tone="success" dot>
                            ok
                          </Badge>
                        )}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 1, justifyContent: "flex-end" }}>
                          <button
                            className="icon-btn"
                            type="button"
                            title="Ver detalhes"
                            onClick={() => setDetail(l)}
                          >
                            <Icon name="eye" size={12} />
                          </button>
                          <button
                            className="icon-btn"
                            type="button"
                            title="Copiar ID do evento"
                            onClick={() => copyId(l.id)}
                          >
                            <Icon name="clipboard" size={12} />
                          </button>
                          {canOpenProperty && (
                            <button
                              className="icon-btn"
                              type="button"
                              title={`Abrir ${property!.name}`}
                              onClick={() =>
                                onOpenProperty!(property!.id, property!.name)
                              }
                            >
                              <Icon name="external-link" size={12} />
                            </button>
                          )}
                          {l.propertyId && !canOpenProperty && (
                            <button
                              className="icon-btn"
                              type="button"
                              title="Este evento não está vinculado a uma propriedade abrível."
                              disabled
                              style={{ opacity: 0.4, cursor: "not-allowed" }}
                            >
                              <Icon name="external-link" size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Panel>

      <LogDetailDrawer
        entry={detail}
        onClose={() => setDetail(null)}
        onCopyId={copyId}
        onOpenProperty={onOpenProperty}
        propertyIndex={propertyIndex}
      />
    </div>
  );
}

function MiniCounter({ label, value, tone }: { label: string; value: number; tone: "info" | "warning" | "danger" }) {
  const accent =
    tone === "danger" ? "var(--danger)" : tone === "warning" ? "var(--warning)" : "var(--text-mute)";
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: value > 0 ? accent : "var(--text-hi)" }}>
        {value}
      </div>
    </div>
  );
}

function LogDetailDrawer({
  entry,
  onClose,
  onCopyId,
  onOpenProperty,
  propertyIndex,
}: {
  entry: PlatformAuditLogEntry | null;
  onClose: () => void;
  onCopyId: (id: string) => void;
  onOpenProperty?: (propertyId: string, propertyName?: string) => void;
  propertyIndex: Map<string, ResolvedProperty>;
}) {
  if (!entry) {
    return (
      <Modal open={false} onClose={onClose} title="">
        <div />
      </Modal>
    );
  }
  const sanitized = sanitizeMetadata(entry.metadata);
  const origin = deriveOrigin(entry);
  const actor = resolveActor(entry);
  const property = resolveProperty(entry.propertyId, propertyIndex);
  const humanAction = formatAuditAction(entry);
  const canOpenProperty = Boolean(property && property.exists && onOpenProperty);
  return (
    <Modal
      open
      onClose={onClose}
      title="Detalhe do evento"
      sub={`${entry.eventType} · ${entry.severity}`}
      icon="file-text"
      width="lg"
      headerActions={
        <div className="row" style={{ gap: 6 }}>
          <button className="btn ghost" type="button" onClick={() => onCopyId(entry.id)}>
            <Icon name="clipboard" size={12} /> Copiar ID
          </button>
          {canOpenProperty && (
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                onOpenProperty!(property!.id, property!.name);
                onClose();
              }}
            >
              <Icon name="external-link" size={12} /> Abrir {property!.name}
            </button>
          )}
        </div>
      }
    >
      {/* Identificação */}
      <div className="pc-section-head" style={{ marginTop: 0, paddingTop: 0 }}>
        <span className="pc-section-num">01</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Identificação</span>
          <span className="pc-section-sub">O que aconteceu, quando e qual o impacto</span>
        </div>
      </div>
      <DGrid>
        <DRow label="Ação humana" value={humanAction} strong />
        <DRow label="Timestamp" value={entry.createdAt} mono />
        <DRow label="Origem" value={ORIGIN_LABEL[origin]} strong />
        <DRow
          label="Severidade"
          value={
            <Badge
              tone={entry.severity === "error" ? "danger" : entry.severity === "warning" ? "warning" : "neutral"}
              dot
            >
              {entry.severity}
            </Badge>
          }
        />
      </DGrid>

      {/* Detalhe técnico */}
      <div className="pc-section-head">
        <span className="pc-section-num">02</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Detalhe técnico</span>
          <span className="pc-section-sub">EventType, ação e entidade no banco</span>
        </div>
      </div>
      <DGrid>
        <DRow label="EventType" value={entry.eventType} mono />
        <DRow label="Action" value={entry.action} mono />
        <DRow
          label="Entidade"
          value={`${entry.entityType}${entry.entityId ? ` · ${entry.entityId}` : ""}`}
          mono
        />
        <DRow label="ID do evento" value={entry.id} mono small />
      </DGrid>

      {/* Ator */}
      <div className="pc-section-head">
        <span className="pc-section-num">03</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Ator</span>
          <span className="pc-section-sub">Quem executou esta ação</span>
        </div>
      </div>
      <DGrid>
        <DRow label="Tipo" value={actor.label} strong />
        <DRow label="Contexto" value={actor.sub} />
        <DRow label="User ID" value={entry.actorUserId || "—"} mono />
        <DRow label="Role técnico" value={entry.actorRole || "—"} mono />
      </DGrid>

      {/* Escopo */}
      <div className="pc-section-head">
        <span className="pc-section-num">04</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Escopo</span>
          <span className="pc-section-sub">Propriedade, tenant e rede</span>
        </div>
      </div>
      <DGrid>
        <DRow
          label="Propriedade"
          value={
            property ? (
              <>
                <span style={{ color: property.exists ? "var(--text-hi)" : "var(--warning)", fontWeight: 500 }}>
                  {property.name}
                </span>
                {property.city ? (
                  <>
                    {" "}
                    <span className="muted">· {property.city}</span>
                  </>
                ) : null}
              </>
            ) : (
              "—"
            )
          }
        />
        <DRow label="Property ID" value={entry.propertyId || "—"} mono small />
        <DRow label="Tenant" value={entry.tenantId || "—"} mono />
        <DRow label="IP" value={entry.ip || "—"} mono />
      </DGrid>

      {/* Metadata */}
      <div className="pc-section-head">
        <span className="pc-section-num">05</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Metadata</span>
          <span className="pc-section-sub">Sanitizado · chaves com secret/token/password/api_key/cookie/authorization/hmac viram [REDACTED]</span>
        </div>
      </div>
      <pre
        style={{
          background: "#0E1319",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 8,
          padding: 12,
          fontSize: 11,
          color: "#C7CFD9",
          maxHeight: 280,
          overflow: "auto",
          margin: "0 0 6px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "'Geist Mono', ui-monospace, monospace",
          lineHeight: 1.5,
        }}
      >
        {JSON.stringify(sanitized, null, 2)}
      </pre>
    </Modal>
  );
}

function DGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: "10px 18px",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function DRow({
  label,
  value,
  mono,
  strong,
  small,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  strong?: boolean;
  small?: boolean;
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
          lineHeight: 1.4,
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
          letterSpacing: "-0.005em",
        }}
      >
        {value}
      </span>
    </div>
  );
}

const SECRET_KEY_PATTERN = /(secret|token|password|api[_-]?key|cookie|authorization|hmac)/i;
function sanitizeMetadata(meta: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!meta || typeof meta !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SECRET_KEY_PATTERN.test(k)) {
      out[k] = "[REDACTED]";
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizeMetadata(v as Record<string, unknown>);
    } else if (typeof v === "string" && v.length > 4096) {
      out[k] = `${v.slice(0, 4096)}…[truncated]`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function formatTs(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${day}/${month} · ${h}:${m}:${s}`;
}

function shortenId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function exportNdjson(rows: PlatformAuditLogEntry[]) {
  if (rows.length === 0) return;
  const lines = rows.map((r) => JSON.stringify(r));
  const blob = new Blob([lines.join("\n")], { type: "application/x-ndjson;charset=utf-8" });
  triggerDownload(blob, `roomix-audit-logs-${new Date().toISOString().slice(0, 10)}.ndjson`);
}

function exportCsv(rows: PlatformAuditLogEntry[]) {
  if (rows.length === 0) return;
  const header = [
    "id",
    "createdAt",
    "origin",
    "severity",
    "eventType",
    "action",
    "entityType",
    "entityId",
    "actorUserId",
    "actorRole",
    "propertyId",
    "tenantId",
    "ip",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.createdAt,
        deriveOrigin(r),
        r.severity,
        csvEscape(r.eventType || ""),
        csvEscape(r.action || ""),
        csvEscape(r.entityType || ""),
        csvEscape(r.entityId || ""),
        r.actorUserId || "",
        csvEscape(r.actorRole || ""),
        r.propertyId || "",
        r.tenantId || "",
        csvEscape(r.ip || ""),
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, `roomix-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
