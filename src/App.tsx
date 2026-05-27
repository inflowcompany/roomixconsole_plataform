// Roomix Platform Console — top-level app.
//
// Renders one of:
//   • LoginScreen        — anonymous session
//   • LoadingScreen      — while we resolve /api/auth/me on first boot
//   • DeniedScreen       — logged in but NOT SUPER_ADMIN_ROOMIX
//   • PlatformConsoleApp — authenticated superadmin
//
// The auth gate is enforced both client-side (here) AND server-side
// (every /api/platform/console/* route is wrapped in
// requirePlatformSuperadmin). The client gate is just for UX —
// burlando ele só leva você a um 403 do backend.

import React from "react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LoginScreen } from "./views/LoginScreen";
import { DeniedScreen } from "./views/DeniedScreen";
import { PlatformConsoleApp } from "./platform-console/PlatformConsoleApp";
import "./styles/auth.css";

export function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}

function Router() {
  const { status, user, logout } = useAuth();

  if (status === "checking") {
    return <LoadingScreen />;
  }

  if (status === "anonymous") {
    return <LoginScreen />;
  }

  if (status === "denied") {
    return <DeniedScreen />;
  }

  if (!user) {
    // Defensive: status says authenticated but user is null. Send the
    // operator back to login rather than rendering a broken shell.
    return <LoginScreen />;
  }

  const initials = (user.name || user.email || "SR")
    .split(/[\s.@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const openInSaaS = (propertyId?: string | null) => {
    // Deep-link the operator to the SaaS in a NEW TAB with the
    // propertyId in the query. We never pass tokens or sessions in the
    // URL — the SaaS already has the same first-party cookie because
    // both apps share the SaaS origin (proxy in dev, same auth domain
    // in prod).
    const url = new URL("http://localhost:3000/");
    if (propertyId) url.searchParams.set("propertyId", propertyId);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  // Environment label is driven by the build-time env var. In
  // production (Railway / Vercel / any non-localhost host) we surface
  // "Produção" so the operator never confuses environments; in dev /
  // homologation we keep the calmer "Homologação segura".
  const envFlag = ((import.meta as { env?: Record<string, string> }).env || {}).VITE_PLATFORM_CONSOLE_ENV;
  const environmentLabel =
    typeof envFlag === "string" && envFlag.toLowerCase() === "production"
      ? "Produção"
      : "Homologação segura";

  return (
    <PlatformConsoleApp
      superadminName={user.name || user.email}
      superadminInitials={initials}
      environmentLabel={environmentLabel}
      onImpersonateProperty={(_name, propertyId) => openInSaaS(propertyId)}
      onExitConsole={() => void logout()}
    />
  );
}

function LoadingScreen() {
  return (
    <div className="pc-login-shell">
      <div className="pc-login-card" style={{ textAlign: "center" }}>
        <div className="pc-login-brand" style={{ justifyContent: "center" }}>
          <div className="pc-login-logo">R</div>
        </div>
        <div className="pc-login-title">Roomix Platform Console</div>
        <div className="pc-login-sub">verificando sessão…</div>
      </div>
    </div>
  );
}
