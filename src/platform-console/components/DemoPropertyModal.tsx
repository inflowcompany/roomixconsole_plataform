// "Propriedade demo" — convenience flow that either opens an
// existing "Roomix Demo" property or creates one (idempotent on
// the name).
//
// Safety: this is just a property with a recognisable name. The
// Channel Manager provisioning step runs in mock mode like every
// other create — no real OTA, no real gateway, no FNRH production.

import React, { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { Icon } from "../components";
import { useConsoleData } from "../hooks/useConsoleData";
import { useToast } from "./Toast";

interface DemoPropertyModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (property: { id: string; name: string }) => void;
  saasOrigin?: string;
}

const DEMO_NAME = "Roomix Demo";

export function DemoPropertyModal({
  open,
  onClose,
  onCreated,
  saasOrigin = "http://localhost:3000",
}: DemoPropertyModalProps) {
  const { data, refresh } = useConsoleData();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const existing = useMemo(
    () => data.properties.find((p) => p.name.trim().toLowerCase() === DEMO_NAME.toLowerCase()),
    [data.properties],
  );

  const openExisting = () => {
    if (!existing) return;
    const url = new URL(saasOrigin + "/");
    url.searchParams.set("propertyId", existing.id);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
    onClose();
  };

  const handleCreate = async () => {
    if (submitting) return;
    setError(null);
    if (existing) {
      openExisting();
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/properties", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: DEMO_NAME,
          city: "Florianópolis",
          state: "SC",
          country: "BR",
          metadata: {
            plan: "Enterprise",
            clientName: "Roomix Internal",
            tags: ["safe-env", "demo"],
            createdVia: "platform-console-demo",
            internalNotes:
              "Ambiente seguro para QA, treinamento e validação de fluxos. Não misturar com cliente real.",
          },
        }),
      });
      const text = await response.text();
      const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (!response.ok) {
        const code = typeof payload?.error === "string" ? (payload.error as string) : `HTTP_${response.status}`;
        throw new Error(code);
      }
      const created = payload as { property?: { id?: string; name?: string }; id?: string; name?: string };
      const id = created.property?.id ?? created.id ?? "";
      const name = created.property?.name ?? created.name ?? DEMO_NAME;
      toast.show("Roomix Demo provisionada · ambiente seguro · sem cobrança", "brand");
      void refresh();
      if (onCreated && id) onCreated({ id, name });
      onClose();
    } catch (err) {
      const code = err instanceof Error ? err.message : "NETWORK_ERROR";
      setError(`Falha (${code}).`);
      toast.show(`Falha ao criar Roomix Demo: ${code}`, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ambiente Roomix Demo"
      sub="Propriedade interna para QA, treinamento e validação. Não envolve cliente real."
      icon="sparkles"
      width="md"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          {existing ? (
            <button type="button" className="btn primary" onClick={openExisting}>
              <Icon name="external-link" size={12} /> Abrir Roomix Demo existente
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? (
                <>
                  <Icon name="refresh-cw" size={12} /> Provisionando…
                </>
              ) : (
                <>
                  <Icon name="sparkles" size={12} /> Criar ambiente demo
                </>
              )}
            </button>
          )}
        </>
      }
    >
      {existing ? (
        <div className="notice info">
          <Icon name="check-circle-2" size={14} />
          <span>
            Já existe uma propriedade chamada <strong>{existing.name}</strong> ({existing.city || "—"}). Use o botão "Abrir
            Roomix Demo existente" para ir direto a ela no SaaS.
          </span>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.55 }}>
            Vou criar uma propriedade chamada <span className="mono hi">{DEMO_NAME}</span> no Roomix SaaS com plano
            Enterprise · ambiente seguro · localização Florianópolis/SC. Útil para:
          </p>
          <ul style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.6, paddingLeft: 18, marginTop: 4 }}>
            <li>QA dos fluxos do SaaS sem afetar cliente real</li>
            <li>Validar mudanças do Channel Manager em homologation</li>
            <li>Demonstrar o produto para um novo prospect</li>
            <li>Treinar equipe nova sem risco</li>
          </ul>
          <div className="notice warn" style={{ marginTop: 12 }}>
            <Icon name="lock" size={12} />
            <span>
              OTA real, gateway production e FNRH production continuam <strong>off</strong>. A criação não envolve cobrança
              real nem disparo de webhook externo.
            </span>
          </div>
        </>
      )}

      {error && <div className="pc-field-error" style={{ marginTop: 10 }}>{error}</div>}
    </Modal>
  );
}
