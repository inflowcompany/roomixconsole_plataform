// Generic "ação sensível, confirme antes" modal.
//
// Used by: Overbookings → Resolver / Ignorar, Channel Manager →
// Reprocessar tudo, and any future action that requires the operator
// to type a phrase or write a justification before the mutation runs.
//
// Never executes the action itself — the caller passes an async
// `onConfirm` that returns when the work is done. The modal shows
// loading state while it runs and closes on success.

import React, { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { Icon } from "../components";

interface ConfirmActionModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  icon?: string;
  /** Optional bullets explaining what the action will do. */
  details?: string[];
  /** Severity → color of the primary CTA. */
  severity?: "warn" | "danger" | "brand";
  /** Label of the primary action button. */
  confirmLabel: string;
  /** When set, operator must type this phrase before the button enables. */
  typedConfirmation?: string;
  /** When true, exposes a free-text input for a justification (required when truthy). */
  requireJustification?: boolean;
  /** Placeholder for the justification field, when shown. */
  justificationPlaceholder?: string;
  /** Async handler that performs the real action. Must throw on failure. */
  onConfirm: (justification?: string) => Promise<void>;
}

export function ConfirmActionModal({
  open,
  onClose,
  title,
  sub,
  icon,
  details,
  severity = "warn",
  confirmLabel,
  typedConfirmation,
  requireJustification = false,
  justificationPlaceholder,
  onConfirm,
}: ConfirmActionModalProps) {
  const [typed, setTyped] = useState("");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTyped("");
      setJustification("");
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  const typedOk = !typedConfirmation || typed.trim() === typedConfirmation;
  const justificationOk = !requireJustification || justification.trim().length > 3;
  const ready = typedOk && justificationOk && !submitting;

  const handleConfirm = async () => {
    if (!ready) return;
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(requireJustification ? justification.trim() : undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao executar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={title}
      sub={sub}
      icon={icon || "alert-triangle"}
      width="md"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            type="button"
            className={severity === "danger" ? "btn danger" : "btn primary"}
            onClick={handleConfirm}
            disabled={!ready}
          >
            {submitting ? (
              <>
                <Icon name="refresh-cw" size={12} /> Executando…
              </>
            ) : (
              <>
                <Icon name="check" size={12} /> {confirmLabel}
              </>
            )}
          </button>
        </>
      }
    >
      {details && details.length > 0 && (
        <ul style={{ margin: "0 0 14px", paddingLeft: 18, color: "var(--text)", fontSize: 12.5, lineHeight: 1.6 }}>
          {details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}

      {requireJustification && (
        <div className="pc-field">
          <span className="pc-field-label">Justificativa *</span>
          <textarea
            data-autofocus
            className="pc-field-textarea"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder={justificationPlaceholder || "Explique o motivo desta ação · ≥ 4 caracteres"}
            disabled={submitting}
            required
          />
        </div>
      )}

      {typedConfirmation && (
        <div className="pc-field">
          <span className="pc-field-label">
            Digite <span className="mono" style={{ color: "var(--brand)" }}>{typedConfirmation}</span> para confirmar
          </span>
          <input
            data-autofocus={!requireJustification ? true : undefined}
            className="pc-field-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={typedConfirmation}
            disabled={submitting}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      )}

      <div className="notice warn" style={{ marginTop: 8 }}>
        <Icon name="lock" size={12} />
        <span>
          Ação registrada em <span className="mono">audit_logs</span> com identidade do superadmin. OTA real / Channel Manager
          production continuam OFF.
        </span>
      </div>

      {error && (
        <div className="pc-field-error" style={{ marginTop: 8 }}>
          Falha: {error}
        </div>
      )}
    </Modal>
  );
}
