// "Ver conflito" — read-only drawer/modal that shows everything the
// backend knows about an incident. Pure leitura, sem botão de ação.

import React, { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { Badge, Icon, SevBadge } from "../components";
import {
  overbookingsApi,
  type IncidentDetail,
  type PlatformOverbookingRow,
} from "../services/overbookingsApi";

interface Props {
  open: boolean;
  onClose: () => void;
  row: PlatformOverbookingRow | null;
}

export function OverbookingDetailModal({ open, onClose, row }: Props) {
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !row) {
      setDetail(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    overbookingsApi
      .detail(row.propertyId, row.id)
      .then((res) => setDetail(res.incident))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, row]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Conflito de reserva"
      sub={row ? `${row.propertyName} · ${row.unit || "—"}` : ""}
      icon="git-compare"
      width="lg"
      footer={
        <button type="button" className="btn primary" onClick={onClose} style={{ justifyContent: "center" }}>
          Fechar
        </button>
      }
    >
      {!row ? (
        <div className="muted">Sem incidente selecionado.</div>
      ) : (
        <div className="stack-y" style={{ gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <KV label="Status">
              {row.status === "open" ? (
                <Badge tone="danger" dot pulse>
                  aberto
                </Badge>
              ) : row.status === "resolved" ? (
                <Badge tone="success" dot>
                  resolvido
                </Badge>
              ) : (
                <Badge tone="neutral">{row.status}</Badge>
              )}
            </KV>
            <KV label="Severidade">
              <SevBadge sev={row.severity} />
            </KV>
            <KV label="Propriedade" value={row.propertyName} />
            <KV label="Cidade" value={row.propertyCity || "—"} />
            <KV label="Unidade" value={row.unit || "—"} mono />
            <KV label="Canal" value={row.channel || "—"} mono />
            <KV label="Período" value={row.period || "—"} mono />
            <KV label="Criado em" value={row.createdAt.slice(0, 16).replace("T", " · ")} mono />
            <KV label="Reserva recebida" value={row.incoming || "—"} mono />
            <KV label="Reserva existente" value={row.existing || "—"} mono />
          </div>

          {loading && (
            <div className="muted text-xs" style={{ padding: 8 }}>
              Carregando detalhes do backend…
            </div>
          )}

          {error && (
            <div className="pc-field-error">
              Não consegui carregar o detalhe completo: {error}. Os dados da lista continuam visíveis acima.
            </div>
          )}

          {detail && (
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10,
                padding: 14,
                background: "rgba(255,255,255,0.02)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <KV label="Check-in" value={detail.checkInDate || "—"} mono />
              <KV label="Check-out" value={detail.checkOutDate || "—"} mono />
              {detail.roomLabel && <KV label="Quarto/UH" value={detail.roomLabel} mono />}
              {detail.notes && <KV label="Notas" value={detail.notes} />}
            </div>
          )}

          <div className="notice info">
            <Icon name="lock" size={12} />
            <span>
              Vista somente leitura. Para realocar, resolver ou ignorar este incidente, use os botões da linha na tabela. Toda
              ação é auditada.
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
}

function KV({ label, value, children, mono }: { label: string; value?: string; children?: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="pc-field-label">{label}</div>
      <div className={mono ? "mono hi" : "hi"} style={{ fontSize: 12.5, marginTop: 4, color: "var(--text-hi)" }}>
        {children ?? value ?? "—"}
      </div>
    </div>
  );
}
