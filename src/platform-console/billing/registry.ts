// Roomix Platform Console — billing/plan registry.
//
// 1:1 port of the constants and helpers from the Roomix SaaS
// (`src/App.tsx` around line 9253). Source of truth lives in the SaaS;
// when those constants change there, this file MUST be updated in
// lockstep — there is no runtime feed for them yet.
//
// We never invent numbers here. All values come straight from the
// SaaS implementation referenced above.

export type PlanTier = "Starter" | "Growth" | "Evolution" | "Enterprise";

export type ChannelAddonId =
  | "booking"
  | "airbnb"
  | "expedia"
  | "hostelworld"
  | "google-hotel"
  | "wubook"
  | "romix-direct";

export type UnitBillingMode = "PER_ROOM" | "PER_BED" | "MIXED";

export const CHANNEL_UNIT_PRICE_MONTHLY = 119;
export const SETUP_FEE_PLACEHOLDER = 0;

export const PLAN_MONTHLY_PRICES: Record<PlanTier, number> = {
  Starter: 199,
  Growth: 299,
  Evolution: 499,
  Enterprise: 899,
};

export const PLAN_INCLUDED_UNITS: Record<PlanTier, number | null> = {
  Starter: 5,
  Growth: 15,
  Evolution: 40,
  Enterprise: null,
};

export const PLAN_EXTRA_UNIT_PRICES: Record<PlanTier, number> = {
  Starter: 15,
  Growth: 12,
  Evolution: 9,
  Enterprise: 0,
};

// View ids the SaaS treats as PMS "essential modules" — always
// provisioned, never deselectable. Each id matches the canonical
// View enum in the SaaS.
export const CORE_REQUIRED_MODULES = [
  "map",
  "list",
  "rates",
  "reports",
  "setup",
  "full-reservation",
  "checkin-queue",
  "booking-engine",
] as const;

export type CoreModuleId = (typeof CORE_REQUIRED_MODULES)[number];

// Per-plan optional modules. Starter ships with the smallest set,
// Enterprise unlocks everything that's not flagged internal.
export const MODULE_ENTITLEMENTS: Record<PlanTier, string[]> = {
  Starter: ["messages", "housekeeping"],
  Growth: ["dashboard", "housekeeping", "messages", "crm"],
  Evolution: ["dashboard", "housekeeping", "messages", "crm", "inventory", "analytics", "automations", "finance"],
  Enterprise: [
    "dashboard",
    "housekeeping",
    "messages",
    "crm",
    "inventory",
    "analytics",
    "automations",
    "finance",
    "integrations",
  ],
};

// All optional modules the SaaS exposes in the provisioning UI, with
// their human label (PT-BR — same wording the SaaS uses).
export interface OptionalModuleDef {
  id: string;
  label: string;
  icon: string;
  /** When true, no plan can opt-in; the UI shows "em breve". */
  comingSoon?: boolean;
  /** When true, this is sold as an add-on rather than a plan inclusion. */
  addOn?: boolean;
}

export const OPTIONAL_MODULES: OptionalModuleDef[] = [
  { id: "dashboard", label: "Painel Executivo", icon: "layout-dashboard" },
  { id: "housekeeping", label: "S.O. Governança", icon: "sparkles" },
  { id: "messages", label: "Mensagens S.O.", icon: "message-square" },
  { id: "crm", label: "Hóspedes e CRM", icon: "users" },
  { id: "inventory", label: "Inventário & POS", icon: "layers" },
  { id: "analytics", label: "Pulso Operacional", icon: "bar-chart-3" },
  { id: "automations", label: "Automações", icon: "zap" },
  { id: "finance", label: "Financeiro", icon: "receipt" },
  { id: "integrated-payments", label: "Pagamentos Integrados", icon: "receipt", addOn: true },
  { id: "tax-fiscal", label: "Nota Fiscal & Fiscal", icon: "receipt", comingSoon: true },
  { id: "integrations", label: "Integrações", icon: "plug" },
];

