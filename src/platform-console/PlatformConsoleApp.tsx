// Roomix Platform Console — entry component.
//
// The whole console is rendered inside `#platform-console-root` so that the
// Cloud Design CSS (scoped via that selector in platform-console.css) does
// not leak into the rest of the SaaS. Only superadmins should reach this
// component; the parent route in `App.tsx` enforces that with
// `canUseInternalRoomixModules(user)`.

import React, { useCallback, useEffect, useState } from "react";
import { useConsoleData } from "./hooks/useConsoleData";
import { CommandPalette, ImpersonationBanner, Sidebar, Topbar } from "./PlatformConsoleShell";
import { ViewOverview } from "./views/Overview";
import { ViewProperties } from "./views/Properties";
import { ViewClients } from "./views/Clients";
import { ViewPayments } from "./views/Payments";
import { ViewChannelManager } from "./views/ChannelManager";
import { ViewOverbookings } from "./views/Overbookings";
import { ViewFNRH } from "./views/Fnrh";
import { ViewAgentCenter } from "./views/AgentCenter";
import { ViewAgents } from "./views/Agents";
import { ViewAutomations } from "./views/Automations";
import { ViewLogs } from "./views/Logs";
import { ViewCommercialRequests } from "./views/CommercialRequests";
import { ViewSettings } from "./views/Settings";
import { ToastProvider, useToast } from "./components/Toast";
import { useCommercialRequestsBadge } from "./hooks/useCommercialRequestsBadge";
import { OpenPropertyModal } from "./components/OpenPropertyModal";
import { NewPropertyModal } from "./components/NewPropertyModal";
import { DemoPropertyModal } from "./components/DemoPropertyModal";
import type { ConsoleViewId, ImpersonationContext } from "./types";
import "./styles/platform-console.css";
import "./styles/interactions.css";

const COLLAPSE_KEY = "roomix_console_sidebar_collapsed";

export interface PlatformConsoleAppProps {
  superadminName?: string;
  superadminInitials?: string;
  environmentLabel?: string;
  onImpersonateProperty?: (propertyName: string, propertyId?: string) => void;
  onExitConsole?: () => void;
  saasOrigin?: string;
}

export function PlatformConsoleApp(props: PlatformConsoleAppProps) {
  return (
    <ToastProvider>
      <PlatformConsoleAppInner {...props} />
    </ToastProvider>
  );
}

