// Overbookings — central global de incidentes.
//
// Lista vem do aggregator real `/api/platform/overbookings`. Cada
// ação (ver, realocar, resolver, ignorar) chama o endpoint real
// per-property que já existe no SaaS. Nada de mock.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Icon, Metric, Panel, SectionHeader, SevBadge } from "../components";
import { overbookingsApi, type PlatformOverbookingRow } from "../services/overbookingsApi";
import { OverbookingDetailModal } from "../components/OverbookingDetailModal";
import { OverbookingRelocateModal } from "../components/OverbookingRelocateModal";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { useToast } from "../components/Toast";

type Tab = "all" | "open" | "resolved" | "ignored";

export function ViewOverbookings() {
  const [tab, setTab] = useState<Tab>("open");
  const [rows, setRows] = useState<PlatformOverbookingRow[]>([]);
  const [totals, setTotals] = useState<{ open: number; resolved: number; ignored: number; all: number }>({
    open: 0, resolved: 0, ignored: 0, all: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"backend" | "error">("backend");
  const toast = useToast();

  // Modais
  const [detailRow, setDetailRow] = useState<PlatformOverbookingRow | null>(null);
  const [relocateRow, setRelocateRow] = useState<PlatformOverbookingRow | null>(null);
  const [resolveRow, setResolveRow] = useState<PlatformOverbookingRow | null>(null);
  const [ignoreRow, setIgnoreRow] = useState<PlatformOverbookingRow | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    overbookingsApi
      .list()
      .then((res) => {
        setRows(res.incidents);
        setTotals(res.totals);
        setSource("backend");
        setLoading(false);
      })
      .catch((err: Error) => {
        // eslint-disable-next-line no-console
        console.warn("[platform-console] overbookings load failed:", err.message);
        setRows([]);
        setError(err.message);
        setSource("error");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    return rows.filter((r) => r.status === tab);
  }, [rows, tab]);

  const mostAffected = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (r.status !== "open") continue;
      counts.set(r.propertyName, (counts.get(r.propertyName) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
  }, [rows]);

  return (
    <div className="stack-y">
      <SectionHeader
        title="Overbookings"
        sub={`Central global · ${totals.open} abertos · ${totals.resolved} resolvidos · ${totals.ignored} ignorados`}
        action={
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" type="button" onClick={refresh} disabled={loading}>
              <Icon name="refresh-cw" size={12} /> Atualizar
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => exportCsv(rows)}
              disabled={rows.length === 0}
              title={rows.length === 0 ? "Nenhum incidente para exportar" : "Baixar CSV"}
            >
              <Icon name="download" size={12} /> Relatório CSV
            </button>
          </div>
        }
      />

      {source === "error" && (
        <div className="notice danger">
          <Icon name="x-circle" size={14} />
          <span>
            Falha ao carregar incidentes: <span className="mono">{error}</span>.
          </span>
        </div>
      )}

      <div className="grid-metrics">
        <Metric label="Abertos" value={String(totals.open)} icon="alert-octagon" accent={totals.open > 0 ? "danger" : undefined} />
        <Metric label="Resolvidos" value={String(totals.resolved)} icon="check-circle-2" accent="brand" />
        <Metric label="Ignorados" value={String(totals.ignored)} icon="x" />
        <Metric label="Total no escopo" value={String(totals.all)} icon="list" />
        <Metric
          label="Maior afetada"
          value={mostAffected ? mostAffected[0].split(" ")[0] : "—"}
          icon="building-2"
          ctx={mostAffected ? `${mostAffected[1]} incidente(s)` : undefined}
        />
      </div>

      <Panel
        title="Conflitos de reserva"
        icon="alert-octagon"
        sub={`${filtered.length} resultados`}
        action={
          <div className="tabs" style={{ border: "none", margin: 0 }}>
            <div className={`tab ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>Todos ({totals.all})</div>
            <div className={`tab ${tab === "open" ? "active" : ""}`} onClick={() => setTab("open")}>Abertos ({totals.open})</div>
            <div className={`tab ${tab === "resolved" ? "active" : ""}`} onClick={() => setTab("resolved")}>Resolvidos ({totals.resolved})</div>
            <div className={`tab ${tab === "ignored" ? "active" : ""}`} onClick={() => setTab("ignored")}>Ignorados ({totals.ignored})</div>
          </div>
        }
        dense
      >
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Status</th>
                <th>Severidade</th>
                <th>Propriedade</th>
                <th>UH</th>
                <th>Canal</th>
                <th>Período</th>
                <th>Reserva recebida</th>
                <th>Reserva existente</th>
                <th>Criado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: 24, color: "var(--text-mute)" }}>
                    Carregando incidentes do backend…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: 24, color: "var(--text-mute)" }}>
                    {tab === "open"
                      ? "Sem overbookings abertos. Excelente."
                      : "Sem registros nesta aba."}
                  </td>
                </tr>
              )}
              {!loading && filtered.map((o) => (
                <tr key={`${o.propertyId}-${o.id}`}>
                  <td>
                    {o.status === "open" && <Badge tone="danger" dot pulse>aberto</Badge>}
                    {o.status === "resolved" && <Badge tone="success" dot>resolvido</Badge>}
                    {o.status === "ignored" && <Badge tone="ghost">ignorado</Badge>}
                  </td>
                  <td><SevBadge sev={o.severity} /></td>
                  <td><span className="cell-strong">{o.propertyName}</span></td>
                  <td className="mono">{o.unit || "—"}</td>
                  <td>
                    {o.channel ? (
                      <span className={`ch-pill ${o.status === "resolved" ? "on" : o.severity === "crit" ? "err" : "warn"}`} style={{ width: 40 }}>
                        {o.channel.slice(0, 3).toUpperCase()}
                      </span>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td className="mono">{o.period || "—"}</td>
                  <td className="mono dim">{o.incoming || "—"}</td>
                  <td className="mono dim">{o.existing || "—"}</td>
                  <td className="mono dim">{o.createdAt.slice(11, 16)}</td>
                  <td>
                    <div className="row" style={{ gap: 1 }}>
                      <button
                        className="icon-btn"
                        type="button"
                        title="Ver conflito"
                        onClick={() => setDetailRow(o)}
                      >
                        <Icon name="git-compare" size={12} />
                      </button>
                      {o.status === "open" && (
                        <>
                          <button
                            className="icon-btn"
                            type="button"
                            title="Realocar"
                            onClick={() => setRelocateRow(o)}
                          >
                            <Icon name="arrow-right-left" size={12} />
                          </button>
                          <button
                            className="icon-btn"
                            type="button"
                            title="Marcar resolvido"
                            onClick={() => setResolveRow(o)}
                          >
                            <Icon name="check" size={12} />
                          </button>
                          <button
                            className="icon-btn"
                            type="button"
                            title="Ignorar"
                            onClick={() => setIgnoreRow(o)}
                          >
                            <Icon name="x" size={12} />
                          </button>
                        </>
                      )}
                      {(o.status === "resolved" || o.status === "ignored") && (
                        <span className="muted text-xs">por {o.resolvedBy || "—"}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <OverbookingDetailModal
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        row={detailRow}
      />

      <OverbookingRelocateModal
        open={!!relocateRow}
        onClose={() => setRelocateRow(null)}
        row={relocateRow}
        onDone={refresh}
      />

      <ConfirmActionModal
        open={!!resolveRow}
        onClose={() => setResolveRow(null)}
        title="Marcar como resolvido"
        sub={resolveRow ? `${resolveRow.propertyName} · ${resolveRow.unit || "—"}` : ""}
        icon="check"
        severity="brand"
        confirmLabel="Marcar resolvido"
        details={[
          "Muda o status do incidente para resolved no audit log e na tabela do SaaS.",
          "Não dispara OTA real. Não reembolsa hóspede.",
        ]}
        onConfirm={async () => {
          if (!resolveRow) return;
          await overbookingsApi.resolve(resolveRow.propertyId, resolveRow.id);
          toast.show(`Incidente ${resolveRow.id.slice(0, 8)} resolvido`, "brand");
          refresh();
        }}
      />

      <ConfirmActionModal
        open={!!ignoreRow}
        onClose={() => setIgnoreRow(null)}
        title="Ignorar incidente"
        sub={ignoreRow ? `${ignoreRow.propertyName} · ${ignoreRow.unit || "—"}` : ""}
        icon="x"
        severity="warn"
        confirmLabel="Confirmar ignorar"
        requireJustification
        justificationPlaceholder="Por que este incidente pode ser ignorado? Ex.: reserva-fantasma, hóspede confirmou cancelamento."
        details={[
          "Move o incidente para o estado ignored — não é deletado.",
          "Aparece na aba 'Ignorados'. Pode ser revisado depois.",
        ]}
        onConfirm={async (justification) => {
          if (!ignoreRow || !justification) return;
          await overbookingsApi.ignore(ignoreRow.propertyId, ignoreRow.id, justification);
          toast.show(`Incidente ignorado · ${ignoreRow.propertyName}`, "warn");
          refresh();
        }}
      />
    </div>
  );
}

function exportCsv(rows: PlatformOverbookingRow[]) {
  if (rows.length === 0) return;
  const header = [
    "id", "propertyId", "propertyName", "status", "severity", "unit", "channel",
    "period", "incoming", "existing", "createdAt", "resolvedAt", "resolvedBy",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id, r.propertyId, csvEscape(r.propertyName), r.status, r.severity,
        csvEscape(r.unit ?? ""), csvEscape(r.channel ?? ""), csvEscape(r.period ?? ""),
        csvEscape(r.incoming ?? ""), csvEscape(r.existing ?? ""), r.createdAt,
        r.resolvedAt ?? "", csvEscape(r.resolvedBy ?? ""),
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `roomix-overbookings-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
