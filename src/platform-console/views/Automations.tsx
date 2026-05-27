import React from "react";
import { Badge, DemoSourceHint, Icon, Panel, SectionHeader } from "../components";
import type { ConsoleOverview } from "../types";

const STATIC_FLOWS = [
  { name: "Realocação automática de overbooking", trigger: "overbooking.detected", actions: 4, runs24: 14, last: "há 4 min", status: "on" },
  { name: "Dunning fatura vencida", trigger: "invoice.overdue", actions: 3, runs24: 2, last: "há 1d", status: "on" },
  { name: "FNRH · envio noturno", trigger: "cron: 22:00", actions: 2, runs24: 1, last: "há 14h", status: "gated" },
  { name: "Replay CM outbox falho", trigger: "cm.sync.failed", actions: 2, runs24: 7, last: "há 12 min", status: "on" },
  { name: "Onboarding nova propriedade", trigger: "property.created", actions: 8, runs24: 1, last: "há 22 min", status: "on" },
  { name: "Notificar hóspede · realocação", trigger: "reservation.realocated", actions: 1, runs24: 3, last: "há 18 min", status: "gated" },
  { name: "Upsell automático Growth → Evolution", trigger: "occupancy > 85% (14d)", actions: 1, runs24: 0, last: "há 4d", status: "paused" },
];

export function ViewAutomations({ data }: { data: ConsoleOverview }) {
  return (
    <div className="stack-y">
      <SectionHeader
        title="Automações"
        sub={`Workflows orquestrados pelo Jarvis · ${STATIC_FLOWS.length} automações`}
        action={
          <button
            className="btn"
            type="button"
            disabled
            title="Runtime de automações ainda não conectado · criação de workflow novo em sprint futura"
          >
            <Icon name="plus" size={12} /> Nova automação
          </button>
        }
      />

      <DemoSourceHint source={data.source} />

      <div className="notice info">
        <Icon name="lock" size={14} />
        <span>
          <strong className="hi">Workflows internos da Roomix.</strong> Esta lista descreve o que cada automação{" "}
          <em>fará</em> quando o runtime estiver conectado. Disparar workflow exige aprovação humana — nenhuma execução
          automática real acontece nesta sprint.
        </span>
      </div>

      <Panel title="Workflows" icon="workflow" dense>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Automação</th>
                <th>Trigger</th>
                <th className="num">Ações</th>
                <th className="num">Execuções 24h</th>
                <th>Última execução</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {STATIC_FLOWS.map((f, i) => (
                <tr key={i}>
                  <td>
                    <span className="cell-strong">{f.name}</span>
                  </td>
                  <td className="mono dim">{f.trigger}</td>
                  <td className="num">{f.actions}</td>
                  <td className="num">{f.runs24}</td>
                  <td className="mono dim">{f.last}</td>
                  <td>
                    {f.status === "on" && (
                      <Badge tone="success" dot>
                        ativo
                      </Badge>
                    )}
                    {f.status === "paused" && (
                      <Badge tone="warning" dot>
                        pausado
                      </Badge>
                    )}
                    {f.status === "gated" && (
                      <Badge tone="info" dot>
                        requer aprovação
                      </Badge>
                    )}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 1, justifyContent: "flex-end" }}>
                      <button
                        className="icon-btn"
                        type="button"
                        disabled
                        title="Runtime de automações ainda não conectado — Play indisponível"
                        style={{ opacity: 0.4, cursor: "not-allowed" }}
                      >
                        <Icon name="play" size={12} />
                      </button>
                      <button
                        className="icon-btn"
                        type="button"
                        disabled
                        title="Detalhes do workflow disponíveis quando o runtime estiver conectado"
                        style={{ opacity: 0.4, cursor: "not-allowed" }}
                      >
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
    </div>
  );
}
