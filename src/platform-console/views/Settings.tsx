import React from "react";
import { Badge, DemoSourceHint, Icon, Panel, SectionHeader } from "../components";
import { TeamPanel } from "./TeamPanel";
import { IntegrationStatusPanel } from "./IntegrationStatusPanel";
import type { ConsoleOverview } from "../types";

export function ViewSettings({ data }: { data: ConsoleOverview }) {
  return (
    <div className="stack-y">
      <SectionHeader
        title="Configurações Internas"
        sub="Roomix Platform Console · ambiente, integrações, segurança"
      />

      <DemoSourceHint source={data.source} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Panel title="Ambiente" icon="layers">
          <div className="col" style={{ gap: 8 }}>
            <ConfRow
              label="Modo atual"
              value={
                <Badge tone="warning" dot>
                  Homologação segura
                </Badge>
              }
            />
            <ConfRow
              label="Fonte de dados"
              value={
                <Badge tone={data.source === "backend" ? "success" : "warning"} dot>
                  {data.source === "backend" ? "API do SaaS · ao vivo" : "demo dataset"}
                </Badge>
              }
            />
            <ConfRow label="Channel Manager production" value={<Badge tone="danger" dot>desligado</Badge>} />
            <ConfRow label="OTA real (Booking/Airbnb/Expedia)" value={<Badge tone="danger" dot>desligado</Badge>} />
            <ConfRow label="FNRH production" value={<Badge tone="danger" dot>desligado</Badge>} />
            <ConfRow label="Gateway de pagamento real" value={<Badge tone="danger" dot>desligado</Badge>} />
          </div>
          <div className="notice info" style={{ marginTop: 12 }}>
            <Icon name="shield" size={14} />
            <span>
              <strong className="hi">Ambiente em homologação segura.</strong> Fluxos preparados, mas integrações
              de produção (OTA, gateway, FNRH, worker) ficam bloqueadas até aprovação humana + revisão do Security
              Agent. Nenhuma ação real é disparada para canais externos.
            </span>
          </div>
        </Panel>

        <Panel title="Segurança" icon="shield">
          <div className="col" style={{ gap: 8 }}>
            <ConfRow label="Apenas superadmin" value={<Badge tone="success" dot>obrigatório</Badge>} />
            <ConfRow label="Cross-property guard" value={<Badge tone="success" dot>ativo</Badge>} />
            <ConfRow label="Tenant isolation (RLS)" value={<Badge tone="success" dot>ativo</Badge>} />
            <ConfRow label="Logs sanitizados" value={<Badge tone="success" dot>sem secrets/PII</Badge>} />
            <ConfRow label="Impersonation" value={<Badge tone="warning" dot>auditada</Badge>} />
          </div>
        </Panel>

        <Panel title="Integrações" icon="plug">
          <div className="col" style={{ gap: 8 }}>
            <ConfRow label="Stripe Connect" value={<Badge tone="ghost" dot>somente leitura</Badge>} />
            <ConfRow label="Booking.com" value={<Badge tone="warning" dot>homolog</Badge>} />
            <ConfRow label="Airbnb" value={<Badge tone="warning" dot>homolog</Badge>} />
            <ConfRow label="Expedia" value={<Badge tone="warning" dot>homolog</Badge>} />
            <ConfRow label="CADASTUR" value={<Badge tone="warning" dot>1 expirada</Badge>} />
          </div>
        </Panel>

        <TeamPanel />
      </div>

      <IntegrationStatusPanel />
    </div>
  );
}

function ConfRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="row-between text-sm" style={{ padding: "6px 0", borderBottom: "1px dashed var(--line-faint)" }}>
      <span className="muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
