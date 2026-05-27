// "Equipe Roomix" panel — shown inside the Settings view of the Platform
// Console. Lists pending invites and lets a superadmin invite another
// operator (who can then claim their access via "Primeiro acesso" on
// the login screen).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Icon, Panel } from "../components";
import { platformConsoleApi, type PendingInvite, type TeamMember } from "../services/platformConsoleApi";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { useToast } from "../components/Toast";

interface ApiError extends Error {
  status?: number;
}

const codeLabel = (raw?: string | null) => {
  if (!raw) return "Falha desconhecida.";
  if (raw.includes("ALREADY_ACTIVE")) return "Este e-mail já está ativo.";
  if (raw.includes("INVALID_EMAIL")) return "E-mail inválido.";
  if (raw.includes("SUPERADMIN_REQUIRED")) return "Sua sessão perdeu permissão. Faça login de novo.";
  if (raw.includes("CANNOT_SUSPEND_SELF")) return "Você não pode suspender a própria conta.";
  if (raw.includes("LAST_ACTIVE_SUPERADMIN")) return "Este é o último superadmin ativo — não pode ser suspenso.";
  if (raw.includes("USER_NOT_FOUND")) return "Usuário não encontrado.";
  if (raw.includes("NOT_AN_OPERATOR")) return "Esta conta não é operador do Console.";
  return raw;
};

