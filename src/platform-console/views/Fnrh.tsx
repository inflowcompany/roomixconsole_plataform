import React from "react";
import { Badge, DemoSourceHint, FNRHBadge, Icon, Metric, Panel, SectionHeader } from "../components";
import type { ConsoleOverview } from "../types";

export function ViewFNRH({ data }: { data: ConsoleOverview }) {
  const active = data.fnrh.filter((r) => r.status === "ok").length;
  const pending = data.fnrh.reduce((s, r) => s + r.pending, 0);
  const errs = data.fnrh.reduce((s, r) => s + r.err, 0);
  const checkinsTotal = data.fnrh.reduce((s, r) => s + r.checkins, 0);
  const cadasturExpired = data.fnrh.filter((r) => r.cadastur === "expirado").length;

  return (
    <div className="stack-y">
      <SectionHeader
        title="FNRH · Compliance"
        sub="Acompanhe envios obrigatórios e CADASTUR por propriedade"
      />

      <DemoSourceHint source={data.source} />

      <div className="notice info">
        <Icon name="lock" size={14} />
        <span>FNRH production está <strong>desligado</strong>. Reenviar pendências exige aprovação humana.</span>
      </div>

      <div className="grid-metrics">
        <Metric label="FNRH ativo" value={String(active)} unit={`/${data.fnrh.length}`} icon="shield-check" accent="brand" />
        <Metric label="Pendências envio" value={String(pending)} icon="clock" accent={pending > 0 ? "warning" : undefined} />
        <Metric label="Erros integração" value={String(errs)} icon="x-circle" accent={errs > 0 ? "danger" : undefined} />
        <Metric label="Check-ins" value={String(checkinsTotal)} icon="user-x" />
        <Metric label="Cadastur expirado" value={String(cadasturExpired)} icon="badge-alert" accent={cadasturExpired > 0 ? "warning" : undefined} />
      </div>

      <Panel title="Status por propriedade" icon="shield-check" sub="conformidade FNRH" dense>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Propriedade</th>
                <th>CADASTUR</th>
                <th>FNRH</th>
                <th className="num">Check-ins hoje</th>
                <th className="num">Pendências</th>
                <th>Último envio</th>
                <th className="num">Erros</th>
              </tr>
            </thead>
            <tbody>
              {data.fnrh.map((r, i) => (
                <tr key={i}>
                  <td>
                    <span className="cell-strong">{r.prop}</span>
                  </td>
                  <td>
                    {r.cadastur === "ativo" && (
                      <Badge tone="success" dot>
                        ativo
                      </Badge>
                    )}
                    {r.cadastur === "expirado" && (
                      <Badge tone="danger" dot pulse>
                        expirado
                      </Badge>
                    )}
                    {r.cadastur === "n/a" && <Badge tone="ghost">n/a</Badge>}
                  </td>
                  <td>
                    <FNRHBadge status={r.status} />
                  </td>
                  <td className="num">{r.checkins}</td>
                  <td className="num">
                    {r.pending > 0 ? <Badge tone="warning">{r.pending}</Badge> : <span className="muted">0</span>}
                  </td>
                  <td className="mono dim">{r.last}</td>
                  <td className="num">
                    {r.err > 0 ? <Badge tone="danger">{r.err}</Badge> : <span className="muted">0</span>}
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
