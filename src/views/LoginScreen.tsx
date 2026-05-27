// Roomix Platform Console — internal login screen + first-access claim.
//
// Two modes share the same card chrome:
//
//   • "signin"        → existing operator types email + password.
//                       Calls POST /api/auth/login.
//
//   • "first-access"  → invited operator types the email a superadmin
//                       added via the invite flow and picks their own
//                       password. Calls POST /api/platform/auth/first-access.
//
// We never echo the password and never persist it in storage. The
// session cookie (HttpOnly) is set by the SaaS in response to either
// call.

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { AuthApiError } from "../auth/api";

type Mode = "signin" | "first-access";

const errorMessage = (code: string | null): string => {
  if (!code) return "";
  switch (code) {
    case "INVALID_CREDENTIALS":
    case "LOGIN_INVALID":
      return "E-mail ou senha inválidos.";
    case "LOGIN_LOCKED":
    case "LOGIN_RATE_LIMITED":
    case "RATE_LIMITED":
      return "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
    case "MFA_REQUIRED":
      return "Esta conta exige MFA. Use o método configurado para concluir o login.";
    case "SUPERADMIN_REQUIRED":
      return "Esta conta não tem acesso ao Platform Console. Use uma credencial de superadmin Roomix.";
    case "INVITE_INVALID":
      return "Convite não encontrado, expirado ou já utilizado. Peça pra um superadmin (re)convidar este e-mail.";
    case "INVITE_PROVISIONING_FAILED":
      return "Convite válido mas não consegui provisionar o acesso agora. Tente de novo em alguns segundos.";
    case "ALREADY_ACTIVE":
      return "Este e-mail já está ativo. Use 'Entrar' com sua senha atual.";
    case "NETWORK_ERROR":
      return "Não consegui falar com a API. Confirme que o backend Roomix está rodando em http://localhost:3000.";
    default:
      return `Falha (${code}).`;
  }
};

export function LoginScreen() {
  const { login, firstAccess, errorCode } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, [mode]);

  // Switching modes resets the form errors but keeps the email so the
  // operator does not retype it.
  useEffect(() => {
    setLocalError(null);
    setSuccess(null);
    setPassword("");
    setConfirm("");
    setShowPwd(false);
  }, [mode]);

  const message = localError ?? errorMessage(errorCode);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setLocalError(null);
    setSuccess(null);

    if (!email) {
      setLocalError("Informe o e-mail.");
      return;
    }
    if (mode === "signin") {
      if (!password) {
        setLocalError("Informe a senha.");
        return;
      }
    } else {
      if (password.length < 12) {
        setLocalError("A senha precisa ter pelo menos 12 caracteres.");
        return;
      }
      if (password !== confirm) {
        setLocalError("Confirmação não bate com a senha.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        await login(email, password);
      } else {
        await firstAccess(email, password, name.trim() || undefined);
      }
    } catch (err) {
      if (err instanceof AuthApiError) {
        setLocalError(errorMessage(err.code));
      } else {
        setLocalError(errorMessage("NETWORK_ERROR"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pc-login-shell">
      <div className="pc-login-card">
        <div className="pc-login-brand">
          <div className="pc-login-logo">R</div>
          <div>
            <div className="pc-login-title">Roomix Platform Console</div>
            <div className="pc-login-sub">Acesso interno restrito · Roomix Team</div>
          </div>
        </div>

        <div className="pc-mode-tabs">
          <button
            type="button"
            className={`pc-mode-tab ${mode === "signin" ? "active" : ""}`}
            onClick={() => setMode("signin")}
          >
            <Lock size={12} />
            Entrar
          </button>
          <button
            type="button"
            className={`pc-mode-tab ${mode === "first-access" ? "active" : ""}`}
            onClick={() => setMode("first-access")}
          >
            <KeyRound size={12} />
            Primeiro acesso
          </button>
        </div>

        <div className="pc-login-env">
          <ShieldCheck size={13} />
          {mode === "signin" ? (
            <span>Ambiente Homologation · sessão auditada · cookie HttpOnly</span>
          ) : (
            <span>
              Digite o e-mail <strong>já pré-validado</strong> por um superadmin Roomix e crie a sua senha.
            </span>
          )}
        </div>

        <form className="pc-login-form" onSubmit={onSubmit} autoComplete="off">
          <label className="pc-login-field">
            <span className="pc-login-label">E-mail Roomix</span>
            <div className="pc-login-input">
              <Mail size={14} />
              <input
                ref={emailRef}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.usuario@roomix.com.br"
                disabled={submitting}
                required
              />
            </div>
          </label>

          {mode === "first-access" && (
            <label className="pc-login-field">
              <span className="pc-login-label">Nome para exibição (opcional)</span>
              <div className="pc-login-input">
                <UserRound size={14} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Chris da Costa"
                  disabled={submitting}
                />
              </div>
            </label>
          )}

          <label className="pc-login-field">
            <span className="pc-login-label">
              {mode === "signin" ? "Senha" : "Nova senha (mín. 12 caracteres)"}
            </span>
            <div className="pc-login-input">
              <Lock size={14} />
              <input
                type={showPwd ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                disabled={submitting}
                required
                minLength={mode === "first-access" ? 12 : undefined}
              />
              <button
                type="button"
                className="pc-login-toggle"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Esconder senha" : "Mostrar senha"}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>

          {mode === "first-access" && (
            <label className="pc-login-field">
              <span className="pc-login-label">Confirme a senha</span>
              <div className="pc-login-input">
                <Lock size={14} />
                <input
                  type={showPwd ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="repita a senha"
                  disabled={submitting}
                  required
                  minLength={12}
                />
              </div>
            </label>
          )}

          {message && (
            <div className="pc-login-error" role="alert">
              {message}
            </div>
          )}
          {success && (
            <div className="pc-login-success" role="status">
              {success}
            </div>
          )}

          <button type="submit" className="pc-login-submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={14} className="pc-spin" />
                {mode === "signin" ? "Entrando…" : "Criando acesso…"}
              </>
            ) : mode === "signin" ? (
              <>
                <Sparkles size={14} />
                Entrar no Console
              </>
            ) : (
              <>
                <KeyRound size={14} />
                Criar acesso e entrar
              </>
            )}
          </button>

          {mode === "first-access" && (
            <button
              type="button"
              className="pc-login-link"
              onClick={() => setMode("signin")}
              disabled={submitting}
            >
              <ArrowLeft size={11} />
              Voltar para entrar
            </button>
          )}
        </form>

        <div className="pc-login-foot">
          <div>
            Cliente Roomix? Você está no lugar errado — o painel da propriedade fica em{" "}
            <span className="pc-login-mono">roomix.com.br</span>, não aqui.
          </div>
          <div className="pc-login-build">platform-console · v0.1.0 · build local</div>
        </div>
      </div>
    </div>
  );
}
