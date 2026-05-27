// Public surface of the Platform Console module.
// `App.tsx` imports the default export and renders it inside the existing
// view switch, gated by `canUseInternalRoomixModules(user)`.

export { PlatformConsoleApp, default } from "./PlatformConsoleApp";
export type { PlatformConsoleAppProps } from "./PlatformConsoleApp";
export type {
  ConsoleOverview,
  ConsoleViewId,
  PropertySummary,
  AgentSummary,
  AlertItem,
  OverbookingIncident,
  AuditLogEntry,
} from "./types";
