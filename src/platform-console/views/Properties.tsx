import React, { useEffect, useRef, useState } from "react";
import {
  Badge,
  CMBadge,
  DemoSourceHint,
  FNRHBadge,
  Icon,
  PlanBadge,
  Panel,
  SectionHeader,
  StatusBadges,
  fmtBRL,
} from "../components";
import type { ConsoleOverview, PropertySummary } from "../types";

interface ViewPropertiesProps {
  data: ConsoleOverview;
  onImpersonate: (name: string, id?: string) => void;
  onRefresh?: () => void;
  onNewProperty?: () => void;
  /** Origin used by deep-link buttons (Channel Manager, mapa operacional). */
  saasOrigin?: string;
  /** Navigate the Console to another view, optionally with deep-link state. */
  onNavigateView?: (view: "cm" | "logs" | "clients" | "payments" | "agents" | "agent-center" | "overbookings", propertyId?: string) => void;
}

interface PropertyFilter {
  status: string;
  plan: string;
  cm: string;
  fnrh: string;
  ob: boolean;
}

export function ViewProperties({
  data,
  onImpersonate,
  onRefresh,
  onNewProperty,
  saasOrigin = "http://localhost:3000",
  onNavigateView,
}: ViewPropertiesProps) {
  const [filter, setFilter] = useState<PropertyFilter>({
    status: "todas",
    plan: "todos",
    cm: "todos",
    fnrh: "todos",
    ob: false,
  });
  const [selected, setSelected] = useState<string>(data.properties[0]?.id ?? "");

  // Reset selection if dataset changes underneath us
  useEffect(() => {
    if (data.properties.length === 0) return;
    if (!data.properties.find((p) => p.id === selected)) {
      setSelected(data.properties[0].id);
    }
  }, [data.properties, selected]);

  const filtered = data.properties.filter((p) => {
    if (filter.status !== "todas" && p.status !== filter.status) return false;
    if (filter.plan !== "todos" && p.plan !== filter.plan) return false;
    if (filter.cm === "ativo" && p.cm !== "on") return false;
    if (filter.cm === "inativo" && p.cm !== "off") return false;
    if (filter.fnrh === "ok" && p.fnrh !== "ok") return false;
    if (filter.fnrh === "pendente" && p.fnrh !== "pending") return false;
    if (filter.ob && !(p.overbookings > 0)) return false;
    return true;
  });

  const selProp = data.properties.find((p) => p.id === selected) || data.properties[0];

  return (
    <div className="stack-y">
      <SectionHeader
        title="Propriedades"
        sub={`${filtered.length} de ${data.properties.length} propriedades`}
        action={
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" type="button" onClick={onRefresh} title="Buscar propriedades novamente">
              <Icon name="refresh-cw" size={12} /> Sincronizar
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => exportPropertiesCsv(filtered)}
              disabled={filtered.length === 0}
              title={filtered.length === 0 ? "Sem propriedades para exportar" : "Baixar CSV com filtros aplicados"}
            >
              <Icon name="download" size={12} /> Exportar CSV
            </button>
            <button className="btn primary" type="button" onClick={onNewProperty}>
              <Icon name="plus" size={12} /> Nova propriedade
            </button>
          </div>
        }
      />

      <DemoSourceHint source={data.source} />

      <div className="filter-bar">
        <FilterChip label="Status" value={filter.status} options={["todas", "active", "trial", "suspended", "demo"]} onChange={(v) => setFilter({ ...filter, status: v })} />
        <FilterChip label="Plano" value={filter.plan} options={["todos", "Starter", "Growth", "Evolution", "Enterprise"]} onChange={(v) => setFilter({ ...filter, plan: v })} />
        <FilterChip label="CM" value={filter.cm} options={["todos", "ativo", "inativo"]} onChange={(v) => setFilter({ ...filter, cm: v })} />
        <FilterChip label="FNRH" value={filter.fnrh} options={["todos", "ok", "pendente"]} onChange={(v) => setFilter({ ...filter, fnrh: v })} />
        <div className={`filter-chip ${filter.ob ? "active" : ""}`} onClick={() => setFilter({ ...filter, ob: !filter.ob })}>
          <Icon name="alert-octagon" size={12} /> com overbooking
        </div>
        <div className="row" style={{ marginLeft: "auto", gap: 8 }}>
          <button className="btn ghost sm" type="button">
            <Icon name="columns-3" size={12} /> Colunas
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14, alignItems: "start" }}>
        <Panel title="Lista de propriedades" icon="building-2" sub={`${filtered.length} resultados`} dense>
          <div className="tbl-scroll" style={{ maxHeight: "calc(100vh - 320px)" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Propriedade</th>
                  <th>Cliente / responsável</th>
                  <th>Plano</th>
                  <th className="num">UH</th>
                  <th>Ocup. 14d</th>
                  <th className="num">Receita</th>
                  <th className="num">MRR</th>
                  <th>CM</th>
                  <th>FNRH</th>
                  <th>Último login</th>
                  <th className="num">Alertas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={selected === p.id ? "selected" : ""} onClick={() => setSelected(p.id)}>
                    <td>
                      <div className="cell-strong">{p.name}</div>
                      <div className="cell-mute">{p.city}</div>
                    </td>
                    <td>
                      <div>{p.client}</div>
                    </td>
                    <td>
                      <PlanBadge plan={p.plan} />
                    </td>
                    <td className="num">{p.units}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <div className="bar thin" style={{ width: 50 }}>
                          <span style={{ width: `${p.occupancy14}%`, background: p.occupancy14 >= 80 ? "var(--brand)" : "rgba(255,255,255,0.25)" }} />
                        </div>
                        <span className="mono dim" style={{ fontSize: 11 }}>
                          {p.occupancy14}%
                        </span>
                      </div>
                    </td>
                    <td className="num">{fmtBRL(p.revenueForecast)}</td>
                    <td className="num">{p.mrr ? fmtBRL(p.mrr) : <span className="muted">—</span>}</td>
                    <td>
                      <CMBadge status={p.cmStatus} />
                    </td>
                    <td>
                      <FNRHBadge status={p.fnrh} />
                    </td>
                    <td className="mono dim">{p.lastLogin.slice(5, 10)} · {p.lastLogin.slice(11, 16)}</td>
                    <td className="num">
                      {p.alerts > 0 ? (
                        <Badge tone={p.alerts >= 3 ? "danger" : "warning"} dot>
                          {p.alerts}
                        </Badge>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 1 }}>
                        <button
                          className="icon-btn"
                          type="button"
                          title="Visualizar como propriedade"
                          onClick={(e) => {
                            e.stopPropagation();
                            onImpersonate(p.name, p.id);
                          }}
                        >
                          <Icon name="eye" size={12} />
                        </button>
                        <button className="icon-btn" type="button" title="Mais ações">
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

        {selProp && (
          <PropertyDetail
            prop={selProp}
            onImpersonate={onImpersonate}
            saasOrigin={saasOrigin}
            onNavigateView={onNavigateView}
          />
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div className={`filter-chip ${value !== options[0] ? "active" : ""}`} onClick={() => setOpen(!open)}>
        <span className="muted">{label}:</span>
        <span style={{ color: "inherit" }}>{value}</span>
        <Icon name="chevron-down" size={11} />
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 5,
            background: "var(--surface-2)",
            border: "1px solid var(--line-strong)",
            borderRadius: 8,
            padding: 4,
            minWidth: 140,
            boxShadow: "0 12px 24px -8px rgba(0,0,0,0.4)",
          }}
        >
          {options.map((o) => (
            <div
              key={o}
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
              style={{
                padding: "6px 10px",
                fontSize: 12,
                cursor: "pointer",
                borderRadius: 5,
                color: o === value ? "var(--brand)" : "var(--text)",
                background: o === value ? "rgba(24,211,154,0.06)" : "transparent",
              }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyDetail({
  prop,
  onImpersonate,
  saasOrigin,
  onNavigateView,
}: {
  prop: PropertySummary;
  onImpersonate: (name: string, id?: string) => void;
  saasOrigin: string;
  onNavigateView?: ViewPropertiesProps["onNavigateView"];
}) {
  const openInSaas = (path: string = "/") => {
    try {
      const url = new URL(saasOrigin + path);
      url.searchParams.set("propertyId", prop.id);
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    } catch {
      /* no-op */
    }
  };
  const initials = prop.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="panel" style={{ position: "sticky", top: 0 }}>
      <div style={{ padding: 16, borderBottom: "1px solid var(--line)" }}>
        <div className="row" style={{ gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "linear-gradient(135deg, #233040, #131A22)",
              border: "1px solid var(--line-strong)",
              display: "grid",
              placeItems: "center",
              color: "var(--text-hi)",
              fontFamily: "Instrument Sans",
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            {initials}
          </div>
          <div className="grow">
            <div className="hi" style={{ fontSize: 14, fontWeight: 500 }}>
              {prop.name}
            </div>
            <div className="muted text-xs">
              {prop.client} · {prop.city}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: "wrap" }}>
          {StatusBadges[prop.status]}
          <PlanBadge plan={prop.plan} />
          {prop.tags.includes("safe-env") && <Badge tone="violet">ambiente seguro</Badge>}
          {prop.tags.includes("trial") && <Badge tone="info">trial 4/14d</Badge>}
          {prop.tags.includes("fatura-vencida") && (
            <Badge tone="danger" pulse dot>
              fatura vencida
            </Badge>
          )}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <span className="muted text-xs" style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Health score
          </span>
          <span className="font-display" style={{ fontSize: 18, color: "var(--text-hi)" }}>
            {prop.health}
          </span>
        </div>
        <div className="bar" style={{ height: 6 }}>
          <span
            style={{
              width: `${prop.health}%`,
              background:
                prop.health >= 90
                  ? "var(--brand)"
                  : prop.health >= 70
                    ? "var(--info)"
                    : prop.health >= 50
                      ? "var(--warning)"
                      : "var(--danger)",
            }}
          />
        </div>
      </div>

      <div style={{ padding: "4px 16px 14px" }}>
        <div className="kv">
          <span className="k">MRR</span>
          <span className="v">{prop.mrr ? fmtBRL(prop.mrr) : "—"}</span>
        </div>
        <div className="kv">
          <span className="k">Total de unidades</span>
          <span className="v">{prop.units}</span>
        </div>
        <div className="kv">
          <span className="k">Ocupação hoje</span>
          <span className="v">{prop.occupancyToday}%</span>
        </div>
        <div className="kv">
          <span className="k">Receita prevista 30d</span>
          <span className="v">{fmtBRL(prop.revenueForecast)}</span>
        </div>
        <div className="kv">
          <span className="k">Channel Manager</span>
          <span className="v">
            <CMBadge status={prop.cmStatus} />
          </span>
        </div>
        <div className="kv">
          <span className="k">FNRH</span>
          <span className="v">
            <FNRHBadge status={prop.fnrh} />
          </span>
        </div>
        <div className="kv">
          <span className="k">Gateway</span>
          <span className="v">
            {prop.gateway === "on" ? (
              <Badge tone="success" dot>
                conectado
              </Badge>
            ) : (
              <Badge tone="ghost">desligado</Badge>
            )}
          </span>
        </div>
        <div className="kv">
          <span className="k">Última sincronização</span>
          <span className="v">{prop.lastSync.slice(11, 16)}</span>
        </div>
        <div className="kv">
          <span className="k">Último login</span>
          <span className="v">{prop.lastLogin.slice(5, 10)} · {prop.lastLogin.slice(11, 16)}</span>
        </div>
      </div>

      <div style={{ padding: 16, borderTop: "1px solid var(--line)" }}>
        <button
          className="btn primary"
          type="button"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={() => onImpersonate(prop.name, prop.id)}
        >
          <Icon name="eye" size={13} /> Entrar como superadmin
        </button>
        <div className="row" style={{ gap: 6, marginTop: 8 }}>
          <button
            className="btn grow"
            type="button"
            style={{ justifyContent: "center" }}
            onClick={() => onNavigateView?.("cm")}
            title={
              prop.cm === "off"
                ? "Channel Manager ainda não conectado para esta propriedade — abrir visão global"
                : "Abrir Channel Manager"
            }
          >
            <Icon name="git-branch" size={12} /> Channel Manager
          </button>
          <button
            className="btn grow"
            type="button"
            style={{ justifyContent: "center" }}
            onClick={() => openInSaas("/")}
            title="Abrir o mapa operacional no Roomix SaaS"
          >
            <Icon name="map" size={12} /> Mapa operacional
          </button>
        </div>
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          <button
            className="btn grow ghost"
            type="button"
            style={{ justifyContent: "center" }}
            onClick={() => onNavigateView?.("payments", prop.id)}
            title="Abrir Pagamentos & Faturas"
          >
            <Icon name="receipt" size={12} /> Billing
          </button>
          <button
            className="btn grow ghost"
            type="button"
            style={{ justifyContent: "center" }}
            onClick={() => onNavigateView?.("agent-center", prop.id)}
            title="Abrir Agent Center"
          >
            <Icon name="sparkles" size={12} /> Agentes
          </button>
          <button
            className="btn grow ghost"
            type="button"
            style={{ justifyContent: "center" }}
            onClick={() => onNavigateView?.("logs", prop.id)}
            title="Abrir Logs & Auditoria filtrado por esta propriedade"
          >
            <Icon name="file-text" size={12} /> Logs
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- CSV export -------------------------------------------------
function exportPropertiesCsv(rows: PropertySummary[]) {
  if (rows.length === 0) return;
  const header = [
    "id",
    "name",
    "city",
    "country",
    "client",
    "plan",
    "status",
    "units",
    "occupancyToday",
    "mrr",
    "cm",
    "fnrh",
    "overbookings",
    "lastSync",
    "lastLogin",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        csvEscape(r.name),
        csvEscape(r.city),
        csvEscape(r.country),
        csvEscape(r.client),
        csvEscape(String(r.plan)),
        r.status,
        String(r.units),
        String(r.occupancyToday),
        String(r.mrr),
        r.cm,
        r.fnrh,
        String(r.overbookings),
        r.lastSync,
        r.lastLogin,
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `roomix-properties-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
