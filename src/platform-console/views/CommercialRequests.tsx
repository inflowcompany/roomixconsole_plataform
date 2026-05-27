// Solicitações Comerciais — Console operator dashboard.
//
// Consumes /api/platform/commercial-requests (GET + PATCH). Lists every
// request a property has made from the SaaS (e.g. "quero o Channel
// Manager", "quero upgrade pro plano Evolution"). Operator can move
// each one through the lifecycle: requested → in_review → approved /
// rejected → completed / cancelled.
//
// No mock, no fabrication: empty list shows an honest empty state,
// failures show the backend error code.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Icon, Metric, Panel, SectionHeader } from "../components";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import {
  commercialRequestsApi,
  isPendingStatus,
  type CommercialRequest,
  type CommercialRequestStatus,
} from "../services/commercialRequestsApi";

interface ViewCommercialRequestsProps {
  onOpenProperty?: (propertyId: string) => void;
}

type Tab = "all" | "pending" | "approved" | "rejected" | "done";

const TAB_DEFS: Array<{ id: Tab; label: string }> = [
  { id: "pending", label: "Pendentes" },
  { id: "approved", label: "Aprovadas" },
  { id: "rejected", label: "Rejeitadas" },
  { id: "done", label: "Concluídas/canceladas" },
  { id: "all", label: "Todas" },
];

const MODULE_LABEL: Record<string, string> = {
  upgrade: "Upgrade de plano",
  integrated_payments: "Pagamentos integrados",
  channel_manager: "Channel Manager",
  fnrh_production: "FNRH Digital",
  agents: "Agentes Roomix",
};

function moduleLabel(module: string): string {
  return MODULE_LABEL[module] || module;
}

const STATUS_TONE: Record<CommercialRequestStatus, "danger" | "warning" | "success" | "neutral" | "info" | "ghost"> = {
  requested: "warning",
  in_review: "info",
  approved: "success",
  rejected: "danger",
  completed: "neutral",
  cancelled: "ghost",
};

const STATUS_LABEL: Record<CommercialRequestStatus, string> = {
  requested: "solicitado",
  in_review: "em análise",
  approved: "aprovado",
  rejected: "rejeitado",
  completed: "concluído",
  cancelled: "cancelado",
};

interface PendingAction {
  request: CommercialRequest;
  nextStatus: CommercialRequestStatus;
}

