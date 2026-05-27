import React from "react";
import { Badge, DemoSourceHint, Icon, Metric, PlanBadge, Panel, RiskPill, SectionHeader, fmtBRL } from "../components";
import type { ConsoleOverview, ClientSummary } from "../types";

export function ViewClients({ data }: { data: ConsoleOverview }) {
  const totalMRR = data.clients.reduce((s, c) => s + c.mrr, 0);
  const totalARR = totalMRR * 12;
  const overdue = data.clients.filter((c) => c.status === "overdue");
  const trialing = data.clients.filter((c) => c.status === "trial");

  return (
    <div className="stack-y">
      <SectionHeader
        title="Clientes & Planos"
        sub="Visão comercial · MRR, churn risk e oportunidades"
        action={
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn ghost"
              type="button"
              onClick={() => exportClientsCsv(data.clients)}
              disabled={data.clients.length === 0}
              title={data.clients.length === 0 ? "Sem clientes para exportar" : "Baixar CSV (sem secrets)"}
            >
              <Icon name="download" size={12} /> Exportar CSV
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled
              title="Sincronização de gateway/provedor de pagamento ainda não conectada"
            >
              <Icon name="refresh-cw" size={12} /> Sincronizar provedor
            </button>
            <button
              className="btn"
              type="button"
              disabled
              title="Provedor de pagamento real ainda não plugado · clientes seguem o cadastro da propriedade"
            >
              <Icon name="plus" size={12} /> Novo cliente
            </button>
          </div>
        }
      />

      <div className="notice info">
        <Icon name="info" size={14} />
        <span>
          Hoje os clientes são derivados das propriedades. O cadastro como entidade separada (com gateway/provedor de
          pagamento próprio) entra na próxima sprint e os botões acima ficam <strong className="hi">desabilitados</strong>
          até lá — sem fake success.
        </span>
      </div>

      <DemoSourceHint source={data.source} />

      <div className="grid-metrics">
        <Metric label="MRR total" value={`${(totalMRR / 1000).toFixed(1)}k`} unit="BRL" icon="trending-up" accent="brand" />
        <Metric label="ARR estimado" value={`${(totalARR / 1000).toFixed(0)}k`} unit="BRL" icon="line-chart" />
        <Metric label="Clientes ativos" value={String(data.clients.filter((c) => c.status === "paid").length)} icon="users" />
        <Metric
          label="Em trial"
          value={String(trialing.length)}
          icon="hourglass"
          ctx={trialing[0] ? trialing[0].name : undefined}
          accent="info"
        />
        <Metric
          label="Faturas vencidas"
          value={String(overdue.length)}
          icon="receipt"
          accent={overdue.length > 0 ? "danger" : undefined}
          ctx={overdue.length > 0 ? "ação comercial necessária" : undefined}
        />
        <Metric
          label="Churn risk"
          value={String(data.clients.filter((c) => c.risk === "high" || c.risk === "critical").length)}
          icon="alert-triangle"
          accent="warning"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14, alignItems: "start" }}>
        <Panel title="Clientes" icon="users" sub={`${data.clients.length} clientes`} dense>
          <div className="tbl-scroll" style={{ maxHeight: "calc(100vh - 320px)" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Propriedade</th>
                  <th>Plano</th>
                  <th className="num">UH</th>
                  <th className="num">Mensal</th>
                  <th>Status</th>
                  <th>Próxima fatura</th>
                  <th>Última fatura</th>
                  <th>Add-ons</th>
                  <th>Risco</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="cell-strong">{c.name}</span>
                    </td>
                    <td>{c.property}</td>
                    <td>
                      <PlanBadge plan={c.plan} />
                    </td>
                    <td className="num">{c.units}</td>
                    <td className="num">{c.mrr ? fmtBRL(c.mrr) : <span className="muted">trial</span>}</td>
                    <td>
                      {c.status === "paid" && (
                        <Badge tone="success" dot>
                          em dia
                        </Badge>
                      )}
                      {c.status === "overdue" && (
                        <Badge tone="danger" dot pulse>
                          vencida
                        </Badge>
                      )}
                      {c.status === "trial" && (
                        <Badge tone="info" dot>
                          trial
                        </Badge>
                      )}
                      {c.status === "pending" && (
                        <Badge tone="info" dot>
                          aguardando
                        </Badge>
                      )}
                    </td>
                    <td className="mono dim">{c.next}</td>
                    <td className="mono dim">{c.last}</td>
                    <td>
                      <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                        {c.addons.length === 0 ? (
                          <span className="muted text-xs">—</span>
                        ) : (
                          c.addons.map((a) => (
                            <Badge key={a} tone="neutral">
                              {a}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td>{c.risk ? <RiskPill risk={c.risk} /> : <span className="muted">—</span>}</td>
                    <td>
                      <button className="icon-btn" type="button" aria-label="Mais ações">
                        <Icon name="more-horizontal" size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="stack-y">
          <Panel title="Distribuição por plano" icon="pie-chart">
            <div className="col" style={{ gap: 10 }}>
              {data.plansData.map((p) => (
                <div key={p.plan}>
                  <div className="row-between" style={{ marginBottom: 4 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="health-dot" style={{ background: p.color, boxShadow: "none" }} />
                      <span className="text-sm hi">{p.plan}</span>
                    </div>
                    <span className="mono dim text-xs">
                      {p.clients} · {p.mrr ? fmtBRL(p.mrr) : "—"}
                    </span>
                  </div>
                  <div className="bar">
                    <span style={{ width: `${(p.mrr / 7000) * 100}%`, background: p.color }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Risco comercial" icon="alert-triangle" sub={`${data.clients.filter((c) => c.risk).length} sinais detectados`}>
            <div className="col" style={{ gap: 10 }}>
              {data.clients
                .filter((c) => c.risk)
                .slice(0, 6)
                .map((c) => (
                  <div
                    key={c.id}
                    style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px dashed var(--line-faint)" }}
                  >
                    <div
                      className={`timeline-icon ${c.risk === "critical" || c.risk === "high" ? "danger" : "warn"}`}
                      style={{ width: 26, height: 26 }}
                    >
                      <Icon name="alert-triangle" size={13} />
                    </div>
                    <div className="grow">
                      <div className="text-sm hi">{c.name}</div>
                      <div className="text-xs muted">{c.property}</div>
                    </div>
                    <RiskPill risk={c.risk ?? null} />
                  </div>
                ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function exportClientsCsv(rows: ClientSummary[]) {
  if (rows.length === 0) return;
  const header = [
    "id",
    "name",
    "property",
    "plan",
    "units",
    "mrr",
    "status",
    "next",
    "last",
    "addons",
    "risk",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        csvEscape(r.name),
        csvEscape(r.property),
        csvEscape(String(r.plan)),
        String(r.units),
        String(r.mrr),
        r.status,
        r.next,
        r.last,
        csvEscape(r.addons.join("; ")),
        r.risk || "",
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `roomix-clients-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
