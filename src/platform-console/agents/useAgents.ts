// Hook that merges the static agent registry with whatever runtime the
// SaaS backend exposes (currently a stub at /api/platform/agents/status).
//
// The merge is deterministic: every agent in AGENT_REGISTRY appears in
// the result, in the registry order. Runtime data, when present,
// overrides the `defaults` block. If runtime is unavailable the agent
// renders with `hasRuntime = false` so the UI can show "não conectado"
// honestly.

import { useEffect, useMemo, useState } from "react";
import { AGENT_REGISTRY } from "./agentRegistry";
import {
  mergeAgent,
  type AgentRuntime,
  type AgentView,
} from "./agentCapabilities";
import { agentsApi } from "../services/agentsApi";

export interface UseAgentsResult {
  agents: AgentView[];
  source: "backend" | "registry";
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAgents(): UseAgentsResult {
  const [runtime, setRuntime] = useState<AgentRuntime[]>([]);
  const [source, setSource] = useState<"backend" | "registry">("registry");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    agentsApi
      .fetchStatus()
      .then((payload) => {
        if (cancelled) return;
        setRuntime(payload.agents ?? []);
        setSource(payload.source === "backend" ? "backend" : "registry");
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.debug("[platform-console] agents status unavailable:", err.message);
        setRuntime([]);
        setSource("registry");
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const agents = useMemo<AgentView[]>(() => {
    const byId = new Map(runtime.map((r) => [r.id, r] as const));
    return AGENT_REGISTRY.map((def) => mergeAgent(def, byId.get(def.id)));
  }, [runtime]);

  return {
    agents,
    source,
    loading,
    error,
    refresh: () => setReloadKey((k) => k + 1),
  };
}
