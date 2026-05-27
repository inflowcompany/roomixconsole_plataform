// Roomix Platform Console — internal login screen.
//
// Four modes share the same card chrome:
//
//   • "signin"        → existing operator types email + password.
//                       Calls POST /api/auth/login.
//
//   • "first-access"  → invited operator types the email a superadmin
//                       added via the invite flow and picks their own
//                       password. Calls POST /api/platform/auth/first-access.
//
//   • "forgot"        → operator forgot their password. Calls
//                       POST /api/platform/auth/password-reset/request.
//                       Response is ALWAYS neutral — UI does not reveal
//                       whether the email exists.
//
//   • "reset"         → operator landed here via `?reset-token=...` in
//                       the URL. Sets a new password by calling
//                       POST /api/platform/auth/password-reset/confirm.
//
// We never echo the password and never persist it in storage. The
// session cookie (HttpOnly) is set by the SaaS on signin/first-access.
// The reset token lives ONLY in URL params + the submit body — never
// in localStorage, never in analytics, never in console.log.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
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
import { authApi, AuthApiError } from "../auth/api";
import { useAuth } from "../auth/AuthContext";

type Mode = "signin" | "first-access" | "forgot" | "reset";

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
    case "RESET_TOKEN_REQUIRED":
      return "Token de recuperação ausente. Use o link enviado por e-mail.";
    case "RESET_TOKEN_INVALID":
      return "Link de recuperação inválido ou expirado. Peça um novo.";
    case "PASSWORD_REQUIRED":
      return "Senha obrigatória.";
    case "PASSWORD_TOO_SHORT":
      return "A senha precisa ter pelo menos 12 caracteres.";
    case "PASSWORD_TOO_LONG":
      return "Senha muito longa.";
    case "PASSWORD_LETTERS_REQUIRED":
      return "A senha precisa conter letras.";
    case "PASSWORD_NUMBERS_REQUIRED":
      return "A senha precisa conter números.";
    case "RESET_UPDATE_FAILED":
      return "Falha temporária ao atualizar a senha. Tente novamente em alguns segundos.";
    case "CSRF_ORIGIN_BLOCKED":
      return "Origem bloqueada pelo backend. Verifique se o Console está rodando no domínio autorizado.";
    case "NETWORK_ERROR":
      return "Não consegui falar com a API. Confirme que o backend Roomix está acessível.";
    default:
      return `Falha (${code}).`;
  }
};

// Read the reset token from the URL one time at mount. We never store
// it elsewhere; submitting clears it from the address bar too.
const readResetTokenFromUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("reset-token");
    return token && token.length > 0 ? token : null;
  } catch {
    return null;
  }
};

const clearResetTokenFromUrl = () => {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("reset-token")) return;
    url.searchParams.delete("reset-token");
    window.history.replaceState({}, "", url.toString());
  } catch {
    /* ignore */
  }
};