export function ViewCommercialRequests({ onOpenProperty }: ViewCommercialRequestsProps = {}) {
  const [tab, setTab] = useState<Tab>("pending");
  const [rows, setRows] = useState<CommercialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [detailRequest, setDetailRequest] = useState<CommercialRequest | null>(null);
  const toast = useToast();

  const refresh = useCallback(
    (silent = false) => {
      setLoading(true);
      setError(null);
      commercialRequestsApi
        .list(200)
        .then((list) => {
          setRows(list);
          setLoading(false);
          if (!silent) toast.show(`Solicitações atualizadas · ${list.length} registro(s)`, "brand");
        })
        .catch((err: Error) => {
          // eslint-disable-next-line no-console
          console.warn("[platform-console] commercial-requests load failed:", err.message);
          setRows([]);
          setError(err.message);
          setLoading(false);
          if (!silent) toast.show(`Falha ao atualizar: ${err.message}`, "danger");
        });
    },
    [toast],
  );

  useEffect(() => {
    refresh(true); // silent on mount — toast only on explicit Atualizar click
  }, [refresh]);

  const totals = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let done = 0;
    for (const r of rows) {
      if (isPendingStatus(r.status)) pending++;
      else if (r.status === "approved") approved++;
      else if (r.status === "rejected") rejected++;
      else done++;
    }
    return { pending, approved, rejected, done, all: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    if (tab === "pending") return rows.filter((r) => isPendingStatus(r.status));
    if (tab === "approved") return rows.filter((r) => r.status === "approved");
    if (tab === "rejected") return rows.filter((r) => r.status === "rejected");
    return rows.filter((r) => r.status === "completed" || r.status === "cancelled");
  }, [rows, tab]);

  return (
    <div className="stack-y">
      <SectionHeader
        title="Solicitações Comerciais"
        sub={`Pedidos vindos do SaaS · ${totals.pending} pendente(s) · ${totals.approved} aprovadas`}
        action={
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" type="button" onClick={() => refresh(false)} disabled={loading}>
              <Icon name="refresh-cw" size={12} /> Atualizar
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                if (rows.length === 0) {
                  toast.show("Nenhuma solicitação para exportar", "warn");
                  return;
                }
                exportCsv(rows);
                toast.show(`CSV exportado · ${rows.length} solicitação(ões)`, "brand");
              }}
              title={rows.length === 0 ? "Nenhuma solicitação para exportar" : "Baixar CSV"}
            >
              <Icon name="download" size={12} /> Export CSV
            </button>
          </div>
        }
      />

      {error && (
        <div className="notice danger">
          <Icon name="x-circle" size={14} />
          <span>
            Falha ao carregar solicitações: <span className="mono">{error}</span>.
          </span>
        </div>
      )}

      <div className="grid-metrics" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
        <Metric
          label="Pendentes"
          value={String(totals.pending)}
          icon="inbox"
          accent={totals.pending > 0 ? "warning" : undefined}
        />
        <Metric label="Aprovadas" value={String(totals.approved)} icon="check-circle-2" accent="brand" />
        <Metric label="Rejeitadas" value={String(totals.rejected)} icon="x-circle" />
        <Metric label="Concluídas/canceladas" value={String(totals.done)} icon="archive" />
        <Metric label="Total" value={String(totals.all)} icon="list" />
      </div>

      <Panel
        title="Pedidos de propriedades"
        icon="message-square"
        sub={`${filtered.length} resultado(s)`}
        action={
          <div className="tabs" style={{ border: "none", margin: 0 }}>
            {TAB_DEFS.map((t) => (
              <div key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                {t.label} (
                {t.id === "all"
                  ? totals.all
                  : t.id === "pending"
                  ? totals.pending
                  : t.id === "approved"
                  ? totals.approved
                  : t.id === "rejected"
                  ? totals.rejected
                  : totals.done}
                )
              </div>
            ))}
          </div>
        }
        dense
      >
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Status</th>
                <th>Módulo</th>
                <th>Plano</th>
                <th>Propriedade</th>
                <th>Mensagem</th>
                <th>Origem</th>
                <th>Criado</th>
                <th>Atualizado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 24, color: "var(--text-mute)" }}>
                    Carregando solicitações do backend…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 24, color: "var(--text-mute)" }}>
                    {tab === "pending"
                      ? "Sem solicitações pendentes. Excelente."
                      : "Nenhuma solicitação nesta aba."}
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Badge tone={STATUS_TONE[r.status]} dot={isPendingStatus(r.status)} pulse={r.status === "requested"}>
                        {STATUS_LABEL[r.status]}
                      </Badge>
                    </td>
                    <td>
                      <span className="cell-strong">{moduleLabel(r.requestedModule)}</span>
                    </td>
                    <td className="mono dim">{r.requestedPlan || "—"}</td>
                    <td className="mono dim" title={r.propertyId}>
                      {shortenId(r.propertyId)}
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      {r.message ? (
                        <span style={{ fontSize: 12, color: "var(--text)" }}>{truncate(r.message, 120)}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="mono dim" style={{ fontSize: 11 }}>
                      {r.sourcePage || "—"}
                    </td>
                    <td className="mono dim" style={{ fontSize: 11 }}>
                      {formatTs(r.createdAt)}
                    </td>
                    <td className="mono dim" style={{ fontSize: 11 }}>
                      {r.updatedAt && r.updatedAt !== r.createdAt ? formatTs(r.updatedAt) : "—"}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 1 }}>
                        <button
                          className="icon-btn"
                          type="button"
                          title="Ver detalhes"
                          onClick={() => setDetailRequest(r)}
                        >
                          <Icon name="eye" size={12} />
                        </button>
                        {onOpenProperty && (
                          <button
                            className="icon-btn"
                            type="button"
                            title="Abrir propriedade"
                            onClick={() => onOpenProperty(r.propertyId)}
                          >
                            <Icon name="external-link" size={12} />
                          </button>
                        )}
                        <RowActions
                          request={r}
                          onAction={(next) => setPendingAction({ request: r, nextStatus: next })}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <ConfirmActionModal
        open={!!pendingAction}
        onClose={() => setPendingAction(null)}
        title={pendingAction ? actionTitle(pendingAction.nextStatus) : ""}
        sub={
          pendingAction
            ? `${moduleLabel(pendingAction.request.requestedModule)}${pendingAction.request.requestedPlan ? ` · ${pendingAction.request.requestedPlan}` : ""}`
            : ""
        }
        icon={actionIcon(pendingAction?.nextStatus)}
        severity={actionSeverity(pendingAction?.nextStatus)}
        confirmLabel={pendingAction ? actionConfirmLabel(pendingAction.nextStatus) : "Confirmar"}
        details={pendingAction ? actionDetails(pendingAction.nextStatus) : []}
        requireJustification={pendingAction?.nextStatus === "rejected" || pendingAction?.nextStatus === "cancelled"}
        justificationPlaceholder="Motivo (opcional para outros estados, obrigatório para rejeitar/cancelar)"
        onConfirm={async (justification) => {
          if (!pendingAction) return;
          const updated = await commercialRequestsApi.update(pendingAction.request.id, {
            status: pendingAction.nextStatus,
            message: justification ? justification.slice(0, 1000) : pendingAction.request.message,
          });
          toast.show(
            `Solicitação ${shortenId(updated.id)} → ${STATUS_LABEL[updated.status]}`,
            updated.status === "rejected" || updated.status === "cancelled" ? "warn" : "brand",
          );
          refresh(true);
        }}
      />

      <CommercialRequestDetailDrawer
        request={detailRequest}
        onClose={() => setDetailRequest(null)}
        onOpenProperty={onOpenProperty}
      />
    </div>
  );
}

