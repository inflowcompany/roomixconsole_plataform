// Hook that exposes the platform console payload to every view.
//
// Contract (post-fix):
//   • Initial state is `EMPTY_OVERVIEW` — zero fake data, ever. The
//     operator no longer sees demo strings flash on screen during
//     boot.
//   • On success: the backend payload (always with `source: "backend"`).
//   • On failure: `EMPTY_OVERVIEW` with `source: "error"` plus the
//     thrown Error in `error`. The UI shows an explicit failure
//     banner; we never silently impersonate a real response.
//   • Demo mode: ONLY when `VITE_PLATFORM_CONSOLE_DEMO_DATA=true` at
//     build time. The mock module is loaded with a dynamic `import()`
//     so Vite splits it into a separate chunk and the strings never
//     enter the production main bundle.

import { useEffect, useState } from "react";
import { platformConsoleApi } from "../services/platformConsoleApi";
import type { ConsoleOverview } from "../types";
import { EMPTY_OVERVIEW } from "../emptyOverview";

export interface UseConsoleDataResult {
  data: ConsoleOverview;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

// Inlined as a constant boolean at build time by Vite's env replace,
// so the conditional branch below is fully dead-code-eliminated when
// the flag isn't set.
const DEMO_ENABLED = import.meta.env.VITE_PLATFORM_CONSOLE_DEMO_DATA === "true";

export function useConsoleData(): UseConsoleDataResult {
  const [data, setData] = useState<ConsoleOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // -----------------------------------------------------------------
    // Demo branch — explicit operator opt-in, banner visible on every
    // screen. Dynamically imported so prod bundles do not carry the
    // mock strings.
    // -----------------------------------------------------------------
    if (DEMO_ENABLED) {
      void (async () => {
        try {
          const mod = await import("../mockData");
          if (cancelled) return;
          setData({ ...mod.demoOverview, source: "demo" });
        } catch (err) {
          if (cancelled) return;
          setData({ ...EMPTY_OVERVIEW, source: "error" });
          setError(err instanceof Error ? err : new Error("demo_load_failed"));
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    // -----------------------------------------------------------------
    // Production branch — single fetch, no silent fallback.
    // -----------------------------------------------------------------
    platformConsoleApi
      .fetchOverview()
      .then((payload) => {
        if (cancelled) return;
        setData({ ...payload, source: "backend" });
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn("[platform-console] overview fetch failed:", err.message);
        // Keep EMPTY data so views render honest empty states; the UI
        // banner is driven by `source: "error"`.
        setData({ ...EMPTY_OVERVIEW, source: "error" });
        setError(err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return {
    data,
    loading,
    error,
    refresh: () => setReloadKey((k) => k + 1),
  };
}