export const CORE_MODULE_LABELS: Record<CoreModuleId, { label: string; icon: string }> = {
  map: { label: "Mapa de Reservas", icon: "map" },
  list: { label: "Lista de Reservas", icon: "list" },
  rates: { label: "Tarifas e Disponibilidade", icon: "receipt" },
  reports: { label: "Relatórios", icon: "clipboard-list" },
  setup: { label: "Configuração da Propriedade", icon: "settings" },
  "full-reservation": { label: "Detalhes Básicos da Reserva / Fatura", icon: "file-text" },
  "checkin-queue": { label: "Check-in / Checkout Básico", icon: "user" },
  "booking-engine": { label: "Roomix Direct", icon: "rocket" },
};

export const CHANNEL_ADD_ONS: { id: ChannelAddonId; label: string }[] = [
  { id: "booking", label: "Booking.com" },
  { id: "airbnb", label: "Airbnb" },
  { id: "expedia", label: "Expedia" },
  { id: "hostelworld", label: "Hostelworld" },
  { id: "google-hotel", label: "Google Hotel" },
  { id: "wubook", label: "Wubook" },
  { id: "romix-direct", label: "Roomix Direct" },
];

// ---- helpers -------------------------------------------------------

export const isCoreRequiredModule = (id: string): id is CoreModuleId =>
  (CORE_REQUIRED_MODULES as readonly string[]).includes(id);

export const ensureCoreModules = (modules: string[] = []): string[] => {
  const set = new Set<string>();
  for (const id of CORE_REQUIRED_MODULES) set.add(id);
  for (const id of modules) set.add(id);
  return Array.from(set);
};

export const getDefaultModulesForPlan = (plan: PlanTier): string[] =>
  ensureCoreModules(MODULE_ENTITLEMENTS[plan] ?? MODULE_ENTITLEMENTS.Starter);

/**
 * Whether a given module ships INSIDE the plan's default bundle.
 * Used purely for UI hints ("Incluído", "Adicional", "Recomendado X"),
 * NOT for blocking selection — the Platform Console is a superadmin
 * tool, and the operator can attach any implemented optional module
 * to any plan as part of the commercial agreement.
 *
 * Returns false for `comingSoon` modules regardless of plan.
 */
export const isModuleInPlanBundle = (plan: PlanTier, moduleId: string): boolean => {
  if (isCoreRequiredModule(moduleId)) return true;
  return (MODULE_ENTITLEMENTS[plan] ?? []).includes(moduleId);
};

/**
 * The smallest plan tier that ships `moduleId` in its default bundle.
 * Returns null if the module is not in any plan's bundle (still
 * selectable as an add-on / contractual extra). Used to render the
 * "Recomendado {Plan}" informational badge.
 */
export const smallestPlanIncluding = (moduleId: string): PlanTier | null => {
  for (const plan of ["Starter", "Growth", "Evolution", "Enterprise"] as PlanTier[]) {
    if ((MODULE_ENTITLEMENTS[plan] ?? []).includes(moduleId)) return plan;
  }
  return null;
};

/**
 * @deprecated Kept temporarily for callers that still expect the old
 * blocking semantics. New code should use `isModuleInPlanBundle` for
 * UI hints — Platform Console never blocks an implemented module by
 * plan.
 */
export const isModuleAvailableForPlan = (plan: PlanTier, moduleId: string): boolean =>
  isModuleInPlanBundle(plan, moduleId);

// ---- billing calculations -----------------------------------------

export const getPlanMonthlyPrice = (plan: PlanTier): number => PLAN_MONTHLY_PRICES[plan];
export const getPlanIncludedUnits = (plan: PlanTier): number | null => PLAN_INCLUDED_UNITS[plan];
export const getPlanExtraUnitPrice = (plan: PlanTier): number => PLAN_EXTRA_UNIT_PRICES[plan];

export interface ChannelEntitlements {
  contractedCount: number;
  selectedChannels: ChannelAddonId[];
  unitPriceMonthly: number;
  totalMonthly: number;
}

export const buildChannelEntitlements = (
  selectedChannels: ChannelAddonId[] = [],
  contractedCount = selectedChannels.length,
  unitPriceMonthly = CHANNEL_UNIT_PRICE_MONTHLY,
): ChannelEntitlements => {
  const channels = Array.from(new Set(selectedChannels));
  const count = Math.max(contractedCount || 0, channels.length);
  return {
    contractedCount: count,
    selectedChannels: channels,
    unitPriceMonthly,
    totalMonthly: channels.length * unitPriceMonthly,
  };
};