function CommercialRequestDetailDrawer({
  request,
  onClose,
  onOpenProperty,
}: {
  request: CommercialRequest | null;
  onClose: () => void;
  onOpenProperty?: (propertyId: string) => void;
}) {
  if (!request) {
    return (
      <Modal open={false} onClose={onClose} title="">
        <div />
      </Modal>
    );
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={moduleLabel(request.requestedModule)}
      sub={`${STATUS_LABEL[request.status]}${request.requestedPlan ? ` · ${request.requestedPlan}` : ""}`}
      icon="message-square"
      width="lg"
      headerActions={
        onOpenProperty && (
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              onOpenProperty(request.propertyId);
              onClose();
            }}
          >
            <Icon name="external-link" size={12} /> Abrir propriedade
          </button>
        )
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 16px", fontSize: 12 }}>
        <span className="muted" style={{ fontSize: 10.5, letterSpacing: 0.4 }}>STATUS</span>
        <span>
          <Badge tone={STATUS_TONE[request.status]} dot={isPendingStatus(request.status)}>
            {STATUS_LABEL[request.status]}
          </Badge>
        </span>

        <span className="muted" style={{ fontSize: 10.5, letterSpacing: 0.4 }}>MÓDULO</span>
        <span className="cell-strong">{moduleLabel(request.requestedModule)}</span>

        <span className="muted" style={{ fontSize: 10.5, letterSpacing: 0.4 }}>PLANO</span>
        <span className="mono">{request.requestedPlan || "—"}</span>

        <span className="muted" style={{ fontSize: 10.5, letterSpacing: 0.4 }}>PROPERTY ID</span>
        <span className="mono">{request.propertyId}</span>

        <span className="muted" style={{ fontSize: 10.5, letterSpacing: 0.4 }}>SOLICITANTE</span>
        <span className="mono">{request.requestedByUserId}</span>

        <span className="muted" style={{ fontSize: 10.5, letterSpacing: 0.4 }}>ORIGEM (sourcePage)</span>
        <span className="mono">{request.sourcePage || "—"}</span>

        <span className="muted" style={{ fontSize: 10.5, letterSpacing: 0.4 }}>CRIADO EM</span>
        <span className="mono">{request.createdAt}</span>

        <span className="muted" style={{ fontSize: 10.5, letterSpacing: 0.4 }}>ATUALIZADO EM</span>
        <span className="mono">{request.updatedAt}</span>

        <span className="muted" style={{ fontSize: 10.5, letterSpacing: 0.4 }}>ID</span>
        <span className="mono" style={{ fontSize: 11 }}>{request.id}</span>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="muted" style={{ fontSize: 10.5, letterSpacing: 0.4, marginBottom: 6 }}>
          MENSAGEM
        </div>
        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
            color: "var(--text)",
            minHeight: 60,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {request.message || <span className="muted">Sem mensagem.</span>}
        </div>
      </div>

      <div className="notice info" style={{ marginTop: 16 }}>
        <Icon name="shield" size={14} />
        <span>
          Mudar status nesta solicitação <strong>não ativa</strong> OTA, gateway, Channel Manager production
          ou FNRH production. Apenas registra a decisão da Roomix.
        </span>
      </div>
    </Modal>
  );
}

