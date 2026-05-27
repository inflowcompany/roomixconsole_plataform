// "Criar conta individual" — full provisioning form, mirrored 1:1
// with the SaaS `AddPropertyModal` (App.tsx :41503).
//
// Sections (numbered like the SaaS):
//   01 — Identidade e localização
//   02 — Plano, operação e faturamento
//   03 — Módulos essenciais obrigatórios + opcionais (PMS)
//   04 — Canais e estimativa mensal
//
// All selects use ConsoleSelect (dark, scoped) — no native dropdowns.
// Plan logic, module entitlements, channels and billing estimate come
// from `billing/registry.ts`, which ports the SaaS constants byte-for-byte.
//
// Payload: POST /api/properties — known columns at the top level,
// everything else in `metadata` so the SaaS can absorb it once the
// schema is widened (today the SaaS persists name, code, address,
// timezone, currency, locale, planTier, unitCapacity, brandColor).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "./Modal";
import { Icon } from "../components";
import { ConsoleSelect } from "./ConsoleSelect";
import { useToast } from "./Toast";
import {
  CHANNEL_ADD_ONS,
  CHANNEL_UNIT_PRICE_MONTHLY,
  CORE_MODULE_LABELS,
  CORE_REQUIRED_MODULES,
  OPTIONAL_MODULES,
  buildBillingEstimate,
  buildChannelEntitlements,
  ensureCoreModules,
  getDefaultModulesForPlan,
  isModuleInPlanBundle,
  smallestPlanIncluding,
  type ChannelAddonId,
  type PlanTier,
  type UnitBillingMode,
} from "../billing/registry";

interface NewPropertyModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (property: { id: string; name: string }) => void;
  saasOrigin?: string;
}

type PropertyCategory =
  | "hotel"
  | "hostel"
  | "pousada"
  | "guest-house"
  | "vacation-rental"
  | "apartments-rooms"
  | "multi-address";

type LegalDocumentType = "CPF" | "CNPJ" | "OTHER";
type PropertyStatus = "trial" | "active";
type Language = "pt-BR" | "en" | "es";

interface FormState {
  // 01
  name: string;
  propertyCode: string;
  propertyColor: string;
  propertyType: PropertyCategory;
  responsibleName: string;
  responsibleEmail: string;
  propertyEmail: string;
  propertyPhone: string;
  legalDocumentType: LegalDocumentType;
  legalDocumentNumber: string;
  legalCompanyName: string;
  billingLegalName: string;
  billingEmail: string;
  postalCode: string;
  street: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  // 02
  planTier: PlanTier;
  defaultLanguage: Language;
  currency: string;
  timezone: string;
  unitCapacity: number;
  sharedBedCount: number;
  unitBillingMode: UnitBillingMode;
  status: PropertyStatus;
  // 03
  selectedModules: string[];
  // 04
  selectedChannels: ChannelAddonId[];
  contractedChannelCount: number;
  // 05
  internalNotes: string;
}

const INITIAL: FormState = {
  name: "",
  propertyCode: "",
  propertyColor: "#18D39A",
  propertyType: "hotel",
  responsibleName: "",
  responsibleEmail: "",
  propertyEmail: "",
  propertyPhone: "",
  legalDocumentType: "CNPJ",
  legalDocumentNumber: "",
  legalCompanyName: "",
  billingLegalName: "",
  billingEmail: "",
  postalCode: "",
  street: "",
  addressNumber: "",
  addressComplement: "",
  neighborhood: "",
  city: "",
  state: "",
  country: "Brasil",
  planTier: "Starter",
  defaultLanguage: "pt-BR",
  currency: "BRL",
  timezone: "America/Sao_Paulo",
  unitCapacity: 1,
  sharedBedCount: 0,
  unitBillingMode: "PER_ROOM",
  status: "trial",
  selectedModules: getDefaultModulesForPlan("Starter"),
  selectedChannels: [],
  contractedChannelCount: 0,
  internalNotes: "",
};

const PROPERTY_TYPE_OPTIONS = [
  { value: "hotel", label: "Hotel" },
  { value: "hostel", label: "Hostel" },
  { value: "pousada", label: "Pousada" },
  { value: "guest-house", label: "Casa de hóspedes" },
  { value: "vacation-rental", label: "Aluguel por temporada" },
  { value: "apartments-rooms", label: "Apartamentos / quartos" },
  { value: "multi-address", label: "Multi-endereço" },
] as const;

const COUNTRY_OPTIONS = ["Brasil", "Portugal", "Argentina", "Uruguai", "Chile", "México", "Espanha"].map((c) => ({
  value: c,
  label: c,
}));

