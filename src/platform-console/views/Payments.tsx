import React from "react";
import { Badge, DemoSourceHint, Icon, Metric, Panel, SectionHeader, fmtBRL } from "../components";
import type { ConsoleOverview } from "../types";

interface InvoiceRow {
  id: string;
  client: string;
  prop: string;
  amount: number;
  status: "paid" | "overdue" | "pending";
  next: string;
  last: string;
}

export function ViewPayments({ data }: { data: ConsoleOverview }) {
  // Derive invoice-like rows from clients dataset. Real backend will
  // ultimately replace this with the billing service payload.
  const invoices = data.clients.map((c, i) => {
    const status: "paid" | "overdue" | "pending" =
      c.status === "overdue" ? "overdue" : c.status === "paid" ? "paid" : "pending";
    return {
      id: `INV-2026-05-${String(80 + i).padStart(3, "0")}`,
      client: c.name,
      prop: c.property,
      amount: c.mrr,
      status,
      next: c.next,
      last: c.last,
    };
  });

  const totalIssued = invoices.reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount, 0);
  const totalOverdue = invoices
    .filter((i) => i.status === "overdue")
    .reduce((s, i) => s + i.amount, 0);
  const totalPending = invoices
    .filter((i) => i.status === "pending")
    .reduce((s, i) => s + i.amount, 0);

  return (
    <div className="stack-y">
      <SectionHeader
        title="Pagamentos & Faturas"
        sub="Visão financeira global · ações sensíveis exigem confirmação humana"
        action={
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn ghost"
              type="button"
              onClick={() => exportInvoicesCsv(invoices)}
              disabled={invoices.length === 0}
              title={invoices.length === 0 ? "Sem faturas para exportar" : "Baixar CSV (sem secrets)"}
            >
              <Icon name="download" size={12} /> Export CSV
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled
              title="Gateway de pagamento real ainda não conectado · gerar fatura manual indisponível"
            >
              <Icon name="plus" size={12} /> Gerar fatura manual
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled
              title="Disparador de dunning ainda não conectado · sem envio real"
            >
              <Icon name="alert-octagon" size={12} /> Dunning vencidas
            </button>
          </div>
        }
      />

      <DemoSourceHint source={data.source} />

      <div className="notice info">
        <Icon name="lock" size={14} />
        <span>
          Esta tela é <strong>somente leitura</strong>. Disparar fatura, alterar plano e alterar gateway exigem aprovação humana e ainda não estão habilitados no Platform Console.
        </span>
      </div>

      <div className="grid-metrics">
        <Metric label="Faturado mai/26" value={`${(totalIssued / 1000).toFixed(1)}k`} unit="BRL" icon="receipt" accent="brand" />
        <Metric label="Recebido" value={`${(totalPaid / 1000).toFixed(1)}k`} unit="BRL" icon="check-circle-2" />
        <Metric label="Em aberto" value={`${(totalPending / 1000).toFixed(1)}k`} unit="BRL" icon="hourglass" accent="warning" />
        <Metric
          label="Vencidas"
          value={`${(totalOverdue / 1000).toFixed(1)}k`}
          unit="BRL"
          icon="alert-octagon"
          accent={totalOverdue > 0 ? "danger" : undefined}
        />
      </div>

      <Panel title="Faturas" icon="receipt" sub={`${invoices.length} resultados`} dense>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Propriedade</th>
                <th>Status</th>
                <th>Próxima</th>
                <th>Última</th>
                <th className="num">Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td>
                    <span className="mono cell-strong">{i.id}</span>
                  </td>
                  <td>{i.client}</td>
                  <td className="muted">{i.prop}</td>
                  <td>
                    {i.status === "paid" && (
                      <Badge tone="success" dot>
                        paga
                      </Badge>
                    )}
                    {i.status === "pending" && (
                      <Badge tone="info" dot>
                        aguardando
                      </Badge>
                    )}
                    {i.status === "overdue" && (
                      <Badge tone="danger" dot pulse>
                        vencida
                      </Badge>
                    )}
                  </td>
                  <td className="mono dim">{i.next}</td>
                  <td className="mono dim">{i.last}</td>
                  <td className="num cell-strong">{fmtBRL(i.amount)}</td>
                  <td>
                    <div className="row" style={{ gap: 1 }}>
                      <button
                        className="icon-btn"
                        type="button"
                        title="Backend de faturas ainda não conectado · detalhe completo em breve"
                        disabled
                        style={{ opacity: 0.4, cursor: "not-allowed" }}
                      >
                        <Icon name="external-link" size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function exportInvoicesCsv(rows: InvoiceRow[]) {
  if (rows.length === 0) return;
  const header = ["id", "client", "property", "amount", "status", "next", "last"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        csvEscape(r.client),
        csvEscape(r.prop),
        String(r.amount),
        r.status,
        r.next,
        r.last,
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `roomix-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
