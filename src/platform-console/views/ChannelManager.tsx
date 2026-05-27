import React, { useState } from "react";
import { Badge, CMBadge, ChannelPill, DemoSourceHint, Icon, Metric, Panel, SectionHeader } from "../components";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { useToast } from "../components/Toast";
import type { ConsoleOverview } from "../types";

async function callCmAction(action: string): Promise<{ ok: boolean; message?: string; code?: string }> {
  const response = await fetch("/api/platform/channel-manager/action", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action }),
  });
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const code = typeof payload?.error === "string" ? (payload.error as string) : `HTTP_${response.status}`;
    throw new Error(code);
  }
  return {
    ok: Boolean(payload.ok),
    message: typeof payload.message === "string" ? (payload.message as string) : undefined,
  };
}

export function ViewChannelManager({ data }: { data: ConsoleOverview }) {
  const errors = data.cmFeed.filter((q) => q.status === "err").length;
  const warns = data.cmFeed.filter((q) => q.status === "warn").length;
  const outboxTotal = data.cmTable.reduce((s, r) => s + r.outbox, 0);
  const mappingMissing = data.cmTable.filter((r) => r.mapping === "err" || r.mapping === "warn").length;
  const toast = useToast();

  const [openAction, setOpenAction] = useState<null | "test-webhook" | "replay-outbox" | "reprocess-all">(null);

  const handleAction = async (action: "test-webhook" | "replay-outbox" | "reprocess-all") => {
    try {
      const res = await callCmAction(action);
      toast.show(res.message || `Channel Manager · ${action} ok`, "brand");
    } catch (err) {
      const code = err instanceof Error ? err.message : "FAILED";
      if (code === "CHANNEL_MANAGER_BRIDGE_NOT_CONNECTED") {
        toast.show("Ação registrada — bridge Channel Manager ainda não conectado. Nenhuma alteração externa.", "warn");
      } else {
        toast.show(`Falha: ${code}`, "danger");
      }
      throw err;
    }
  };

  return (
    <div className="stack-y">
      <SectionHeader
        title="Channel Manager"
        sub="Conexão Roomix Console ↔ Roomix Channel Manager · Homologation"
        action={
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" type="button" onClick={() => setOpenAction("test-webhook")}>
              <Icon name="webhook" size={12} /> Testar webhook
            </button>
            <button className="btn ghost" type="button" onClick={() => setOpenAction("replay-outbox")}>
              <Icon name="refresh-cw" size={12} /> Replay outbox
            </button>
            <button className="btn primary" type="button" onClick={() => setOpenAction("reprocess-all")}>
              <Icon name="zap" size={12} /> Reprocessar tudo
            </button>
          </div>
        }
      />

      <ConfirmActionModal
        open={openAction === "test-webhook"}
        onClose={() => setOpenAction(null)}
        title="Testar webhook do Channel Manager"
        sub="Leitura honesta do modo atual · sem chamar OTA"
        icon="webhook"
        severity="brand"
        confirmLabel="Executar teste"
        details={[
          "Consulta CHANNEL_MANAGER_MODE no backend.",
          "Não chama Booking, Airbnb ou Expedia.",
          "Audit log: platform_channel_manager_action.",
        ]}
        onConfirm={async () => {
          await handleAction("test-webhook");
        }}
      />

      <ConfirmActionModal
        open={openAction === "replay-outbox"}
        onClose={() => setOpenAction(null)}
        title="Replay da outbox"
        sub="Reprocessar eventos pendentes/failed"
        icon="refresh-cw"
        severity="warn"
        confirmLabel="Disparar replay"
        details={[
          "Reenfileira eventos da outbox que falharam ou ficaram pending.",
          "Idempotente — eventos já entregues não são duplicados.",
          "Hoje a bridge não está conectada — o backend grava audit log e retorna 501.",
        ]}
        requireJustification
        justificationPlaceholder="Motivo do replay · ex.: falha de sync detectada em Pousada X às 14h"
        onConfirm={async () => {
          await handleAction("replay-outbox");
        }}
      />

      <ConfirmActionModal
        open={openAction === "reprocess-all"}
        onClose={() => setOpenAction(null)}
        title="Reprocessar TUDO"
        sub="Ação ampla — reavalia eventos, mappings e incidentes"
        icon="alert-octagon"
        severity="danger"
        confirmLabel="Confirmar reprocessamento"
        typedConfirmation="REPROCESSAR"
        requireJustification
        justificationPlaceholder="Motivo do reprocesso global"
        details={[
          "Reavalia incidentes abertos, mappings e fila do outbox.",
          "Não ativa OTA real. Não muda Channel Manager production.",
          "Hoje a bridge não está conectada — o backend grava audit log e retorna 501.",
          "Use somente após coordenar com Security/Operations.",
        ]}
        onConfirm={async () => {
          await handleAction("reprocess-all");
        }}
      />

      <DemoSourceHint source={data.source} />

      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid rgba(24,211,154,0.18)",
          borderRadius: 12,
          padding: "16px 18px",
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(24,211,154,0.10)",
            border: "1px solid rgba(24,211,154,0.22)",
            color: "#18D39A",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <Icon name="shield" size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-hi)", marginBottom: 4 }}>
            Estado seguro atual · Channel Manager em homologação
          </div>
          <div style={{ fontSize: 12, color: "var(--text-mute)", lineHeight: 1.55, marginBottom: 10 }}>
            Fluxos de inbound webhook, replay de outbox e reprocessamento estão{" "}
            <strong className="hi">preparados</strong>, mas{" "}
            <strong className="hi">não disparam alterações reais</strong> nos canais (Booking, Airbnb, Expedia)
            enquanto o modo production não for habilitado.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11 }}>
            <Badge tone="success" dot>
              HMAC gate · ativo
            </Badge>
            <Badge tone="success" dot>
              Inbound webhooks · OK
            </Badge>
            <Badge tone="warning" dot>
              Outbox worker · desligado
            </Badge>
            <Badge tone="danger" dot>
              OTA real · desligado
            </Badge>
            <Badge tone="danger" dot>
              Channel Manager production · desligado
            </Badge>
          </div>
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: "pointer", fontSize: 11.5, color: "var(--brand)" }}>
              Caminho para ativar produção (5 itens)
            </summary>
            <ol
              style={{
                paddingLeft: 18,
                marginTop: 8,
                color: "var(--text-mute)",
                fontSize: 11.5,
                lineHeight: 1.6,
              }}
            >
              <li>Validar credenciais de cada canal em homologação (Booking partner, Airbnb host, Expedia QuickConnect).</li>
              <li>
                Configurar <span className="mono">CHANNEL_MANAGER_MODE=production</span> e{" "}
                <span className="mono">CHANNEL_MANAGER_OUTBOX_WORKER_ENABLED=true</span> no SaaS.
              </li>
              <li>
                Definir <span className="mono">CHANNEL_MANAGER_WEBHOOK_SECRET</span> (HMAC) e revisar gate de
                origem.
              </li>
              <li>Aprovação humana do Security Agent + assinatura de operações.</li>
              <li>Rodar Testar webhook + verificar mapping por propriedade antes de liberar replay automático.</li>
            </ol>
          </details>
        </div>
      </div>

      <div className="grid-metrics">
        <Metric label="Status geral" value="OK" icon="activity" ctx="Homologation Mode" accent="brand" />
        <Metric label="Propriedades conectadas" value={String(data.cmTable.filter((r) => r.inbound !== "off").length)} unit={`/${data.cmTable.length}`} icon="building-2" />
        <Metric label="Mapping missing" value={String(mappingMissing)} icon="alert-triangle" accent={mappingMissing > 0 ? "warning" : undefined} />
        <Metric label="Falhas sync" value={String(errors)} icon="x-circle" accent={errors > 0 ? "danger" : undefined} />
        <Metric label="Avisos sync" value={String(warns)} icon="alert-triangle" accent={warns > 0 ? "warning" : undefined} />
        <Metric label="Outbox pendente" value={String(outboxTotal)} icon="send" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14, alignItems: "start" }}>
        <Panel title="Propriedades × Canais" icon="git-branch" sub="status de mapping e sync" dense>
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Propriedade</th>
                  <th style={{ textAlign: "center" }}>Booking</th>
                  <th style={{ textAlign: "center" }}>Airbnb</th>
                  <th style={{ textAlign: "center" }}>Expedia</th>
                  <th style={{ textAlign: "center" }}>Direct</th>
                  <th>Mapping</th>
                  <th>Inbound</th>
                  <th className="num">Outbox</th>
                  <th>Último evento</th>
                </tr>
              </thead>
              <tbody>
                {data.cmTable.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <span className="cell-strong">{r.prop}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <ChannelPill status={r.booking} label="BKG" />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <ChannelPill status={r.airbnb} label="ABB" />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <ChannelPill status={r.expedia} label="EXP" />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <ChannelPill status={r.direct} label="DIR" />
                    </td>
                    <td>
                      <CMBadge status={r.mapping} />
                    </td>
                    <td>
                      <CMBadge status={r.inbound} />
                    </td>
                    <td className="num">
                      {r.outbox > 0 ? (
                        <Badge tone={r.outbox > 3 ? "danger" : "warning"} dot>
                          {r.outbox}
                        </Badge>
                      ) : (
                        <span className="muted">0</span>
                      )}
                    </td>
                    <td className="mono dim">{r.last}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="stack-y">
          <Panel title="Homologation Mode" icon="shield" sub="ambiente seguro">
            <div className="col">
              <ToggleRow label="Inbound webhooks" value="ON" tone="success" />
              <ToggleRow label="Mode" value="Homologação segura" tone="warning" />
              <ToggleRow label="Outbox worker" value="OFF" tone="warning" />
              <ToggleRow label="OTA real (booking · airbnb · expedia)" value="OFF" tone="danger" />
              <ToggleRow label="HMAC gate" value="ativo" tone="success" />
              <div className="notice danger" style={{ marginTop: 10 }}>
                <Icon name="alert-octagon" size={14} />
                <span>
                  <strong className="hi">Production</strong> requer aprovação humana e revisão do Security Agent.
                </span>
              </div>
            </div>
          </Panel>

          <Panel title="Fila Channel Manager" icon="list" sub="eventos recentes" dense>
            <div style={{ maxHeight: 320, overflow: "auto" }}>
              {data.cmFeed.map((q) => (
                <div key={q.id} className="timeline-row">
                  <div className={`timeline-icon ${q.status === "err" ? "danger" : q.status === "warn" ? "warn" : "info"}`}>
                    <Icon
                      name={q.evt.includes("mapping") ? "git-branch" : q.evt.includes("incident") ? "alert-octagon" : q.evt.includes("sync") ? "refresh-cw" : "inbox"}
                      size={12}
                    />
                  </div>
                  <div className="timeline-body">
                    <div className="timeline-title" style={{ fontSize: 12 }}>
                      <span className="mono" style={{ color: "var(--text-hi)" }}>
                        {q.evt}
                      </span>
                    </div>
                    <div className="timeline-meta">
                      {q.prop} · {q.channel} · {q.t}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
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
