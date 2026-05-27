// Roomix Platform Console — empty/honest fallback payload.
//
// This file replaces `mockData.ts` as the default initial state for
// the data hook. It contains ZERO fictional content: no fake
// properties, no fake metrics, no fake approvals, no fake timeline.
//
// We use it for:
//   * the initial useState() value before the backend responds
//     (prevents the "flash of fake data" the operator reported);
//   * the fallback when the API errors out (the UI shows a clear
//     "erro de API" banner via `source: "error"` — we NEVER silently
//     fall back to mock data).
//
// Demo data (`mockData.ts`) lives in a separate module and is only
// loaded via dynamic `import()` when the flag
// `VITE_PLATFORM_CONSOLE_DEMO_DATA=true` is set at build time.
// In a default production build the demo strings are split into a
// chunk that is never requested, so they cannot appear on screen
// even for a millisecond.

import type { ConsoleOverview } from "./types";

export const EMPTY_OVERVIEW: ConsoleOverview = {
  today: "",
  source: "loading",
  unavailable: ["bootstrap"],
  metrics: {
    totalProperties: 0,
    activeProperties: 0,
    units: 0,
    mrr: 0,
    revenueForecast30d: 0,
    openOverbookings: 0,
    cmIncidents: 0,
    checkinsToday: 0,
    fnrhPending: 0,
    overdueInvoices: 0,
    overdueAmount: 0,
    activeAgents: 0,
    totalAgents: 0,
  },
  properties: [],
  alerts: [],
  timeline: [],
  cmTable: [],
  cmFeed: [],
  overbookings: [],
  agents: [],
  approvals: [],
  clients: [],
  logs: [],
  fnrh: [],
  plansData: [],
  mrrSeries: [],
  reservationsSeries: [],
  occupancySeries: [],
};

// Frozen copy guards against any caller accidentally mutating the
// shared singleton (which would leak fake state across mounts).
Object.freeze(EMPTY_OVERVIEW);
Object.freeze(EMPTY_OVERVIEW.metrics);
