// "Acesso restrito" screen shown when a logged-in user is NOT a
// Roomix superadmin. The SaaS session exists but the Console refuses
// to mount any internal data; the user can log out and try a
// different account.

import React from "react";
import { ArrowLeft, Lock, LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export function DeniedScreen() {
  const { user, logout } = useAuth();

  return (
    <div className="pc-login-shell">
      <div className="pc-login-card" style={{ textAlign: "center" }}>
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 18px",
            borderRadius: 14,
            background: "rgba(242,85,85,0.12)",
            border: "1px solid rgba(242,85,85,0.3)",
            display: "grid",
            placeItems: "center",
            color: "#F25555",
          }}
        >
          <Lock size={26} />
        </div>
        <div className="pc-login-title" style={{ textAlign: "center" }}>
          Acesso restrito
        </div>
        <div className="pc-login-sub" style={{ textAlign: "center", marginBottom: 18 }}>
          {user?.email
            ? `A conta ${user.email} não tem permissão de superadmin Roomix.`
            : "Esta conta não tem permissão de superadmin Roomix."}
        </div>
        <p
          style={{
            color: "#C7CFD9",
            fontSize: 12.5,
            lineHeight: 1.55,
            margin: "0 0 18px",
          }}
        >
          O Platform Console é interno da equipe Roomix. Se você é
          cliente/proprietário, volte para o painel da sua propriedade no
          SaaS. Se acha que deveria ter acesso, fale com a Roomix Ops.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="pc-login-submit"
            onClick={() => void logout()}
            style={{ flex: "0 0 auto" }}
          >
            <LogOut size={14} />
            Sair desta conta
          </button>
          <a
            href="http://localhost:3000"
            className="pc-login-submit"
            style={{ flex: "0 0 auto", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#C7CFD9" }}
          >
            <ArrowLeft size={14} />
            Ir para o SaaS
          </a>
        </div>
      </div>
    </div>
  );
}
