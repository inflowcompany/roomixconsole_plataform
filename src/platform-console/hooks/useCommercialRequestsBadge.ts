// Polls /api/platform/commercial-requests every 30s to keep:
//   • the sidebar badge count (pending = requested + in_review)
//   • a toast that fires when a NEW pending request arrives (id never
//     seen by this operator before) — we track a "seen set" of request
//     ids in localStorage so:
//       — first load is silent (we just record what's already there);
//       — reloading the Console doesn't re-trigger the same toast;
//       — a status flip on an already-seen request stays silent.
//
// Pause behavior:
//   • When the tab is hidden (document.hidden), the polling waits and
//     resumes on visibilitychange. Operators don't want background
//     traffic when the Console isn't even on screen.
//   • When the network is offline (navigator.onLine === false), the
//     same pause applies.
//
// Errors are swallowed (badge stays at the last known value) so a
// transient 5xx doesn't spam the operator with toasts.

import { useCallback, useEffect, useRef, useState } from "react";
import { commercialRequestsApi, isPendingStatus, type CommercialRequest } from "../services/commercialRequestsApi";

const POLL_INTERVAL_MS = 30_000;
const SEEN_IDS_KEY = "roomix_console_commercial_seen_ids";
// Hard cap on how many ids we keep in localStorage to avoid unbounded
// growth. We keep the most recent 500 by createdAt — that's enough to
// cover months of operator activity.
const MAX_SEEN_IDS = 500;

export interface CommercialRequestsBadge {
  pendingCount: number;
  /** True after the first successful fetch — UI uses this to decide whether to show 0 honestly. */
  loaded: boolean;
}

export interface ToastPayload {
  request: CommercialRequest;
  /** "Solicitação X · Pousada Y" already formatted for the toast title. */
  title: string;
  /** Friendly module label (e.g. "Pagamentos integrados"). */
  moduleLabel: string;
}

export type ToastHandler = (payload: ToastPayload) => void;

const MODULE_LABEL: Record<string, string> = {
  upgrade: "Upgrade de plano",
  integrated_payments: "Pagamentos integrados",
  channel_manager: "Channel Manager",
  fnrh_production: "FNRH Digital",
  agents: "Agentes Roomix",
};

function moduleLabel(module: string): string {
  return MODULE_LABEL[module] || module;
}

function readSeenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeSeenIds(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    const arr = Array.from(set);
    // Keep the tail — most recent additions.
    const trimmed = arr.length > MAX_SEEN_IDS ? arr.slice(-MAX_SEEN_IDS) : arr;
    window.localStorage.setItem(SEEN_IDS_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage may be quota-full; silent.
  }
}

export function useCommercialRequestsBadge(onNew?: ToastHandler): CommercialRequestsBadge {
  const [pendingCount, setPendingCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const onNewRef = useRef<ToastHandler | undefined>(onNew);
  onNewRef.current = onNew;
  const isFirstFetchRef = useRef(true);
  const seenIdsRef = useRef<Set<string>>(readSeenIds());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      // Pause silently when the tab is hidden or the browser thinks
      // we're offline. Don't even hit the backend.
      if (typeof document !== "undefined" && document.hidden) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
        return;
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
        return;
      }

      try {
        const requests = await commercialRequestsApi.list(200);
        if (cancelled) return;

        const pending = requests.filter((r) => isPendingStatus(r.status));
        const pendingCountNow = pending.length;

        if (isFirstFetchRef.current) {
          // First successful fetch — mark every existing id as seen so
          // we don't toast for history. Subsequent ticks only toast on
          // genuinely new ids.
          const seen = seenIdsRef.current;
          for (const r of requests) seen.add(r.id);
          writeSeenIds(seen);
          isFirstFetchRef.current = false;
        } else if (onNewRef.current) {
          const seen = seenIdsRef.current;
          const newPending = pending.filter((r) => !seen.has(r.id));
          // Toast one notification per genuinely new request. Multiple
          // arriving in the same tick all get their own toast so the
          // operator can act on each.
          for (const r of newPending) {
            onNewRef.current({
              request: r,
              title:
                `Nova solicitação comercial${r.propertyId ? ` · ${shortenId(r.propertyId)}` : ""}`,
              moduleLabel: moduleLabel(r.requestedModule),
            });
          }
          if (newPending.length > 0) {
            for (const r of newPending) seen.add(r.id);
            // Also remember non-pending updates so a request that
            // flips from approved → completed doesn't re-trigger.
            for (const r of requests) seen.add(r.id);
            writeSeenIds(seen);
          }
        }

        setPendingCount(pendingCountNow);
        setLoaded(true);
      } catch {
        // Silent — keep last known count. The dedicated Solicitações
        // view shows the failure honestly.
      } finally {
        if (!cancelled) {
          timer = setTimeout(tick, POLL_INTERVAL_MS);
        }
      }
    };

    void tick();

    // Resume immediately when the tab regains focus.
    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (!document.hidden && !cancelled) {
        if (timer) clearTimeout(timer);
        void tick();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, []);

  return { pendingCount, loaded };
}

/**
 * Imperatively mark a request as already seen — used when the operator
 * actually opens the Solicitações view. The badge keeps the count
 * visible (it reflects backend state, not local seen-set), but the
 * toast handler stops re-firing.
 */
export function ackCommercialRequestsSeen(ids: string[] | number): void {
  // Backwards compat: the previous signature accepted a count. We now
  // accept an array of ids — when called with a number, we just write
  // a marker so the migration path doesn't break.
  if (typeof ids === "number") {
    return; // legacy no-op
  }
  const seen = readSeenIds();
  for (const id of ids) seen.add(id);
  writeSeenIds(seen);
}

/**
 * Drop the entire seen set. Call this on logout so the next operator
 * (on the same machine) doesn't inherit someone else's seen state.
 */
export function resetCommercialRequestsSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SEEN_IDS_KEY);
  } catch {
    // ignore
  }
}

function shortenId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}
