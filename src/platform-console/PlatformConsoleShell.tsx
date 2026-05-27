// Roomix Platform Console — sidebar, topbar, impersonation banner and
// command palette. Port of `shell.jsx` from the Cloud Design handoff,
// converted to typed TSX with module imports.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Icon } from "./components";
import { ProfileMenu } from "./components/ProfileMenu";
import type { ConsoleViewId, ImpersonationContext, ConsoleOverview } from "./types";

interface NavItem {
  id: ConsoleViewId;
  label: string;
  icon: string;
  count?: string;
  alert?: boolean;
  warn?: boolean;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const buildNav = (
  data: ConsoleOverview | null | undefined,
  pendingCommercialRequests = 0,
): NavSection[] => {
  const propertyCount = data?.properties?.length ?? 0;
  const openOverbookings = data?.metrics?.openOverbookings ?? 0;
  const cmIncidents = data?.metrics?.cmIncidents ?? 0;
  const fnrhPending = data?.metrics?.fnrhPending ?? 0;
  const agentIssues = data?.agents?.filter((a) => a.status !== "active").length ?? 0;

  return [
    {
      section: "OPERAÇÃO",
      items: [
        { id: "overview", label: "Visão Geral", icon: "layout-dashboard" },
        { id: "properties", label: "Propriedades", icon: "building-2", count: propertyCount > 0 ? String(propertyCount) : undefined },
        {
          id: "overbookings",
          label: "Overbookings",
          icon: "alert-octagon",
          count: openOverbookings > 0 ? String(openOverbookings) : undefined,
          alert: openOverbookings > 0,
        },
        {
          id: "cm",
          label: "Channel Manager",
          icon: "git-branch",
          count: cmIncidents > 0 ? String(cmIncidents) : undefined,
          warn: cmIncidents > 0,
        },
        {
          id: "fnrh",
          label: "FNRH / Compliance",
          icon: "shield-check",
          count: fnrhPending > 0 ? String(fnrhPending) : undefined,
          warn: fnrhPending > 0,
        },
      ],
    },
    {
      section: "COMERCIAL",
      items: [
        { id: "clients", label: "Clientes & Planos", icon: "users" },
        { id: "payments", label: "Pagamentos & Faturas", icon: "receipt" },
        {
          id: "commercial-requests",
          label: "Solicitações",
          icon: "message-square",
          count: pendingCommercialRequests > 0 ? String(pendingCommercialRequests) : undefined,
          warn: pendingCommercialRequests > 0,
        },
      ],
    },
    {
      section: "AGENTES",
      items: [
        { id: "agent-center", label: "Agent Center", icon: "sparkles" },
        {
          id: "agents",
          label: "Agentes Roomix",
          icon: "cpu",
          count: agentIssues > 0 ? String(agentIssues) : undefined,
          warn: agentIssues > 0,
        },
        { id: "automations", label: "Automações", icon: "workflow" },
      ],
    },
    {
      section: "SISTEMA",
      items: [
        { id: "logs", label: "Logs & Auditoria", icon: "file-text" },
        { id: "settings", label: "Configurações Internas", icon: "settings" },
      ],
    },
  ];
};

interface SidebarProps {
  current: ConsoleViewId;
  onNav: (id: ConsoleViewId) => void;
  data: ConsoleOverview | null | undefined;
  superadminName?: string;
  superadminInitials?: string;
  homologationLabel?: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Count of commercial requests in pending state ("requested" + "in_review"). Drives sidebar badge. */
  pendingCommercialRequests?: number;
}

export function Sidebar({
  current,
  onNav,
  data,
  superadminName = "Superadmin Roomix",
  superadminInitials = "SR",
  homologationLabel = "Homologação segura",
  collapsed,
  onToggleCollapsed,
  pendingCommercialRequests = 0,
}: SidebarProps) {
  const nav = buildNav(data, pendingCommercialRequests);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <aside className="sidebar" style={{ position: "relative" }}>
      <div className="sb-brand">
        <div className="sb-brand-mark">R</div>
        <div>
          <div className="sb-brand-name">Roomix Console</div>
          <div className="sb-brand-sub">Platform · interno</div>
        </div>
      </div>

      <nav style={{ flex: 1, overflow: "auto", paddingBottom: 12 }}>
        {nav.map((sec) => (
          <div key={sec.section}>
            <div className="sb-section-label">{sec.section}</div>
            {sec.items.map((it) => (
              <div
                key={it.id}
                className={`sb-item ${current === it.id ? "active" : ""} ${it.alert ? "has-alert" : ""} ${it.warn ? "has-warn" : ""}`}
                data-tip={it.label}
                onClick={() => onNav(it.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onNav(it.id);
                  }
                }}
              >
                <Icon name={it.icon} size={15} />
                <span className="sidebar-label">{it.label}</span>
                {it.count ? <span className="sb-count">{it.count}</span> : null}
                {(it.alert || it.warn) ? <span className="sb-dot" aria-hidden /> : null}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="sb-footer" style={{ position: "relative" }}>
        <div className="sb-status-row">
          <span className="label">Ambiente</span>
          <span className="env-pill">
            <span className="dot" style={{ width: 5, height: 5, borderRadius: 50, background: "currentColor" }} />
            {homologationLabel}
          </span>
        </div>
        <div className="sb-status-row">
          <span className="label">Fonte</span>
          <span className="value">
            <span className={`health-dot ${data?.source === "backend" ? "ok" : "warn"}`} style={{ marginRight: 6 }} />
            {data?.source === "backend" ? "api · live" : "demo dataset"}
          </span>
        </div>
        <div className="sb-status-row">
          <span className="label">Channel Mgr</span>
          <span className="value">
            <span
              className={`health-dot ${(data?.metrics?.cmIncidents ?? 0) > 0 ? "warn" : "ok"}`}
              style={{ marginRight: 6 }}
            />
            {data?.metrics?.cmIncidents ? `${data.metrics.cmIncidents} alerta(s)` : "ok"}
          </span>
        </div>

        <div
          className="sb-user clickable"
          onClick={() => setProfileOpen((v) => !v)}
          role="button"
          tabIndex={0}
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setProfileOpen((v) => !v);
            }
          }}
        >
          <div className="sb-user-avatar">{superadminInitials}</div>
          <div className="grow">
            <div className="sb-user-name">{superadminName}</div>
            <div className="sb-user-role">acesso restrito</div>
          </div>
          <Icon name={profileOpen ? "chevron-down" : "chevron-up"} size={14} color="var(--text-mute)" />
        </div>

        <ProfileMenu
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onNavigateLogs={() => onNav("logs")}
          environmentLabel={homologationLabel}
        />

        <button
          type="button"
          className="sb-toggle-btn"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expandir" : "Recolher"}
        >
          <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={13} />
          <span className="sb-toggle-label">{collapsed ? "Expandir" : "Recolher"}</span>
        </button>
      </div>
    </aside>
  );
}

// ---- Topbar --------------------------------------------------------------
const PAGE_META: Record<ConsoleViewId, { title: string; crumb: string }> = {
  overview: { title: "Visão Geral", crumb: "Console · operação" },
  properties: { title: "Propriedades", crumb: "Console · propriedades" },
  clients: { title: "Clientes & Planos", crumb: "Console · comercial" },
  cm: { title: "Channel Manager", crumb: "Console · sincronização" },
  overbookings: { title: "Overbookings", crumb: "Console · incidentes" },
  fnrh: { title: "FNRH / Compliance", crumb: "Console · conformidade" },
  payments: { title: "Pagamentos & Faturas", crumb: "Console · financeiro" },
  "commercial-requests": { title: "Solicitações Comerciais", crumb: "Console · comercial" },
  "agent-center": { title: "Agent Center", crumb: "Console · agentes" },
  agents: { title: "Agentes Roomix", crumb: "Console · agentes" },
  automations: { title: "Automações", crumb: "Console · agentes" },
  logs: { title: "Logs & Auditoria", crumb: "Console · sistema" },
  settings: { title: "Configurações Internas", crumb: "Console · sistema" },
};

interface TopbarProps {
  current: ConsoleViewId;
  onOpenCmd: () => void;
  onOpenProperty: () => void;
  onOpenDemo: () => void;
  onExitConsole?: () => void;
  superadminInitials?: string;
}

export function Topbar({
  current,
  onOpenCmd,
  onOpenProperty,
  onOpenDemo,
  onExitConsole,
  superadminInitials = "SR",
}: TopbarProps) {
  const meta = PAGE_META[current] || { title: "", crumb: "" };
  return (
    <header className="topbar">
      <div>
        <div className="tb-crumb">{meta.crumb}</div>
        <div className="tb-title">{meta.title}</div>
      </div>

      <div className="tb-search" onClick={onOpenCmd}>
        <Icon name="search" size={13} color="var(--text-mute)" />
        <span>Buscar propriedade, cliente, reserva, incidente…</span>
        <kbd>⌘K</kbd>
      </div>

      <div className="tb-warn hide-md">
        <Icon name="lock" size={11} />
        Console interno · acesso restrito
      </div>

      <div className="row" style={{ gap: 8, marginLeft: "auto" }}>
        <button className="tb-btn" type="button" onClick={onOpenProperty} title="Abrir propriedade no Roomix SaaS">
          <Icon name="external-link" size={13} />
          Abrir propriedade
        </button>
        <button className="tb-btn primary" type="button" onClick={onOpenDemo} title="Propriedade demo · ambiente seguro">
          <Icon name="plus" size={13} />
          Propriedade demo
        </button>
        {onExitConsole && (
          <button className="tb-btn" type="button" onClick={onExitConsole} title="Voltar ao SaaS Roomix">
            <Icon name="arrow-left" size={13} />
            Sair
          </button>
        )}
        <button className="tb-icon-btn" type="button" aria-label="Notificações">
          <Icon name="bell" size={14} />
          <span className="dot" />
        </button>
        <div className="sb-user-avatar" style={{ width: 30, height: 30, borderRadius: 8 }}>
          {superadminInitials}
        </div>
      </div>
    </header>
  );
}

// ---- ImpersonationBanner -------------------------------------------------
interface ImpersonationBannerProps {
  context: ImpersonationContext;
  onExit: () => void;
  onViewLogs?: () => void;
}

export function ImpersonationBanner({ context, onExit, onViewLogs }: ImpersonationBannerProps) {
  if (!context.propertyName) return null;
  return (
    <div className="impersonate-banner" role="status">
      <Icon name="eye" size={14} />
      <span>
        Você está visualizando <strong style={{ color: "var(--text-hi)" }}>{context.propertyName}</strong> como superadmin.
        <span className="muted" style={{ marginLeft: 8 }}>
          Toda ação é registrada com escopo de impersonation.
        </span>
      </span>
      <span className="row" style={{ gap: 6, marginLeft: "auto" }}>
        <Badge tone="warning" dot>
          modo seguro
        </Badge>
        {onViewLogs && (
          <button className="btn sm ghost" type="button" onClick={onViewLogs}>
            <Icon name="scroll-text" size={12} /> Ver logs da sessão
          </button>
        )}
        <button className="btn sm" type="button" onClick={onExit}>
          <Icon name="arrow-left" size={12} /> Voltar ao Console
        </button>
      </span>
    </div>
  );
}

// ---- Command Palette -----------------------------------------------------
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNav: (id: ConsoleViewId) => void;
  onImpersonate: (propertyName: string, propertyId?: string) => void;
  properties: ConsoleOverview["properties"];
}

export function CommandPalette({ open, onClose, onNav, onImpersonate, properties }: CommandPaletteProps) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleClose = useCallback(() => {
    setQ("");
    onClose();
  }, [onClose]);