function RowActions({
  request,
  onAction,
}: {
  request: CommercialRequest;
  onAction: (next: CommercialRequestStatus) => void;
}) {
  // Lifecycle-aware buttons. Already-done states show nothing.
  if (request.status === "requested") {
    return (
      <div className="row" style={{ gap: 2 }}>
        <button className="icon-btn" type="button" title="Mover para em análise" onClick={() => onAction("in_review")}>
          <Icon name="eye" size={12} />
        </button>
        <button className="icon-btn" type="button" title="Aprovar" onClick={() => onAction("approved")}>
          <Icon name="check" size={12} />
        </button>
        <button className="icon-btn" type="button" title="Rejeitar" onClick={() => onAction("rejected")}>
          <Icon name="x" size={12} />
        </button>
      </div>
    );
  }
  if (request.status === "in_review") {
    return (
      <div className="row" style={{ gap: 2 }}>
        <button className="icon-btn" type="button" title="Aprovar" onClick={() => onAction("approved")}>
          <Icon name="check" size={12} />
        </button>
        <button className="icon-btn" type="button" title="Rejeitar" onClick={() => onAction("rejected")}>
          <Icon name="x" size={12} />
        </button>
      </div>
    );
  }
  if (request.status === "approved") {
    return (
      <div className="row" style={{ gap: 2 }}>
        <button
          className="icon-btn"
          type="button"
          title="Marcar como concluída"
          onClick={() => onAction("completed")}
        >
          <Icon name="check-circle-2" size={12} />
        </button>
        <button className="icon-btn" type="button" title="Cancelar" onClick={() => onAction("cancelled")}>
          <Icon name="x" size={12} />
        </button>
      </div>
    );
  }
  return <span className="muted text-xs">—</span>;
}

function actionTitle(status: CommercialRequestStatus): string {
  switch (status) {
    case "in_review":
      return "Mover para em análise";
    case "approved":
      return "Aprovar solicitação";
    case "rejected":
      return "Rejeitar solicitação";
    case "completed":
      return "Marcar como concluída";
    case "cancelled":
      return "Cancelar solicitação";
    default:
      return "Atualizar status";
  }
}

function actionConfirmLabel(status: CommercialRequestStatus): string {
  switch (status) {
    case "in_review":
      return "Confirmar análise";
    case "approved":
      return "Aprovar";
    case "rejected":
      return "Rejeitar";
    case "completed":
      return "Concluir";
    case "cancelled":
      return "Cancelar";
    default:
      return "Confirmar";
  }
}

function actionIcon(status: CommercialRequestStatus | undefined): string {
  if (status === "approved") return "check";
  if (status === "rejected") return "x";
  if (status === "completed") return "check-circle-2";
  if (status === "cancelled") return "x";
  return "eye";
}

function actionSeverity(status: CommercialRequestStatus | undefined): "brand" | "warn" | "danger" {
  if (status === "rejected" || status === "cancelled") return "warn";
  if (status === "approved" || status === "completed") return "brand";
  return "brand";
}

function actionDetails(status: CommercialRequestStatus): string[] {
  if (status === "in_review") {
    return [
      "Sinaliza ao requisitante que o pedido está sendo analisado.",
      "Audit log: commercial_request_status_updated.",
    ];
  }
  if (status === "approved") {
    return [
      "Marca a solicitação como aprovada.",
      "A ativação do módulo ainda exige passos manuais — esta ação não habilita feature flag nem cobra automaticamente.",
      "Audit log: commercial_request_status_updated.",
    ];
  }
  if (status === "rejected") {
    return [
      "Rejeita a solicitação sem mudar nada na propriedade.",
      "Justificativa é obrigatória para registro.",
      "Audit log: commercial_request_status_updated.",
    ];
  }
  if (status === "completed") {
    return [
      "Marca como concluída — implementação física do que foi solicitado já foi feita.",
      "Não toca em integração externa.",
    ];
  }
  return [
    "Cancela a solicitação. Justificativa obrigatória.",
    "Não reverte alterações já feitas — apenas registra o cancelamento.",
  ];
}

function formatTs(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month} · ${h}:${m}`;
}

function shortenId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function exportCsv(rows: CommercialRequest[]) {
  if (rows.length === 0) return;
  const header = [
    "id",
    "status",
    "requestedModule",
    "requestedPlan",
    "propertyId",
    "requestedByUserId",
    "message",
    "sourcePage",
    "createdAt",
    "updatedAt",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.status,
        csvEscape(r.requestedModule),
        csvEscape(r.requestedPlan ?? ""),
        r.propertyId,
        r.requestedByUserId,
        csvEscape(r.message ?? ""),
        csvEscape(r.sourcePage ?? ""),
        r.createdAt,
        r.updatedAt,
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `roomix-commercial-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