function PlatformConsoleAppInner({
  superadminName,
  superadminInitials,
  environmentLabel,
  onImpersonateProperty,
  onExitConsole,
  saasOrigin = "http://localhost:3000",
}: PlatformConsoleAppProps) {
  const { data, refresh } = useConsoleData();
  const toast = useToast();
  const [view, setView] = useState<ConsoleViewId>("overview");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [impersonate, setImpersonate] = useState<ImpersonationContext>({ propertyName: null, propertyId: null });

  // Polls /api/platform/commercial-requests every 30s. Drives the
  // sidebar badge AND fires a rich toast (property + module + CTA)
  // when GENUINELY NEW requests arrive (id never seen before).
  // First-load is silent: the seen-set is primed with whatever was
  // already there. The toast CTA navigates to the Solicitações view.
  const commercialBadge = useCommercialRequestsBadge((payload) => {
    toast.show(
      <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
        <strong style={{ color: "var(--text-hi)" }}>{payload.title}</strong>
        <span style={{ fontSize: 11, color: "var(--text-mute)" }}>
          Módulo: {payload.moduleLabel}
        </span>
        <button
          type="button"
          onClick={() => setView("commercial-requests")}
          style={{
            marginTop: 4,
            alignSelf: "flex-start",
            background: "transparent",
            border: "1px solid var(--line-strong)",
            color: "var(--brand)",
            padding: "3px 8px",
            borderRadius: 6,
            fontSize: 11,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Abrir solicitação →
        </button>
      </span>,
      "warn",
      8000,
    );
  });

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });

  // Modals
  const [openPropertyOpen, setOpenPropertyOpen] = useState(false);
  const [newPropertyOpen, setNewPropertyOpen] = useState(false);
  const [demoPropertyOpen, setDemoPropertyOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    }
  }, [collapsed]);

  // Cmd+K / Ctrl+K toggles the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleNav = useCallback((id: ConsoleViewId) => setView(id), []);

  const handleImpersonate = useCallback(
    (propertyName: string, propertyId?: string) => {
      setImpersonate({ propertyName, propertyId: propertyId ?? null });
      if (onImpersonateProperty) onImpersonateProperty(propertyName, propertyId);
    },
    [onImpersonateProperty],
  );

  const handleExitImpersonation = useCallback(() => {
    setImpersonate({ propertyName: null, propertyId: null });
  }, []);

  const handleCreated = useCallback(() => {
    void refresh();
    setView("properties");
  }, [refresh]);

  const renderView = () => {
    switch (view) {
      case "overview":
        return <ViewOverview data={data} onImpersonate={handleImpersonate} onNav={handleNav} onRefresh={refresh} />;
      case "properties":
        return (
          <ViewProperties
            data={data}
            onImpersonate={handleImpersonate}
            onRefresh={refresh}
            onNewProperty={() => setNewPropertyOpen(true)}
            saasOrigin={saasOrigin}
            onNavigateView={(targetView) => setView(targetView)}
          />
        );
      case "cm":
        return <ViewChannelManager data={data} />;
      case "overbookings":
        return <ViewOverbookings />;
      case "fnrh":
        return <ViewFNRH data={data} />;
      case "clients":
        return <ViewClients data={data} />;
      case "payments":
        return <ViewPayments data={data} />;
      case "commercial-requests":
        return (
          <ViewCommercialRequests
            onOpenProperty={(propertyId) => {
              // Same contract as Logs: open SaaS in new tab with the
              // propertyId. Look up the property name so the
              // impersonation banner shows the human label.
              const match = data.properties.find((p) => p.id === propertyId);
              try {
                const url = new URL(saasOrigin + "/");
                url.searchParams.set("propertyId", propertyId);
                window.open(url.toString(), "_blank", "noopener,noreferrer");
                handleImpersonate(match?.name || propertyId, propertyId);
              } catch (err) {
                // eslint-disable-next-line no-console
                console.warn("[platform-console] open property failed:", err);
              }
            }}
          />
        );
      case "agent-center":
        return <ViewAgentCenter onOpenCommercialRequests={() => setView("commercial-requests")} />;
      case "agents":
        return <ViewAgents />;
      case "automations":
        return <ViewAutomations data={data} />;
      case "logs":
        return (
          <ViewLogs
            properties={data.properties}
            onOpenProperty={(propertyId, propertyName) => {
              // ViewLogs only invokes this callback after validating
              // that propertyId resolves to a real property in the
              // operator's properties map (otherwise the button is
              // disabled with a tooltip — no white-screen surprise).
              //
              // We open the SaaS in a new tab with the same contract
              // as OpenPropertyModal: propertyId in the URL, no token,
              // noopener+noreferrer for defence-in-depth.
              try {
                const url = new URL(saasOrigin + "/");
                url.searchParams.set("propertyId", propertyId);
                window.open(url.toString(), "_blank", "noopener,noreferrer");
                // Keep the local impersonation banner in sync so the
                // operator sees "Você está visualizando X" if they
                // come back to the Console tab.
                handleImpersonate(propertyName || propertyId, propertyId);
              } catch (err) {
                // eslint-disable-next-line no-console
                console.warn("[platform-console] open property failed:", err);
              }
            }}
          />
        );
      case "settings":
        return <ViewSettings data={data} />;
      default:
        return <ViewOverview data={data} onImpersonate={handleImpersonate} onNav={handleNav} onRefresh={refresh} />;
    }
  };

  return (
    <div id="platform-console-root">
      <div className={`app-shell ${collapsed ? "compact" : ""}`}>
        <Sidebar
          current={view}
          onNav={handleNav}
          data={data}
          superadminName={superadminName}
          superadminInitials={superadminInitials}
          homologationLabel={environmentLabel}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
          pendingCommercialRequests={commercialBadge.loaded ? commercialBadge.pendingCount : 0}
        />
        <div className="main-col">
          {impersonate.propertyName && (
            <ImpersonationBanner
              context={impersonate}
              onExit={handleExitImpersonation}
              onViewLogs={() => setView("logs")}
            />
          )}
          <Topbar
            current={view}
            onOpenCmd={() => setCmdOpen(true)}
            onOpenProperty={() => setOpenPropertyOpen(true)}
            onOpenDemo={() => setDemoPropertyOpen(true)}
            onExitConsole={onExitConsole}
            superadminInitials={superadminInitials}
          />
          <main className="content">{renderView()}</main>
        </div>
        <CommandPalette
          open={cmdOpen}
          onClose={() => setCmdOpen(false)}
          onNav={handleNav}
          onImpersonate={handleImpersonate}
          properties={data.properties}
        />
        <OpenPropertyModal
          open={openPropertyOpen}
          onClose={() => setOpenPropertyOpen(false)}
          saasOrigin={saasOrigin}
        />
        <NewPropertyModal
          open={newPropertyOpen}
          onClose={() => setNewPropertyOpen(false)}
          onCreated={handleCreated}
        />
        <DemoPropertyModal
          open={demoPropertyOpen}
          onClose={() => setDemoPropertyOpen(false)}
          onCreated={handleCreated}
          saasOrigin={saasOrigin}
        />
      </div>
    </div>
  );
}

export default PlatformConsoleApp;