const TIMEZONE_OPTIONS = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Rio_Branco",
  "America/Belem",
  "Europe/Lisbon",
  "Europe/Madrid",
  "UTC",
].map((tz) => ({ value: tz, label: tz }));

const LEGAL_DOC_OPTIONS = [
  { value: "CNPJ" as LegalDocumentType, label: "CNPJ" },
  { value: "CPF" as LegalDocumentType, label: "CPF" },
  { value: "OTHER" as LegalDocumentType, label: "Outro" },
];

const PLAN_OPTIONS: Array<{ value: PlanTier; label: string; meta?: string }> = [
  { value: "Starter", label: "Starter", meta: "R$ 199" },
  { value: "Growth", label: "Growth", meta: "R$ 299" },
  { value: "Evolution", label: "Evolution", meta: "R$ 499" },
  { value: "Enterprise", label: "Enterprise", meta: "R$ 899" },
];

const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "pt-BR", label: "Português (BR)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

const CURRENCY_OPTIONS = [
  { value: "BRL", label: "BRL — Real" },
  { value: "USD", label: "USD — Dollar" },
  { value: "EUR", label: "EUR — Euro" },
];

const UNIT_BILLING_OPTIONS: Array<{ value: UnitBillingMode; label: string }> = [
  { value: "PER_ROOM", label: "Por quarto / unidade" },
  { value: "PER_BED", label: "Por cama (hostel)" },
  { value: "MIXED", label: "Misto (cama + quarto)" },
];

const STATUS_OPTIONS: Array<{ value: PropertyStatus; label: string }> = [
  { value: "trial", label: "Trial" },
  { value: "active", label: "Ativa" },
];

const fmtBRL = (n: number, currency = "BRL") =>
  n.toLocaleString("pt-BR", { style: "currency", currency, minimumFractionDigits: 2 });

