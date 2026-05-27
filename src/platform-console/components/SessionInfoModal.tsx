// SessionInfoModal — "Minha sessão" detail for the operator.
//
// Pulled from GET /api/platform/session/me. The backend strips
// anything that could be replayed (no cookies, no token, no
// passwordHash). What the modal shows is exactly what the operator
// can already see in the profile chip + the public environment flags.

import React, { useCallback, useEffect, useState } from "react";
import { Badge, Icon } from "../components";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

interface SessionMeResponse {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    tenantId: string | null;
    mfaEnabled: boolean;
    mfaMethod: string | null;
  };
  session: {
    firstSeenAt: string;
    environment: string;
    channelManagerMode: string;
  };
  guarantees: {
    otaReal: boolean;
    channelManagerProduction: boolean;
    gatewayReal: boolean;
    fnrhProduction: boolean;
  };
  ts: string;
}

async function fetchSessionMe(): Promise<SessionMeResponse> {
  const response = await fetch("/api/platform/session/me", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    let code = `HTTP_${response.status}`;
    try {
      const txt = await response.text();
      const json = txt ? (JSON.parse(txt) as { error?: string }) : {};
      if (typeof json?.error === "string") code = json.error;
    } catch {
      // fall through
    }
    throw new Error(code);
  }
  return (await response.json()) as SessionMeResponse;
}

interface SessionInfoModalProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export function SessionInfoModal({ open, onClose, onLogout }: SessionInfoModalProps) {
  const [data, setData] = useState<SessionMeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchSessionMe());
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const copySnapshot = useCallback(() => {
    if (!data) return;
    // Sanitized snapshot — no token, no IP, no cookie. Operator can
    // safely share with support.
    const snap = {
      user: { name: data.user.name, email: data.user.email, role: data.user.role },
      session: data.session,
      guarantees: data.guarantees,
      ts: data.ts,
    };
    const txt = JSON.stringify(snap, null, 2);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(txt).then(
        () => toast.show("Snapshot da sessão copiado", "brand"),
        () => toast.show("Não foi possível copiar", "warn"),
      );
    }
  }, [data, toast]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="user"
      title="Minha sessão"
      sub="Snapshot sanitizado · sem cookies, sem token"
      width="lg"
      headerActions={
        <button className="btn ghost" type="button" onClick={load} disabled={loading}>
          <Icon name="refresh-cw" size={12} /> Recarregar
        </button>
      }
      footer={
        <>
          <button className="btn ghost" type="button" onClick={copySnapshot} disabled={!data}>
            <Icon name="clipboard" size={12} /> Copiar snapshot
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Fechar
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={() => {
              onLogout();
              onClose();
            }}
          >
            <Icon name="log-in" size={12} /> Sair
          </button>
        </>
      }
    >
      {error && (
        <div className="notice danger" style={{ marginBottom: 14 }}>
          <Icon name="x-circle" size={14} />
          <span>
            Falha ao carregar sessão: <span className="mono">{error}</span>
          </span>
        </div>
      )}

      {/* Usuário */}
      <div className="pc-section-head" style={{ marginTop: 0, paddingTop: 0 }}>
        <span className="pc-section-num">01</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Usuário</span>
          <span className="pc-section-sub">Identidade e papel da sessão atual</span>
        </div>
      </div>
      <Grid>
        <Row label="Nome" value={data?.user.name || "—"} strong />
        <Row label="E-mail" value={data?.user.email || "—"} mono />
        <Row label="Role" value={data?.user.role || "—"} mono />
        <Row label="User ID" value={data?.user.id || "—"} mono small />
        <Row label="Tenant" value={data?.user.tenantId || "—"} mono small />
        <Row
          label="MFA"
          value={
            data ? (
              <Badge tone={data.user.mfaEnabled ? "success" : "warning"} dot>
                {data.user.mfaEnabled ? `ativo (${data.user.mfaMethod || "?"})` : "desativado"}
              </Badge>
            ) : (
              "—"
            )
          }
        />
      </Grid>

      {/* Sessão */}
      <div className="pc-section-head">
        <span className="pc-section-num">02</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Sessão</span>
          <span className="pc-section-sub">Ambiente e modo do backend</span>
        </div>
      </div>
      <Grid>
        <Row
          label="Ambiente"
          value={
            data ? (
              <Badge tone={data.session.environment === "production" ? "danger" : "warning"} dot>
                {data.session.environment === "production" ? "Produção" : "Homologação segura"}
              </Badge>
            ) : (
              "—"
            )
          }
        />
        <Row label="Channel Manager Mode" value={data?.session.channelManagerMode || "—"} mono />
        <Row label="Capturado em" value={data?.session.firstSeenAt || "—"} mono small />
        <Row label="Snapshot ts" value={data?.ts || "—"} mono small />
      </Grid>

      {/* Garantias */}
      <div className="pc-section-head">
        <span className="pc-section-num">03</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Garantias de segurança</span>
          <span className="pc-section-sub">Ações sensíveis bloqueadas nesta sessão</span>
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {data ? (
          <>
            <GuaranteeBadge label="OTA real" on={data.guarantees.otaReal} />
            <GuaranteeBadge label="Channel Manager production" on={data.guarantees.channelManagerProduction} />
            <GuaranteeBadge label="Gateway real" on={data.guarantees.gatewayReal} />
            <GuaranteeBadge label="FNRH production" on={data.guarantees.fnrhProduction} />
          </>
        ) : (
          <span className="muted text-xs">Carregando…</span>
        )}
      </div>
    </Modal>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: "10px 16px",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  strong,
  small,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  strong?: boolean;
  small?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span
        style={{
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: "0.11em",
          color: "var(--text-mute)",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        className={mono ? "mono" : undefined}
        style={{
          fontSize: small ? 11 : 12,
          color: strong ? "#ECF0F5" : "#C7CFD9",
          fontWeight: strong ? 500 : 400,
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function GuaranteeBadge({ label, on }: { label: string; on: boolean }) {
  return (
    <Badge tone={on ? "danger" : "neutral"} dot={on}>
      {label} {on ? "ON" : "OFF"}
    </Badge>
  );
}