export function LoginScreen() {
  const { login, firstAccess, errorCode } = useAuth();
  const initialResetToken = useMemo(() => readResetTokenFromUrl(), []);
  const [mode, setMode] = useState<Mode>(initialResetToken ? "reset" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Reset token is kept in component state only. We clear it from the
  // address bar as soon as the operator lands on the reset screen so
  // it does not leak via clipboard copy of the URL.
  const [resetToken, setResetToken] = useState<string | null>(initialResetToken);
  const emailRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (mode === "reset" && resetToken) {
      // Strip the token from the URL right after we captured it in state.
      clearResetTokenFromUrl();
    }
  }, [mode, resetToken]);

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

    if (mode === "signin" || mode === "first-access" || mode === "forgot") {
      if (!email) {
        setLocalError("Informe o e-mail.");
        return;
      }
    }

    if (mode === "signin" && !password) {
      setLocalError("Informe a senha.");
      return;
    }

    if (mode === "first-access" || mode === "reset") {
      if (password.length < 12) {
        setLocalError("A senha precisa ter pelo menos 12 caracteres.");
        return;
      }
      if (password !== confirm) {
        setLocalError("Confirmação não bate com a senha.");
        return;
      }
    }

    if (mode === "reset" && !resetToken) {
      setLocalError("Token de recuperação ausente. Peça um novo link.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        await login(email, password);
      } else if (mode === "first-access") {
        await firstAccess(email, password, name.trim() || undefined);
      } else if (mode === "forgot") {
        const result = await authApi.passwordResetRequest({ email });
        setSuccess(
          result.message ||
            "Se este e-mail existir e tiver permissão, enviaremos instruções de recuperação.",
        );
      } else if (mode === "reset" && resetToken) {
        const result = await authApi.passwordResetConfirm({ token: resetToken, password });
        setSuccess(result.message || "Senha atualizada. Faça login com a nova senha.");
        // Drop the token from memory and switch back to the signin
        // form after a short pause so the operator reads the message.
        setResetToken(null);
        setTimeout(() => {
          setMode("signin");
          setPassword("");
          setConfirm("");
        }, 1800);
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

        {/* Top tabs hide while we're on a derived flow (forgot/reset)
            so the chrome stays focused on the single action. */}
        {(mode === "signin" || mode === "first-access") && (
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
        )}

        <div className="pc-login-env">
          <ShieldCheck size={13} />
          {mode === "signin" && <span>Ambiente Homologação segura · sessão auditada · cookie HttpOnly</span>}
          {mode === "first-access" && (
            <span>
              Digite o e-mail <strong>já pré-validado</strong> por um superadmin Roomix e crie a sua senha.
            </span>
          )}
          {mode === "forgot" && (
            <span>
              Envia um link único e seguro para o e-mail informado. Validade: 30 min. Nunca revelamos se o e-mail
              existe.
            </span>
          )}
          {mode === "reset" && (
            <span>
              Defina uma nova senha. O link é <strong>single-use</strong>: depois de salvar, suas sessões antigas
              são revogadas.
            </span>
          )}
        </div>

        <form className="pc-login-form" onSubmit={onSubmit} autoComplete="off">
          {(mode === "signin" || mode === "first-access" || mode === "forgot") && (
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
          )}

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

          {(mode === "signin" || mode === "first-access" || mode === "reset") && (
            <label className="pc-login-field">
              <span className="pc-login-label">
                {mode === "signin"
                  ? "Senha"
                  : mode === "first-access"
                    ? "Nova senha (mín. 12 caracteres)"
                    : "Nova senha (mín. 12 caracteres, com letras e números)"}
              </span>
              <div className="pc-login-input">
                <Lock size={14} />
                <input
                  ref={mode === "reset" ? emailRef : undefined}
                  type={showPwd ? "text" : "password"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  disabled={submitting}
                  required
                  minLength={mode === "signin" ? undefined : 12}
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
          )}

          {(mode === "first-access" || mode === "reset") && (
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
              <CheckCircle2 size={13} style={{ marginRight: 6 }} />
              {success}
            </div>
          )}

          <button type="submit" className="pc-login-submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={14} className="pc-spin" />
                {mode === "signin"
                  ? "Entrando…"
                  : mode === "first-access"
                    ? "Criando acesso…"
                    : mode === "forgot"
                      ? "Enviando…"
                      : "Atualizando senha…"}
              </>
            ) : mode === "signin" ? (
              <>
                <Sparkles size={14} />
                Entrar no Console
              </>
            ) : mode === "first-access" ? (
              <>
                <KeyRound size={14} />
                Criar acesso e entrar
              </>
            ) : mode === "forgot" ? (
              <>
                <Mail size={14} />
                Enviar link de recuperação
              </>
            ) : (
              <>
                <KeyRound size={14} />
                Atualizar senha
              </>
            )}
          </button>

          {mode === "signin" && (
            <button
              type="button"
              className="pc-login-link"
              onClick={() => setMode("forgot")}
              disabled={submitting}
            >
              <KeyRound size={11} />
              Esqueci minha senha
            </button>
          )}

          {(mode === "first-access" || mode === "forgot" || mode === "reset") && (
            <button
              type="button"
              className="pc-login-link"
              onClick={() => {
                setMode("signin");
                setResetToken(null);
              }}
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