export function NewPropertyModal({ open, onClose, onCreated }: NewPropertyModalProps) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [cepMessage, setCepMessage] = useState("");
  const toast = useToast();

  const isBrazil = ["brasil", "brazil", "br"].includes(form.country.trim().toLowerCase());

  // ----- Form-level undo/redo -------------------------------------
  // Native undo on React-controlled inputs is unreliable: every
  // setState triggers a re-render that can clobber the browser's
  // input-undo stack. We maintain our own deterministic history
  // here. Rapid sequential keystrokes (within 500ms) are coalesced
  // into a single undo step so Ctrl+Z reverts a word, not a letter.
  const historyRef = useRef<{ undo: FormState[]; redo: FormState[]; lastChangeAt: number }>({
    undo: [],
    redo: [],
    lastChangeAt: 0,
  });

  useEffect(() => {
    if (!open) {
      setForm(INITIAL);
      setError(null);
      setSubmitting(false);
      setCepStatus("idle");
      setCepMessage("");
      historyRef.current = { undo: [], redo: [], lastChangeAt: 0 };
    }
  }, [open]);

  const update = useCallback((patch: Partial<FormState>) => {
    setForm((prev) => {
      const now = Date.now();
      // Coalesce: only push history if the previous change is older
      // than 500ms (treats fast typing/burst as one step).
      if (now - historyRef.current.lastChangeAt > 500) {
        historyRef.current.undo.push(prev);
        if (historyRef.current.undo.length > 50) historyRef.current.undo.shift();
        // Any new change invalidates the redo stack.
        historyRef.current.redo = [];
      }
      historyRef.current.lastChangeAt = now;
      return { ...prev, ...patch };
    });
  }, []);

  const undo = useCallback(() => {
    const prev = historyRef.current.undo.pop();
    if (!prev) return;
    setForm((current) => {
      historyRef.current.redo.push(current);
      // Reset coalescing so the next typing starts a fresh group.
      historyRef.current.lastChangeAt = 0;
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    const next = historyRef.current.redo.pop();
    if (!next) return;
    setForm((current) => {
      historyRef.current.undo.push(current);
      historyRef.current.lastChangeAt = 0;
      return next;
    });
  }, []);

  // ----- Derived: channel entitlements + billing estimate ----------
  const channelEntitlements = useMemo(
    () =>
      buildChannelEntitlements(
        form.selectedChannels,
        Math.max(form.contractedChannelCount, form.selectedChannels.length),
        CHANNEL_UNIT_PRICE_MONTHLY,
      ),
    [form.selectedChannels, form.contractedChannelCount],
  );

  const billing = useMemo(
    () =>
      buildBillingEstimate(form.planTier, form.currency, channelEntitlements, {
        unitCapacity: form.unitCapacity,
        bedCount: form.sharedBedCount,
        unitBillingMode: form.unitBillingMode,
        status: form.status,
      }),
    [form.planTier, form.currency, form.unitCapacity, form.sharedBedCount, form.unitBillingMode, form.status, channelEntitlements],
  );

  // ----- Module toggle (essentials are immutable) ------------------
  const toggleModule = (id: string) => {
    if ((CORE_REQUIRED_MODULES as readonly string[]).includes(id)) return;
    setForm((prev) => {
      const isSelected = prev.selectedModules.includes(id);
      const nextSel = isSelected ? prev.selectedModules.filter((m) => m !== id) : [...prev.selectedModules, id];
      return { ...prev, selectedModules: ensureCoreModules(nextSel) };
    });
  };

  // When the plan changes, take the UNION of:
  //   • current selection (preserves manual add-ons the superadmin
  //     already picked — the Platform Console never silently drops
  //     a deliberate choice when the plan changes),
  //   • the new plan's default bundle (auto-adds whatever ships with
  //     the new tier so the operator does not have to re-tick).
  // Essentials are always present via ensureCoreModules().
  const setPlan = (plan: PlanTier) => {
    setForm((prev) => {
      const merged = Array.from(new Set([...prev.selectedModules, ...getDefaultModulesForPlan(plan)]));
      return { ...prev, planTier: plan, selectedModules: ensureCoreModules(merged) };
    });
  };

  const toggleChannel = (id: ChannelAddonId) => {
    setForm((prev) => {
      const has = prev.selectedChannels.includes(id);
      const nextChannels = has ? prev.selectedChannels.filter((c) => c !== id) : [...prev.selectedChannels, id];
      return { ...prev, selectedChannels: nextChannels, contractedChannelCount: nextChannels.length };
    });
  };

  // ----- Validation ------------------------------------------------
  const isReady = Boolean(
    form.name.trim() &&
      form.responsibleName.trim() &&
      form.responsibleEmail.trim() &&
      form.city.trim() &&
      form.country.trim() &&
      form.unitCapacity > 0,
  );

  // ----- CEP lookup ------------------------------------------------
  const lookupCep = async () => {
    if (!isBrazil) return;
    const digits = form.postalCode.replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepStatus("error");
      setCepMessage("Informe um CEP com 8 dígitos.");
      return;
    }
    setCepStatus("loading");
    setCepMessage("");
    try {
      const response = await fetch(`/api/addresses/br/cep/${encodeURIComponent(digits)}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(response.status === 404 ? "CEP_NOT_FOUND" : `HTTP_${response.status}`);
      }
      const payload = (await response.json()) as { address?: Partial<FormState> };
      const addr = payload.address || {};
      setForm((prev) => ({
        ...prev,
        postalCode: typeof addr.postalCode === "string" ? addr.postalCode : prev.postalCode,
        street: typeof addr.street === "string" ? addr.street : prev.street,
        neighborhood: typeof addr.neighborhood === "string" ? addr.neighborhood : prev.neighborhood,
        city: typeof addr.city === "string" ? addr.city : prev.city,
        state: typeof addr.state === "string" ? addr.state : prev.state,
        country: "Brasil",
      }));
      setCepStatus("success");
      setCepMessage("Endereço preenchido pelo CEP. Revise o número e complemento.");
    } catch (err) {
      const code = err instanceof Error ? err.message : "NETWORK_ERROR";
      setCepStatus("error");
      setCepMessage(
        code === "CEP_NOT_FOUND"
          ? "CEP não encontrado. Preencha manualmente."
          : "Não foi possível consultar o CEP agora. Você pode preencher manualmente.",
      );
    }
  };

  // ----- Submit ----------------------------------------------------
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!isReady) {
      setError("Preencha nome, responsável, e-mail do responsável, cidade, país e unidades.");
      return;
    }
    setSubmitting(true);
    try {
      // selectedModules sits at the TOP LEVEL of the payload so
      // `normalizePropertyInput` in the SaaS picks it up and persists
      // it on the `properties.enabled_modules` column (migration 033).
      const sanitizedModules = ensureCoreModules(form.selectedModules);
      const body = {
        name: form.name.trim(),
        propertyCode: form.propertyCode.trim() || undefined,
        timezone: form.timezone,
        currency: form.currency,
        locale: form.defaultLanguage,
        planTier: form.planTier,
        unitCapacity: form.unitCapacity,
        postalCode: form.postalCode.trim() || undefined,
        street: form.street.trim() || undefined,
        addressNumber: form.addressNumber.trim() || undefined,
        addressComplement: form.addressComplement.trim() || undefined,
        neighborhood: form.neighborhood.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim() || undefined,
        country: form.country.trim() || "BR",
        brandColor: form.propertyColor,
        selectedModules: sanitizedModules,
        enabledModules: sanitizedModules,
        // Everything below is forwarded under `metadata` until the
        // SaaS schema absorbs these columns. Backend logs the
        // metadata via the audit pipeline.
        metadata: {
          responsibleName: form.responsibleName.trim(),
          responsibleEmail: form.responsibleEmail.trim(),
          propertyEmail: form.propertyEmail.trim() || undefined,
          propertyPhone: form.propertyPhone.trim() || undefined,
          propertyType: form.propertyType,
          legalDocumentType: form.legalDocumentType,
          legalDocumentNumber: form.legalDocumentNumber.trim() || undefined,
          legalCompanyName: form.legalCompanyName.trim() || undefined,
          billingLegalName: form.billingLegalName.trim() || undefined,
          billingEmail: form.billingEmail.trim() || undefined,
          sharedBedCount: form.sharedBedCount,
          unitBillingMode: form.unitBillingMode,
          initialStatus: form.status,
          selectedModules: ensureCoreModules(form.selectedModules),
          selectedChannels: form.selectedChannels,
          contractedChannelCount: channelEntitlements.contractedCount,
          billingEstimate: billing,
          internalNotes: form.internalNotes.trim() || undefined,
          createdVia: "platform-console",
        },
      };

      const response = await fetch("/api/properties", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (!response.ok) {
        const code = typeof payload?.error === "string" ? (payload.error as string) : `HTTP_${response.status}`;
        throw new Error(code);
      }
      const created = payload as { property?: { id?: string; name?: string }; id?: string; name?: string };
      const id = created.property?.id ?? created.id ?? "";
      const name = created.property?.name ?? created.name ?? form.name.trim();
      toast.show(`Propriedade "${name}" criada com sucesso.`, "brand");
      if (onCreated && id) onCreated({ id, name });
      onClose();
    } catch (err) {
      const code = err instanceof Error ? err.message : "NETWORK_ERROR";
      setError(messageFor(code));
      toast.show(`Falha ao criar propriedade: ${messageFor(code)}`, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !submitting && onClose()}
      title="Criar conta individual"
      sub="Protocolo da plataforma · novo provisionamento · superadmin only · audit log"
      icon="building-2"
      width="full"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            type="submit"
            form="pc-new-prop-form"
            className="btn primary"
            disabled={!isReady || submitting}
            title={
              submitting
                ? "Criando propriedade…"
                : isReady
                  ? "Criar a propriedade real no Roomix SaaS"
                  : (() => {
                      const missing: string[] = [];
                      if (!form.name.trim()) missing.push("nome");
                      if (!form.responsibleName.trim()) missing.push("responsável");
                      if (!form.responsibleEmail.trim()) missing.push("e-mail do responsável");
                      if (!form.city.trim()) missing.push("cidade");
                      if (!form.country.trim()) missing.push("país");
                      if (form.unitCapacity <= 0) missing.push("unidades > 0");
                      return `Preencha para habilitar: ${missing.join(", ")}.`;
                    })()
            }
          >
            {submitting ? (
              <>
                <Icon name="refresh-cw" size={12} /> Criando…
              </>
            ) : (
              <>
                <Icon name="building-2" size={12} /> Criar propriedade
              </>
            )}
          </button>
        </>
      }
    >
      <form
        id="pc-new-prop-form"
        onSubmit={onSubmit}
        autoComplete="off"
        onKeyDown={(e) => {
          // Form-level Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z. Captures inside
          // text inputs too so the operator gets predictable
          // word-level (or change-level) undo regardless of the
          // browser's native input-undo behaviour, which React
          // controlled inputs do not always preserve. preventDefault
          // is called so the browser does not also try to undo a
          // single keystroke on top of our state reversion.
          const isMod = e.ctrlKey || e.metaKey;
          if (!isMod) return;
          const k = e.key.toLowerCase();
          const isUndo = !e.shiftKey && k === "z";
          const isRedo = (e.shiftKey && k === "z") || k === "y";
          if (!isUndo && !isRedo) return;
          // Don't fight the submit shortcut Ctrl+Enter etc.
          e.preventDefault();
          e.stopPropagation();
          if (isUndo) undo();
          else redo();
        }}
      >
        <div className="pc-form-grid">
          <div>
            {/* ============ 01 ============ */}
            <SectionTitle index="01" label="Identidade e localização da propriedade" />

            <div className="pc-field-row">
              <Field label="Nome da propriedade *" hint="Ex.: Pousada Vista Mar">
                <input
                  data-autofocus
                  className="pc-field-input"
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Ex.: Romix Grand Hotel"
                  required
                  disabled={submitting}
                />
              </Field>
              <Field label="Nome do responsável *">
                <input
                  className="pc-field-input"
                  value={form.responsibleName}
                  onChange={(e) => update({ responsibleName: e.target.value })}
                  placeholder="Ex.: Eduardo Muniz"
                  required
                  disabled={submitting}
                />
              </Field>
            </div>

            <div className="pc-field-row">
              <Field label="E-mail do responsável *">
                <input
                  type="email"
                  className="pc-field-input"
                  value={form.responsibleEmail}
                  onChange={(e) => update({ responsibleEmail: e.target.value })}
                  placeholder="responsavel@propriedade.com"
                  required
                  disabled={submitting}
                />
              </Field>
              <Field label="Tipo / categoria da propriedade" hint="Ajuda a orientar inventário, cobrança e mapeamento futuro.">
                <ConsoleSelect
                  value={form.propertyType}
                  onChange={(v) => update({ propertyType: v as PropertyCategory })}
                  options={PROPERTY_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  disabled={submitting}
                />
              </Field>
            </div>

            <div className="pc-field-row">
              <Field label="E-mail da propriedade">
                <input
                  type="email"
                  className="pc-field-input"
                  value={form.propertyEmail}
                  onChange={(e) => update({ propertyEmail: e.target.value })}
                  placeholder="propriedade@email.com"
                  disabled={submitting}
                />
              </Field>
              <Field label="Telefone da propriedade">
                <input
                  className="pc-field-input"
                  value={form.propertyPhone}
                  onChange={(e) => update({ propertyPhone: e.target.value })}
                  placeholder="+55 11 90000-0000"
                  disabled={submitting}
                />
              </Field>
            </div>

            <div className="pc-field-row" style={{ gridTemplateColumns: "180px minmax(0, 1fr) minmax(0, 1fr)" }}>
              <Field label="Tipo de documento">
                <ConsoleSelect
                  value={form.legalDocumentType}
                  onChange={(v) => update({ legalDocumentType: v as LegalDocumentType })}
                  options={LEGAL_DOC_OPTIONS}
                  disabled={submitting}
                />
              </Field>
              <Field label="Número do documento">
                <input
                  className="pc-field-input"
                  value={form.legalDocumentNumber}
                  onChange={(e) => update({ legalDocumentNumber: e.target.value })}
                  placeholder="Número do documento"
                  disabled={submitting}
                />
              </Field>
              <Field label="E-mail de cobrança">
                <input
                  type="email"
                  className="pc-field-input"
                  value={form.billingEmail}
                  onChange={(e) => update({ billingEmail: e.target.value })}
                  placeholder="cobranca@email.com"
                  disabled={submitting}
                />
              </Field>
            </div>

            <div className="pc-field-row">
              <Field label="Razão social">
                <input
                  className="pc-field-input"
                  value={form.legalCompanyName}
                  onChange={(e) => update({ legalCompanyName: e.target.value })}
                  placeholder="Razão social ou nome legal"
                  disabled={submitting}
                />
              </Field>
              <Field label="Nome legal para cobrança">
                <input
                  className="pc-field-input"
                  value={form.billingLegalName}
                  onChange={(e) => update({ billingLegalName: e.target.value })}
                  placeholder="Nome legal do destinatário da cobrança"
                  disabled={submitting}
                />
              </Field>
            </div>

            <div className="pc-field-row" style={{ gridTemplateColumns: "200px 120px minmax(0, 1fr) 140px" }}>
              <Field label="CEP">
                <input
                  className="pc-field-input"
                  value={form.postalCode}
                  onChange={(e) => update({ postalCode: e.target.value })}
                  placeholder="00000-000"
                  disabled={submitting}
                />
                {cepMessage && (
                  <span
                    className="pc-field-hint"
                    style={{ color: cepStatus === "error" ? "var(--danger)" : cepStatus === "success" ? "var(--brand)" : undefined }}
                  >
                    {cepMessage}
                  </span>
                )}
              </Field>
              <Field label="​">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={lookupCep}
                  disabled={!isBrazil || submitting || cepStatus === "loading"}
                  style={{ height: 35 }}
                >
                  {cepStatus === "loading" ? (
                    <>
                      <Icon name="refresh-cw" size={12} /> Buscando…
                    </>
                  ) : (
                    <>
                      <Icon name="search" size={12} /> Buscar
                    </>
                  )}
                </button>
              </Field>
              <Field label="País">
                <ConsoleSelect
                  value={form.country}
                  onChange={(v) => update({ country: v })}
                  options={COUNTRY_OPTIONS}
                  disabled={submitting}
                />
              </Field>
              <Field label="UF / Estado">
                <input
                  className="pc-field-input"
                  value={form.state}
                  onChange={(e) => update({ state: e.target.value })}
                  placeholder="Ex.: SC"
                  maxLength={32}
                  disabled={submitting}
                />
              </Field>
            </div>

            <div className="pc-field-row">
              <Field label="Cidade *">
                <input
                  className="pc-field-input"
                  value={form.city}
                  onChange={(e) => update({ city: e.target.value })}
                  placeholder="Ex.: Florianópolis"
                  required
                  disabled={submitting}
                />
              </Field>
              <Field label="Bairro">
                <input
                  className="pc-field-input"
                  value={form.neighborhood}
                  onChange={(e) => update({ neighborhood: e.target.value })}
                  placeholder="Ex.: Centro"
                  disabled={submitting}
                />
              </Field>
            </div>

            <div className="pc-field-row" style={{ gridTemplateColumns: "minmax(0, 1fr) 120px minmax(0, 1fr)" }}>
              <Field label="Endereço">
                <input
                  className="pc-field-input"
                  value={form.street}
                  onChange={(e) => update({ street: e.target.value })}
                  placeholder="Ex.: Av. Beira Mar"
                  disabled={submitting}
                />
              </Field>
              <Field label="Número">
                <input
                  className="pc-field-input"
                  value={form.addressNumber}
                  onChange={(e) => update({ addressNumber: e.target.value })}
                  placeholder="Ex.: 1500"
                  disabled={submitting}
                />
              </Field>
              <Field label="Complemento">
                <input
                  className="pc-field-input"
                  value={form.addressComplement}
                  onChange={(e) => update({ addressComplement: e.target.value })}
                  placeholder="Ex.: torre B, sala 4"
                  disabled={submitting}
                />
              </Field>
            </div>

            {/* ============ 02 ============ */}
            <div style={{ height: 14 }} />
            <SectionTitle index="02" label="Plano, operação inicial e faturamento" />

            <div className="pc-field-row" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)" }}>
              <Field label="Plano">
                <ConsoleSelect value={form.planTier} onChange={(v) => setPlan(v as PlanTier)} options={PLAN_OPTIONS} disabled={submitting} />
              </Field>
              <Field label="Idioma">
                <ConsoleSelect
                  value={form.defaultLanguage}
                  onChange={(v) => update({ defaultLanguage: v as Language })}
                  options={LANGUAGE_OPTIONS}
                  disabled={submitting}
                />
              </Field>
              <Field label="Moeda">
                <ConsoleSelect value={form.currency} onChange={(v) => update({ currency: v })} options={CURRENCY_OPTIONS} disabled={submitting} />
              </Field>
              <Field label="Fuso horário">
                <ConsoleSelect value={form.timezone} onChange={(v) => update({ timezone: v })} options={TIMEZONE_OPTIONS} disabled={submitting} />
              </Field>
            </div>

            <div className="pc-field-row" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)" }}>
              <Field label="Total de unidades / quartos *">
                <input
                  type="number"
                  min={1}
                  className="pc-field-input"
                  value={form.unitCapacity}
                  onChange={(e) => update({ unitCapacity: Math.max(1, Number(e.target.value) || 1) })}
                  disabled={submitting}
                  required
                />
              </Field>
              <Field label="Camas em quartos compartilhados">
                <input
                  type="number"
                  min={0}
                  className="pc-field-input"
                  value={form.sharedBedCount}
                  onChange={(e) => update({ sharedBedCount: Math.max(0, Number(e.target.value) || 0) })}
                  disabled={submitting}
                />
              </Field>
              <Field label="Modo de cobrança">
                <ConsoleSelect
                  value={form.unitBillingMode}
                  onChange={(v) => update({ unitBillingMode: v as UnitBillingMode })}
                  options={UNIT_BILLING_OPTIONS}
                  disabled={submitting}
                />
              </Field>
              <Field label="Status inicial">
                <ConsoleSelect
                  value={form.status}
                  onChange={(v) => update({ status: v as PropertyStatus })}
                  options={STATUS_OPTIONS}
                  disabled={submitting}
                />
              </Field>
            </div>

            {/* ============ 03 ============ */}
            <div style={{ height: 14 }} />
            <SectionTitle index="03" label="Módulos essenciais obrigatórios do PMS" />

            <div className="pc-module-grid">
              {CORE_REQUIRED_MODULES.map((id) => {
                const meta = CORE_MODULE_LABELS[id];
                return (
                  <div key={id} className="pc-module-card locked" aria-disabled>
                    <div className="pc-module-row">
                      <span className="pc-module-icon">
                        <Icon name={meta.icon} size={14} />
                      </span>
                      <span className="pc-module-name">{meta.label}</span>
                    </div>
                    <span className="pc-module-flag locked">
                      <Icon name="lock" size={10} /> Bloqueado
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pc-section-row">Módulos opcionais</div>

            <div className="pc-module-grid">
              {OPTIONAL_MODULES.map((mod) => {
                const isSelected = form.selectedModules.includes(mod.id);
                const isComing = !!mod.comingSoon;
                // Platform Console (superadmin) NEVER blocks an implemented
                // module by plan. Bundle membership is used only to surface
                // a quiet "Recomendado X" hint on UNSELECTED cards.
                const isInPlanBundle = isModuleInPlanBundle(form.planTier, mod.id);
                const recommendedPlan = !isInPlanBundle ? smallestPlanIncluding(mod.id) : null;
                const isDisabled = isComing;

                // Selected cards stay clean: state + check, nothing else.
                // Coming-soon stays loud (operator must see it).
                // Otherwise, a single quiet hint when relevant.
                let badge: { className: string; label: string } | null = null;
                if (isComing) {
                  badge = { className: "coming", label: "Em breve" };
                } else if (!isSelected && recommendedPlan && recommendedPlan !== form.planTier) {
                  badge = { className: "recommended", label: `Recomendado ${recommendedPlan}` };
                }

                return (
                  <div
                    key={mod.id}
                    className={`pc-module-card ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""}`}
                    onClick={() => !isDisabled && toggleModule(mod.id)}
                    role="button"
                    tabIndex={isDisabled ? -1 : 0}
                    aria-pressed={isSelected}
                    title={mod.label}
                    onKeyDown={(e) => {
                      if (!isDisabled && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        toggleModule(mod.id);
                      }
                    }}
                  >
                    <div className="pc-module-row">
                      <span className="pc-module-icon">
                        <Icon name={mod.icon} size={14} />
                      </span>
                      <span className="pc-module-name">{mod.label}</span>
                    </div>
                    {isSelected && !isComing ? (
                      <span className="pc-module-check" aria-label="Selecionado">
                        <Icon name="check" size={12} />
                      </span>
                    ) : badge ? (
                      <span className={`pc-module-flag ${badge.className}`}>{badge.label}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* ============ 04 ============ */}
            <div style={{ height: 14 }} />
            <SectionTitle index="04" label="Canais e estimativa" />

            <div className="pc-channel-grid">
              {CHANNEL_ADD_ONS.map((ch) => {
                const isSelected = form.selectedChannels.includes(ch.id);
                return (
                  <div
                    key={ch.id}
                    className={`pc-channel-chip ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleChannel(ch.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleChannel(ch.id);
                      }
                    }}
                  >
                    <span>{ch.label}</span>
                    <span className="check">{isSelected ? <Icon name="check" size={10} /> : null}</span>
                  </div>
                );
              })}
            </div>

            {/* ============ 05 ============ */}
            <div style={{ height: 14 }} />
            <SectionTitle index="05" label="Observações internas" />
            <Field label="Notas internas (não visíveis ao cliente)">
              <textarea
                className="pc-field-textarea"
                value={form.internalNotes}
                onChange={(e) => update({ internalNotes: e.target.value })}
                placeholder="Ex.: cliente migrou de outro PMS, atendido por Maryna, dia da reunião…"
                disabled={submitting}
              />
            </Field>

            {error && <div className="pc-field-error" style={{ marginTop: 8 }}>{error}</div>}

            <div className="notice info" style={{ marginTop: 12 }}>
              <Icon name="lock" size={12} />
              <span>
                Endpoint <span className="mono">POST /api/properties</span> · superadmin only · audit log
                <span className="mono"> property_created</span> · Channel Manager provisiona em <strong>mock mode</strong>.
                Módulos, canais e estimativa vão no <span className="mono">metadata</span> até o schema do SaaS absorver.
              </span>
            </div>
          </div>

          {/* ---- Estimate aside (Linear-style summary lockup) ---- */}
          <aside className="pc-estimate-aside">
            <div className="pc-estimate-panel">
              <header className="pc-estimate-head">
                <div className="pc-estimate-title">Estimativa mensal</div>
                <div className="pc-estimate-sub">Prévia comercial · sem cobrança automática</div>
              </header>

              <div className="pc-estimate-body">
                <EstimateRow k="Plano selecionado" v={billing.planTier} />
                <EstimateRow k="Plano PMS" v={fmtBRL(billing.planMonthly, billing.currency)} />
                <EstimateRow k="Unidades faturáveis" v={String(billing.billableUnitCount)} />
                <EstimateRow
                  k="Unidades incluídas"
                  v={billing.baseIncludedUnits === null ? "ilimitado" : String(billing.baseIncludedUnits)}
                />
                <EstimateRow k="Unidades extras" v={String(billing.extraUnits)} />
                <EstimateRow
                  k="Adicional por unidade"
                  v={billing.extraUnitPriceMonthly ? fmtBRL(billing.extraUnitPriceMonthly, billing.currency) : "—"}
                />
                <EstimateRow k="Canais selecionados" v={String(billing.channelCount)} />
                <EstimateRow k="Preço por canal" v={fmtBRL(billing.channelUnitPriceMonthly, billing.currency)} />
                <EstimateRow k="Total add-ons canais" v={fmtBRL(billing.channelMonthly, billing.currency)} />
                <EstimateRow k="Taxa de implantação" v={fmtBRL(billing.setupFee, billing.currency)} />
              </div>

              <div className="pc-estimate-totals">
                <div className="pc-estimate-total-row primary">
                  <span className="k">Total mensal estimado</span>
                  <span className="v">{fmtBRL(billing.totalMonthly, billing.currency)}</span>
                </div>
                <div className="pc-estimate-total-row">
                  <span className="k">Primeira fatura</span>
                  <span className="v">{fmtBRL(billing.firstInvoiceTotal, billing.currency)}</span>
                </div>
              </div>

              <footer className="pc-estimate-foot">
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.10em", color: "#5C6675" }}>
                      Ciclo de cobrança
                    </span>
                    <span style={{ color: "#C7CFD9", fontSize: 11.5, fontFamily: "'Geist Mono', ui-monospace, monospace" }}>
                      Mensal
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.10em", color: "#5C6675" }}>
                      Status inicial
                    </span>
                    <span className={`pc-estimate-status-badge ${billing.status === "active" ? "active" : ""}`}>
                      {billing.status === "trial" ? "Trial" : "Ativa"}
                    </span>
                  </div>
                </div>
              </footer>
            </div>

            <div className="notice warn" style={{ marginTop: 10, padding: "10px 12px", fontSize: 11, lineHeight: 1.5 }}>
              <Icon name="alert-triangle" size={12} />
              <span>
                Valores baseados no registry do SaaS (Plan / Channel / Unit). Cobrança só é efetivada após confirmação humana — nenhuma fatura é disparada neste passo.
              </span>
            </div>
          </aside>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="pc-field">
      <span className="pc-field-label">{label}</span>
      {children}
      {hint && <span className="pc-field-hint">{hint}</span>}
    </div>
  );
}

function SectionTitle({ index, label, sub }: { index: string; label: string; sub?: string }) {
  return (
    <header className="pc-section-head">
      <span className="pc-section-num" aria-hidden>
        {index}
      </span>
      <div className="pc-section-titles">
        <span className="pc-section-title">{label}</span>
        {sub ? <span className="pc-section-sub">{sub}</span> : null}
      </div>
    </header>
  );
}

function EstimateRow({ k, v, total }: { k: string; v: React.ReactNode; total?: boolean }) {
  return (
    <div className={`pc-estimate-row ${total ? "total" : ""}`}>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

const messageFor = (code: string) => {
  if (code.includes("PROPERTY_NAME_REQUIRED")) return "O backend exige um nome.";
  if (code.includes("FORBIDDEN") || code.includes("SUPERADMIN_REQUIRED") || code.includes("HTTP_403"))
    return "Sua sessão perdeu permissão. Faça login de novo.";
  if (code.includes("HTTP_401")) return "Sessão expirada — faça login de novo.";
  if (code.includes("NETWORK")) return "Não consegui falar com o SaaS (verifique se /api/properties está rodando).";
  return `Falha (${code}).`;
};