const calculateBillableUnitCount = ({
  unitCapacity = 1,
  bedCount = 0,
  privateRoomCount,
  unitBillingMode = "PER_ROOM",
}: {
  unitCapacity?: number;
  bedCount?: number;
  privateRoomCount?: number;
  unitBillingMode?: UnitBillingMode;
}) => {
  const safeUnits = Math.max(1, unitCapacity || 1);
  const safeBeds = Math.max(0, bedCount || 0);
  const safePrivateRooms = Math.max(0, privateRoomCount ?? safeUnits);
  if (unitBillingMode === "PER_BED") return Math.max(1, safeBeds || safeUnits);
  if (unitBillingMode === "MIXED") return Math.max(1, safePrivateRooms + safeBeds);
  return safeUnits;
};

export interface BillingEstimate {
  planTier: PlanTier;
  planMonthly: number;
  channelMonthly: number;
  unitMonthly: number;
  unitCapacity: number;
  billableUnitCount: number;
  unitBillingMode: UnitBillingMode;
  baseIncludedUnits: number | null;
  extraUnits: number;
  extraUnitPriceMonthly: number;
  unitMonthlyTotal: number;
  channelCount: number;
  channelUnitPriceMonthly: number;
  setupFee: number;
  totalMonthly: number;
  estimatedMonthlyTotal: number;
  firstInvoiceTotal: number;
  currency: string;
  billingCycle: "monthly";
  status: "trial" | "active";
  calculatedAt: string;
}

export const buildBillingEstimate = (
  planTier: PlanTier,
  currency: string,
  channelEntitlements: ChannelEntitlements,
  unitConfig: {
    unitCapacity?: number;
    bedCount?: number;
    privateRoomCount?: number;
    unitBillingMode?: UnitBillingMode;
    extraUnitPriceMonthly?: number;
    setupFee?: number;
    status?: "trial" | "active";
  } = {},
): BillingEstimate => {
  const planMonthly = getPlanMonthlyPrice(planTier);
  const channelMonthly = channelEntitlements.totalMonthly;
  const unitCapacity = Math.max(1, unitConfig.unitCapacity || 1);
  const unitBillingMode = unitConfig.unitBillingMode || "PER_ROOM";
  const billableUnitCount = calculateBillableUnitCount({
    unitCapacity,
    bedCount: unitConfig.bedCount,
    privateRoomCount: unitConfig.privateRoomCount,
    unitBillingMode,
  });
  const baseIncludedUnits = getPlanIncludedUnits(planTier);
  const configuredExtraUnitPriceMonthly = unitConfig.extraUnitPriceMonthly ?? getPlanExtraUnitPrice(planTier);
  const extraUnitPriceMonthly = baseIncludedUnits === null ? 0 : configuredExtraUnitPriceMonthly;
  const extraUnits = baseIncludedUnits === null ? 0 : Math.max(0, billableUnitCount - baseIncludedUnits);
  const unitMonthlyTotal = baseIncludedUnits === null ? 0 : extraUnits * extraUnitPriceMonthly;
  const estimatedMonthlyTotal = planMonthly + channelMonthly + unitMonthlyTotal;
  const setupFee = Math.max(0, unitConfig.setupFee ?? SETUP_FEE_PLACEHOLDER);
  return {
    planTier,
    planMonthly,
    channelMonthly,
    unitMonthly: unitMonthlyTotal,
    unitCapacity,
    billableUnitCount,
    unitBillingMode,
    baseIncludedUnits,
    extraUnits,
    extraUnitPriceMonthly,
    unitMonthlyTotal,
    channelCount: channelEntitlements.selectedChannels.length,
    channelUnitPriceMonthly: channelEntitlements.unitPriceMonthly,
    setupFee,
    totalMonthly: estimatedMonthlyTotal,
    estimatedMonthlyTotal,
    firstInvoiceTotal: estimatedMonthlyTotal + setupFee,
    currency,
    billingCycle: "monthly",
    status: unitConfig.status || "trial",
    calculatedAt: new Date().toISOString(),
  };
};
