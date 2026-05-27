// SecurityInfoModal — read-only security overview for the operator.
//
// Aggregates what we KNOW honestly:
//   • MFA status from /api/platform/session/me
//   • Per-session guarantees (OTA off, gateway off, etc.)
//   • Roomix-wide hardening baseline (RLS, cross-property guard,
//     sanitized logs, superadmin-only platform endpoints)
//   • Pointer to Logs view for security audit events
//
// We never invent things that don't exist (e.g. no "sessions list"
// because there's no endpoint for it yet). Honest empty states win.

import React, { useCallback, useEffect, useState } from "react";
import { Badge, Icon } from "../components";
import { Modal } from "./Modal";

interface SessionMeResponse {
  user: { mfaEnabled: boolean; mfaMethod: string | null; role: string };
  session: { environment: string };
  guarantees: {
    otaReal: boolean;
    channelManagerProduction: boolean;
    gatewayReal: boolean;
    fnrhProduction: boolean;
  };
}

async function fetchSessionMe(): Promise<SessionMeResponse> {
  const response = await fetch("/api/platform/session/me", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return (await response.json()) as SessionMeResponse;
}

interface SecurityInfoModalProps {
  open: boolean;
  onClose: () => void;
  onOpenLogs: () => void;
}

export function SecurityInfoModal({ open, onClose, onOpenLogs }: SecurityInfoModalProps) {
  const [data, setData] = useState<SessionMeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchSessionMe());
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="shield"
      title="Segurança"
      sub="Configuração de segurança da sua sessão atual"
      width="lg"
      headerActions={
        <button className="btn ghost" type="button" onClick={load} disabled={loading}>
          <Icon name="refresh-cw" size={12} /> Recarregar
        </button>
      }
      footer={
        <>
          <button className="btn ghost" type="button" onClick={onClose}>
            Fechar
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={() => {
              onOpenLogs();
              onClose();
            }}
          >
            <Icon name="file-text" size={12} /> Ver logs de segurança
          </button>
        </>
      }
    >
      {error && (
        <div className="notice danger" style={{ marginBottom: 14 }}>
          <Icon name="x-circle" size={14} />
          <span>
            Falha ao carregar status: <span className="mono">{error}</span>
          </span>
        </div>
      )}

      {/* 01 · MFA + role */}
      <div className="pc-section-head" style={{ marginTop: 0, paddingTop: 0 }}>
        <span className="pc-section-num">01</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Sua identidade</span>
          <span className="pc-section-sub">Role e proteção da conta</span>
        </div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <Badge tone="info" dot>
          Role: {data?.user.role || "—"}
        </Badge>
        <Badge tone={data?.user.mfaEnabled ? "success" : "warning"} dot>
          MFA: {data?.user.mfaEnabled ? `ativo (${data.user.mfaMethod || "?"})` : "desativado"}
        </Badge>
        <Badge tone={data?.session.environment === "production" ? "danger" : "warning"} dot>
          Ambiente: {data?.session.environment === "production" ? "Produção" : "Homologação"}
        </Badge>
      </div>
      {data && !data.user.mfaEnabled && (
        <div className="notice warn" style={{ marginTop: 10 }}>
          <Icon name="lock" size={14} />
          <span>
            <strong className="hi">MFA não está ativo.</strong> Em produção, recomendamos exigir MFA para
            qualquer operador com role <span className="mono">SUPER_ADMIN_ROOMIX</span>.
          </span>
        </div>
      )}

      {/* 02 · Hardening baseline */}
      <div className="pc-section-head">
        <span className="pc-section-num">02</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Hardening do Roomix</span>
          <span className="pc-section-sub">Garantias arquiteturais ativas em todo request</span>
        </div>
      </div>
      <ul style={{ paddingLeft: 18, margin: 0, fontSize: 12, color: "var(--text)", lineHeight: 1.6 }}>
        <li>Endpoints <span className="mono">/api/platform/*</span> exigem role superadmin (cliente comum recebe 403).</li>
        <li>Cookies de sessão são <span className="mono">HttpOnly + SameSite=Lax + Secure</span> em produção.</li>
        <li>CSRF protegido por origin pinning na borda do proxy.</li>
        <li>Tenant isolation (RLS) ativo em todos os repositories — nenhum vazamento cross-tenant.</li>
        <li>Logs persistentes sanitizam <span className="mono">secret/token/password/api_key/cookie/authorization/hmac</span>.</li>
        <li>Impersonation entre propriedades sempre auditada (audit log + banner visível).</li>
        <li>Sem token em query string, sem chave LLM no frontend.</li>
      </ul>

      {/* 03 · Garantias de ação */}
      <div className="pc-section-head">
        <span className="pc-section-num">03</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Ações sensíveis bloqueadas</span>
          <span className="pc-section-sub">Estes fluxos exigem aprovação humana + variável de ambiente explícita</span>
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {data ? (
          <>
            <Pill on={data.guarantees.otaReal} label="OTA real (Booking/Airbnb/Expedia)" />
            <Pill on={data.guarantees.channelManagerProduction} label="Channel Manager production" />
            <Pill on={data.guarantees.gatewayReal} label="Gateway de pagamento real" />
            <Pill on={data.guarantees.fnrhProduction} label="FNRH production" />
          </>
        ) : (
          <span className="muted text-xs">Carregando…</span>
        )}
      </div>

      {/* 04 · Recomendações */}
      <div className="pc-section-head">
        <span className="pc-section-num">04</span>
        <div className="pc-section-titles">
          <span className="pc-section-title">Recomendações</span>
          <span className="pc-section-sub">Próximos passos antes de produção</span>
        </div>
      </div>
      <ul style={{ paddingLeft: 18, margin: 0, fontSize: 12, color: "var(--text-mute)", lineHeight: 1.55 }}>
        <li>Ativar MFA obrigatório para todos os operadores.</li>
        <li>Configurar <span className="mono">VITE_PLATFORM_CONSOLE_URL</span> em produção.</li>
        <li>Definir chave LLM apenas no backend (<span className="mono">ANTHROPIC_API_KEY</span>) — nunca no Console.</li>
        <li>Antes de habilitar Channel Manager production, rodar revisão do Security Agent.</li>
        <li>Antes de habilitar OTA real, validar credenciais de cada canal em homologação.</li>
      </ul>
    </Modal>
  );
}

function Pill({ on, label }: { on: boolean; label: string }) {
  return (
    <Badge tone={on ? "danger" : "neutral"} dot={on}>
      {label} {on ? "ATIVO" : "OFF"}
    </Badge>
  );
}