export function TeamPanel() {
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingSuspend, setPendingSuspend] = useState<TeamMember | null>(null);
  const [busyMember, setBusyMember] = useState<string | null>(null);
  const toast = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const [invitesRes, teamRes] = await Promise.all([
        platformConsoleApi.listInvites(),
        platformConsoleApi.listTeamMembers().catch((err: ApiError) => {
          // Team listing is a newer endpoint — if it's not live yet,
          // keep the invites panel working and surface the failure
          // honestly below.
          return { __err: err.message, members: [] as TeamMember[], activeCount: 0 } as const;
        }),
      ]);
      setInvites(invitesRes.invites);
      setMembers(teamRes.members);
      if ("__err" in teamRes) {
        // eslint-disable-next-line no-console
        console.debug("[platform-console] team list unavailable:", teamRes.__err);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setListError(codeLabel(apiErr.message));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSuspend = useCallback(
    async (member: TeamMember) => {
      setBusyMember(member.id);
      try {
        if (member.status === "suspended") {
          await platformConsoleApi.reactivateTeamMember(member.id);
          toast.show(`${member.name || member.email} reativado`, "brand");
        } else {
          await platformConsoleApi.suspendTeamMember(member.id);
          toast.show(`${member.name || member.email} suspenso · sessões revogadas`, "warn");
        }
        await refresh();
      } catch (err) {
        const apiErr = err as ApiError;
        toast.show(`Falha: ${codeLabel(apiErr.message)}`, "danger");
      } finally {
        setBusyMember(null);
      }
    },
    [refresh, toast],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    setSuccess(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFormError("Informe um e-mail válido.");
      return;
    }
    setSubmitting(true);
    try {
      await platformConsoleApi.createInvite(trimmed, name.trim() || undefined);
      setSuccess(
        `Convite enviado para ${trimmed}. Peça pra essa pessoa abrir o Console e usar "Primeiro acesso" para criar a senha.`,
      );
      setEmail("");
      setName("");
      await refresh();
    } catch (err) {
      const apiErr = err as ApiError;
      setFormError(codeLabel(apiErr.message));
    } finally {
      setSubmitting(false);
    }
  };

  const formattedInvites = useMemo(
    () =>
      invites.map((invite) => ({
        ...invite,
        formattedDate: invite.createdAt
          ? new Date(invite.createdAt).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "—",
      })),
    [invites],
  );

  return (
    <Panel
      title="Equipe Roomix"
      icon="users"
      sub={loading ? "carregando…" : `${invites.length} convite(s) pendente(s)`}
      action={
        <button className="btn sm ghost" type="button" onClick={() => void refresh()}>
          <Icon name="refresh-cw" size={11} /> Atualizar
        </button>
      }
    >
      <form className="col" style={{ gap: 10, marginBottom: 14 }} onSubmit={onSubmit}>
        <div className="text-xs muted" style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Convidar funcionário
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <div
            className="filter-chip"
            style={{
              padding: "6px 10px",
              minWidth: 240,
              background: "var(--surface-2)",
              borderColor: "var(--line-strong)",
              flex: "1 1 240px",
            }}
          >
            <Icon name="mail" size={12} />
            <input
              type="email"
              placeholder="email.do.funcionario@roomix.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-hi)",
                fontSize: 12,
                width: "100%",
                fontFamily: "inherit",
              }}
              required
            />
          </div>
          <div
            className="filter-chip"
            style={{
              padding: "6px 10px",
              minWidth: 180,
              background: "var(--surface-2)",
              borderColor: "var(--line-strong)",
              flex: "1 1 180px",
            }}
          >
            <Icon name="user" size={12} />
            <input
              type="text"
              placeholder="Nome (opcional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-hi)",
                fontSize: 12,
                width: "100%",
                fontFamily: "inherit",
              }}
            />
          </div>
          <button type="submit" className="btn primary" disabled={submitting}>
            <Icon name="send" size={12} />
            {submitting ? "Enviando…" : "Convidar"}
          </button>
        </div>
        {formError && (
          <div className="notice" style={{ background: "var(--danger-dim)", borderColor: "rgba(242,85,85,0.3)", color: "var(--danger)" }}>
            <Icon name="alert-triangle" size={12} />
            <span>{formError}</span>
          </div>
        )}
        {success && (
          <div className="notice" style={{ background: "rgba(24,211,154,0.08)", borderColor: "rgba(24,211,154,0.3)", color: "var(--brand)" }}>
            <Icon name="check-circle-2" size={12} />
            <span>{success}</span>
          </div>
        )}
        <div className="text-xs muted">
          O convidado entra em <span className="mono hi">/?primeiro-acesso</span> · digita o e-mail · cria a própria senha. Você nunca vê a senha dela.
        </div>
      </form>

      <div className="text-xs muted" style={{ textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
        Convites pendentes
      </div>
      {listError && (
        <div className="notice" style={{ background: "var(--danger-dim)", borderColor: "rgba(242,85,85,0.3)", color: "var(--danger)" }}>
          <Icon name="x-circle" size={12} />
          <span>{listError}</span>
        </div>
      )}
      {!listError && formattedInvites.length === 0 && !loading && (
        <div className="muted text-xs" style={{ padding: "12px 0" }}>
          Nenhum convite pendente — todo mundo já fez o primeiro acesso, ou ninguém foi convidado ainda.
        </div>
      )}
      {formattedInvites.length > 0 && (
        <table className="tbl">
          <thead>
            <tr>
              <th>E-mail</th>
              <th>Nome</th>
              <th>Papel</th>
              <th>Convidado em</th>
            </tr>
          </thead>
          <tbody>
            {formattedInvites.map((invite) => (
              <tr key={invite.email}>
                <td className="cell-strong mono">{invite.email}</td>
                <td>{invite.name}</td>
                <td>
                  <Badge tone="violet">{invite.role}</Badge>
                </td>
                <td className="mono dim">{invite.formattedDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ===== Operadores ativos ===== */}
      <div
        className="text-xs muted"
        style={{ textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 18, marginBottom: 8 }}
      >
        Operadores ativos ({members.length})
      </div>
      {members.length === 0 && !loading && (
        <div className="muted text-xs" style={{ padding: "8px 0" }}>
          Nenhum operador ativo encontrado.
        </div>
      )}
      {members.length > 0 && (
        <table className="tbl">
          <thead>
            <tr>
              <th>Operador</th>
              <th>E-mail</th>
              <th>Papel</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <span className="cell-strong">{m.name}</span>
                  {m.isSelf ? (
                    <>
                      {" "}
                      <Badge tone="info">você</Badge>
                    </>
                  ) : null}
                </td>
                <td className="mono dim">{m.email}</td>
                <td>
                  <Badge tone="violet">{m.role}</Badge>
                </td>
                <td>
                  <Badge tone={m.status === "active" ? "success" : "warning"} dot>
                    {m.status === "active" ? "ativo" : "suspenso"}
                  </Badge>
                </td>
                <td>
                  {m.isSelf ? (
                    <button
                      className="btn sm ghost"
                      type="button"
                      disabled
                      title="Você não pode suspender a própria conta. Peça pra outro superadmin."
                    >
                      <Icon name="lock" size={11} /> protegido
                    </button>
                  ) : m.status === "suspended" ? (
                    <button
                      className="btn sm"
                      type="button"
                      disabled={busyMember === m.id}
                      onClick={() => void handleSuspend(m)}
                      title="Reativar acesso deste operador"
                    >
                      <Icon name="play" size={11} />
                      {busyMember === m.id ? "Reativando…" : "Reativar"}
                    </button>
                  ) : (
                    <button
                      className="btn sm ghost"
                      type="button"
                      disabled={busyMember === m.id}
                      onClick={() => setPendingSuspend(m)}
                      title="Suspender · revoga sessões ativas e bloqueia futuros logins"
                    >
                      <Icon name="pause" size={11} /> Suspender
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmActionModal
        open={pendingSuspend !== null}
        onClose={() => setPendingSuspend(null)}
        title="Suspender operador"
        sub={pendingSuspend ? `${pendingSuspend.name || pendingSuspend.email}` : ""}
        icon="pause"
        severity="warn"
        confirmLabel="Suspender"
        requireJustification
        justificationPlaceholder="Motivo (ex.: desligamento, comprometimento da credencial, troca de função)"
        details={[
          "Status do operador vira `suspended` no banco — login futuro é bloqueado.",
          "Sessions ativas são revogadas imediatamente (session_version bump).",
          "Última conta superadmin ativa nunca pode ser suspensa.",
          "Audit log: platform_team_suspend.",
        ]}
        onConfirm={async () => {
          if (!pendingSuspend) return;
          await handleSuspend(pendingSuspend);
          setPendingSuspend(null);
        }}
      />
    </Panel>
  );
}
