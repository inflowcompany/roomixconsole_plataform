// "Abrir propriedade" — modal that lists real properties from the
// SaaS overview payload and lets the operator pick one to open in
// the Roomix SaaS (new tab, propertyId only, no token in URL).

import React, { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { Icon, PlanBadge, StatusBadges } from "../components";
import { useConsoleData } from "../hooks/useConsoleData";
import type { PropertySummary } from "../types";

interface OpenPropertyModalProps {
  open: boolean;
  onClose: () => void;
  /** Where the SaaS app is served. Defaults to localhost:3000 for dev. */
  saasOrigin?: string;
}

export function OpenPropertyModal({
  open,
  onClose,
  saasOrigin = "http://localhost:3000",
}: OpenPropertyModalProps) {
  const { data, loading, refresh } = useConsoleData();
  const [query, setQuery] = useState("");

  const list = useMemo<PropertySummary[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.properties;
    return data.properties.filter((p) =>
      [p.name, p.city, p.client, p.plan].some((v) => String(v || "").toLowerCase().includes(q)),
    );
  }, [data.properties, query]);

  const openInSaas = (prop: PropertySummary) => {
    const url = new URL(saasOrigin + "/");
    url.searchParams.set("propertyId", prop.id);
    // noopener+noreferrer keeps the new tab from sharing the same
    // window.opener reference (defence in depth — we never share a
    // session token, but a malicious tab could still navigate the
    // opener back without these flags).
    window.open(url.toString(), "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="external-link"
      title="Abrir propriedade no Roomix SaaS"
      sub="Escolha uma propriedade para abrir em nova aba. Nenhum token vai pela URL — apenas o propertyId."
      width="lg"
      headerActions={
        <button className="btn sm ghost" type="button" onClick={() => void refresh()} disabled={loading}>
          <Icon name="refresh-cw" size={11} /> Atualizar
        </button>
      }
    >
      <div className="pc-field" style={{ marginBottom: 8 }}>
        <span className="pc-field-label">Buscar</span>
        <input
          data-autofocus
          className="pc-field-input"
          placeholder="Nome, cidade, cliente, plano…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="pc-prop-list">
        {list.length === 0 && (
          <div className="muted text-xs" style={{ padding: 14, textAlign: "center" }}>
            {loading ? "Carregando…" : "Nenhuma propriedade encontrada."}
          </div>
        )}
        {list.map((prop) => (
          <div
            key={prop.id}
            className="pc-prop-row"
            onClick={() => openInSaas(prop)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openInSaas(prop);
              }
            }}
          >
            <div className="grow" style={{ minWidth: 0 }}>
              <div>{prop.name}</div>
              <div>
                {prop.city} · {prop.units} UH · {prop.client}
              </div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <PlanBadge plan={prop.plan} />
              {StatusBadges[prop.status] ?? null}
            </div>
            <Icon name="arrow-right" size={13} color="var(--text-dim)" />
          </div>
        ))}
      </div>

      <div className="notice info" style={{ marginTop: 12 }}>
        <Icon name="lock" size={12} />
        <span>Abrir abre o SaaS na propriedade selecionada · cookie de sessão first-party · sem token na URL.</span>
      </div>
    </Modal>
  );
}
