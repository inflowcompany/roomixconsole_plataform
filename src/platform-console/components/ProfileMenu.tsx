// Profile dropdown — appears above the sidebar user card.
//
// Click outside / ESC close. Logout calls the AuthContext.
// "Minha sessão" and "Segurança" open dedicated modals backed by
// /api/platform/session/me; both are read-only and sanitized.

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../components";
import { useAuth } from "../../auth/AuthContext";
import { SessionInfoModal } from "./SessionInfoModal";
import { SecurityInfoModal } from "./SecurityInfoModal";

interface ProfileMenuProps {
  open: boolean;
  onClose: () => void;
  onNavigateLogs: () => void;
  environmentLabel?: string;
}

export function ProfileMenu({
  open,
  onClose,
  onNavigateLogs,
  environmentLabel = "Homologação segura",
}: ProfileMenuProps) {
  const { user, logout } = useAuth();
  const ref = useRef<HTMLDivElement | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      // Don't close when interacting with our spawned modals (portaled
      // to document.body) — only when clicking truly outside everything.
      const target = e.target as HTMLElement | null;
      if (ref.current?.contains(target as Node)) return;
      if (target?.closest(".pc-modal-backdrop")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sessionOpen && !securityOpen) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, sessionOpen, securityOpen]);

  if (!open) return null;

  const safeEmail = user?.email ?? "—";

  return (
    <>
      <div ref={ref} className="pc-profile-popover" role="menu" aria-label="Menu do superadmin">
        <div className="pc-profile-header">
          <div className="hi" style={{ fontSize: 12.5, fontWeight: 600 }}>
            {user?.name || "Superadmin Roomix"}
          </div>
          <div className="text-xs muted mono" style={{ marginTop: 2 }}>
            {safeEmail}
          </div>
          <div className="text-xs muted" style={{ marginTop: 6 }}>
            <span style={{ color: "var(--brand)" }}>Superadmin Roomix</span> · {environmentLabel}
          </div>
        </div>

        <button
          type="button"
          className="pc-profile-row"
          onClick={() => {
            setSessionOpen(true);
          }}
        >
          <Icon name="user" size={13} />
          Minha sessão
          <span className="pc-profile-meta">snapshot</span>
        </button>

        <button
          type="button"
          className="pc-profile-row"
          onClick={() => {
            setSecurityOpen(true);
          }}
        >
          <Icon name="shield" size={13} />
          Segurança
          <span className="pc-profile-meta">status</span>
        </button>

        <button
          type="button"
          className="pc-profile-row"
          onClick={() => {
            onNavigateLogs();
            onClose();
          }}
        >
          <Icon name="scroll-text" size={13} />
          Ver logs da sessão
          <span className="pc-profile-meta">/logs</span>
        </button>

        <div style={{ height: 1, background: "var(--line-faint)", margin: "4px 4px" }} />

        <button
          type="button"
          className="pc-profile-row danger"
          onClick={() => {
            void logout();
            onClose();
          }}
        >
          <Icon name="log-in" size={13} />
          Sair
          <span className="pc-profile-meta">logout</span>
        </button>
      </div>

      <SessionInfoModal
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        onLogout={() => {
          void logout();
          onClose();
        }}
      />
      <SecurityInfoModal
        open={securityOpen}
        onClose={() => setSecurityOpen(false)}
        onOpenLogs={() => {
          onNavigateLogs();
          onClose();
        }}
      />
    </>
  );
}
