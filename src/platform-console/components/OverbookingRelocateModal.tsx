// "Realocar" — lista os quartos disponíveis (já validados pelo backend
// contra conflito no destino) e dispara o POST de relocate. Confirma
// e mostra erro real em vez de fingir sucesso.

import React, { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { Icon } from "../components";
import {
  overbookingsApi,
  type AvailableRoom,
  type PlatformOverbookingRow,
} from "../services/overbookingsApi";
import { useToast } from "./Toast";

interface Props {
  open: boolean;
  onClose: () => void;
  row: PlatformOverbookingRow | null;
  onDone: () => void;
}

export function OverbookingRelocateModal({ open, onClose, row, onDone }: Props) {
  const [rooms, setRooms] = useState<AvailableRoom[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open || !row) {
      setRooms([]);
      setSelected("");
      setNotes("");
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    overbookingsApi
      .availableRooms(row.propertyId, row.id)
      .then((res) => {
        setRooms(res.availableRooms || []);
        setCurrentRoomId(res.currentRoomId || null);
        const first = res.availableRooms?.find((r) => !r.isCurrent);
        if (first) setSelected(first.id);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, row]);

  const handleRelocate = async () => {
    if (!row || !selected || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await overbookingsApi.relocate(row.propertyId, row.id, selected, notes.trim() || undefined);
      toast.show(`Reserva realocada · ${row.propertyName}`, "brand");
      onDone();
      onClose();
    } catch (err) {
      const code = err instanceof Error ? err.message : "FAILED";
      setError(code);
      toast.show(`Falha ao realocar: ${code}`, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="Realocar reserva"
      sub={row ? `${row.propertyName} · ${row.unit || "—"}` : ""}
      icon="arrow-right-left"
      width="lg"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleRelocate}
            disabled={!selected || submitting || loading}
          >
            {submitting ? (
              <>
                <Icon name="refresh-cw" size={12} /> Realocando…
              </>
            ) : (
              <>
                <Icon name="arrow-right-left" size={12} /> Confirmar realocação
              </>
            )}
          </button>
        </>
      }
    >
      {loading && <div className="muted">Carregando quartos disponíveis…</div>}

      {error && !rooms.length && <div className="pc-field-error">{error}</div>}

      {!loading && rooms.length > 0 && (
        <>
          <div className="pc-field-label" style={{ marginBottom: 8 }}>
            Quartos válidos para esta reserva
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflow: "auto" }}>
            {rooms.map((r) => {
              const isCurrent = r.id === currentRoomId;
              const isSelected = r.id === selected;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => !isCurrent && setSelected(r.id)}
                  disabled={isCurrent || submitting}
                  className={`pc-prop-row`}
                  style={{
                    background: isSelected ? "rgba(24,211,154,0.06)" : "var(--surface-2)",
                    borderColor: isSelected ? "rgba(24,211,154,0.55)" : "rgba(255,255,255,0.06)",
                    opacity: isCurrent ? 0.5 : 1,
                    cursor: isCurrent ? "not-allowed" : "pointer",
                  }}
                >
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div>{r.name || r.code || r.id}</div>
                    <div>
                      {r.code && r.code !== (r.name || "") ? r.code : ""} {isCurrent ? "(atual · conflito)" : ""}
                    </div>
                  </div>
                  {isSelected ? <Icon name="check" size={14} color="var(--brand)" /> : null}
                </button>
              );
            })}
          </div>

          <div className="pc-field" style={{ marginTop: 12 }}>
            <span className="pc-field-label">Notas internas (opcional)</span>
            <textarea
              className="pc-field-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: hóspede contatado · transferência confirmada"
              disabled={submitting}
            />
          </div>
        </>
      )}

      {!loading && rooms.length === 0 && !error && (
        <div className="notice warn">
          <Icon name="alert-triangle" size={14} />
          <span>
            Não há quartos disponíveis no destino. Realocação manual ainda é possível pelo SaaS, com fluxo dedicado de operações.
          </span>
        </div>
      )}

      <div className="notice info" style={{ marginTop: 10 }}>
        <Icon name="lock" size={12} />
        <span>
          Ação registrada em <span className="mono">audit_logs</span>. OTA real / Channel Manager production continuam OFF —
          alteração permanece em homologation/internamente.
        </span>
      </div>

      {error && rooms.length > 0 && <div className="pc-field-error" style={{ marginTop: 8 }}>Falha: {error}</div>}
    </Modal>
  );
}