  if (!open) return null;

  const navItems: Array<{ label: string; icon: string; meta: string; go: () => void }> = [
    { label: "Visão Geral", icon: "layout-dashboard", meta: "g o", go: () => onNav("overview") },
    { label: "Propriedades", icon: "building-2", meta: "g p", go: () => onNav("properties") },
    { label: "Overbookings", icon: "alert-octagon", meta: "g b", go: () => onNav("overbookings") },
    { label: "Channel Manager", icon: "git-branch", meta: "g c", go: () => onNav("cm") },
    { label: "Solicitações Comerciais", icon: "message-square", meta: "g s", go: () => onNav("commercial-requests") },
    { label: "Agent Center", icon: "sparkles", meta: "g a", go: () => onNav("agent-center") },
    { label: "Logs & Auditoria", icon: "file-text", meta: "g l", go: () => onNav("logs") },
  ];

  const propsList = properties.slice(0, 6).map((p) => ({
    label: `Abrir propriedade · ${p.name}`,
    icon: "building-2",
    meta: p.city,
    go: () => onImpersonate(p.name, p.id),
  }));

  const ql = q.toLowerCase();
  const filt = <T extends { label: string }>(arr: T[]) =>
    ql ? arr.filter((i) => i.label.toLowerCase().includes(ql)) : arr;

  return (
    <div className="cmdk-backdrop" onClick={handleClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Buscar propriedade, cliente, reserva, incidente, ou ação…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="cmdk-list">
          <div className="cmdk-section-label">Navegação</div>
          {filt(navItems).map((n, i) => (
            <div
              key={i}
              className="cmdk-item"
              onClick={() => {
                n.go();
                handleClose();
              }}
            >
              <Icon name={n.icon} size={14} />
              <span>{n.label}</span>
              <span className="meta">{n.meta}</span>
            </div>
          ))}
          <div className="cmdk-section-label">Propriedades</div>
          {filt(propsList).map((n, i) => (
            <div
              key={i}
              className="cmdk-item"
              onClick={() => {
                n.go();
                handleClose();
              }}
            >
              <Icon name={n.icon} size={14} />
              <span>{n.label}</span>
              <span className="meta">{n.meta}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
