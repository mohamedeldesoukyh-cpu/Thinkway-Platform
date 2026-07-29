/**
 * Commercial Field Registry — Master / Derived / Operational classification.
 * Spec: docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md §3
 *
 * Sync projects logical Master keys ↔ persistence columns.
 * Never join Quotation ↔ Campaign by row position or copied values.
 */

import type {
  CommercialDerivedFieldKey,
  CommercialFieldLevel,
  CommercialMasterFieldKey,
  CommercialOperationalFieldKey,
  MasterCommercialValues,
  MasterFieldChange,
} from "./types";

export type { MasterFieldChange } from "./types";

export type FieldPersistenceMap = {
  key: CommercialMasterFieldKey;
  level: "master";
  /** quotation_items column */
  quotationColumn: string;
  /** campaign_lines column */
  campaignColumn: string;
  description: string;
};

const MASTER_FIELDS: FieldPersistenceMap[] = [
  {
    key: "creator_cost",
    level: "master",
    quotationColumn: "cost",
    campaignColumn: "cost_before_vat",
    description: "Negotiated creator / vendor cost (pre-VAT)",
  },
  {
    key: "client_revenue",
    level: "master",
    quotationColumn: "revenue",
    campaignColumn: "revenue_before_vat",
    description: "Negotiated client revenue / selling price (pre-VAT)",
  },
  {
    key: "cost_currency",
    level: "master",
    quotationColumn: "cost_currency",
    campaignColumn: "currency_code",
    description: "Commercial currency",
  },
  {
    key: "exchange_rate",
    level: "master",
    quotationColumn: "fx_rate_to_egp",
    campaignColumn: "fx_rate",
    description: "Exchange rate used for commercial normalization",
  },
  {
    key: "agency_fee_percent",
    level: "master",
    quotationColumn: "af_pct",
    campaignColumn: "agency_fee_percent",
    description: "Agency fee percent (pricing input)",
  },
  {
    key: "commercial_input_mode",
    level: "master",
    quotationColumn: "commercial_input_mode",
    campaignColumn: "pricing_mode",
    description: "Commercial engine input mode",
  },
  {
    key: "gp_pct_input",
    level: "master",
    quotationColumn: "gp_pct",
    campaignColumn: "markup_margin",
    description: "GP% when used as a pricing input mode",
  },
  {
    key: "gp_value_input",
    level: "master",
    quotationColumn: "gp_value",
    campaignColumn: "profit",
    description: "GP value when used as a pricing input (quote-canonical)",
  },
  {
    key: "usage_rights_amount",
    level: "master",
    quotationColumn: "usage_rights_amount",
    campaignColumn: "usage_rights_amount",
    description: "Usage rights revenue amount",
  },
  {
    key: "usage_rights_cost",
    level: "master",
    quotationColumn: "usage_rights_cost",
    campaignColumn: "usage_rights_cost",
    description: "Usage rights cost amount",
  },
  {
    key: "revenue_vat_percent",
    level: "master",
    quotationColumn: "revenue_vat_percent",
    campaignColumn: "revenue_vat_percent",
    description: "Client VAT percent (commercial tax input)",
  },
  {
    key: "cost_vat_percent",
    level: "master",
    quotationColumn: "cost_vat_percent",
    campaignColumn: "cost_vat_percent",
    description: "Vendor VAT percent (commercial tax input)",
  },
  {
    key: "revenue_vat_exempt",
    level: "master",
    quotationColumn: "revenue_vat_exempt",
    campaignColumn: "revenue_vat_exempt",
    description: "Client VAT exempt flag",
  },
  {
    key: "cost_vat_exempt",
    level: "master",
    quotationColumn: "cost_vat_exempt",
    campaignColumn: "cost_vat_exempt",
    description: "Vendor VAT exempt flag",
  },
];

const DERIVED_FIELDS: { key: CommercialDerivedFieldKey; description: string }[] = [
  { key: "total_cost", description: "Rolled-up total cost" },
  { key: "total_revenue", description: "Rolled-up total revenue" },
  { key: "gross_profit", description: "Gross profit (revenue − cost)" },
  { key: "gross_margin_pct", description: "Gross margin %" },
  { key: "agency_fee_amount", description: "Computed agency fee amount" },
  { key: "cost_egp", description: "Cost normalized to EGP" },
  { key: "revenue_egp", description: "Revenue normalized to EGP" },
  { key: "gp_value_egp", description: "GP value in EGP" },
  { key: "af_value_egp", description: "AF value in EGP" },
  { key: "profit", description: "Campaign line profit (when derived)" },
  { key: "profit_margin", description: "Campaign line profit margin %" },
  { key: "quotation_totals", description: "Quotation header commercial totals" },
  { key: "campaign_financial_summary", description: "Campaign financial KPI rollups" },
];

const OPERATIONAL_FIELDS: {
  key: CommercialOperationalFieldKey;
  description: string;
}[] = [
  { key: "campaign_status", description: "Campaign header status" },
  { key: "assignment_status", description: "Assignment / line status" },
  { key: "creator_status", description: "Creator workflow status" },
  { key: "publishing_calendar", description: "Publishing calendar weeks/slots" },
  { key: "publishing_dates", description: "Publish / live dates" },
  { key: "approval_status", description: "Content / commercial approval status" },
  { key: "creator_acceptance", description: "Creator acceptance state" },
  { key: "deliverable_status", description: "Deliverable completion status" },
  { key: "asset_urls", description: "Asset / content URLs" },
  { key: "tracking_links", description: "Tracking links" },
  { key: "performance_metrics", description: "Reach, impressions, engagement, etc." },
  { key: "ai_scores", description: "AI scores / recommendations" },
  { key: "operational_notes", description: "Ops notes" },
  { key: "internal_comments", description: "Internal comments" },
];

const MASTER_BY_KEY = new Map(MASTER_FIELDS.map((f) => [f.key, f]));

/** Absolute amount masters — when 1:N, equal-split across Assignments. */
export const ABSOLUTE_MASTER_KEYS: ReadonlySet<CommercialMasterFieldKey> = new Set([
  "creator_cost",
  "client_revenue",
  "gp_value_input",
  "usage_rights_amount",
  "usage_rights_cost",
]);

/** Rate / flag masters — copied to every Assignment with the same Origin. */
export const RATE_MASTER_KEYS: ReadonlySet<CommercialMasterFieldKey> = new Set([
  "cost_currency",
  "exchange_rate",
  "agency_fee_percent",
  "commercial_input_mode",
  "gp_pct_input",
  "revenue_vat_percent",
  "cost_vat_percent",
  "revenue_vat_exempt",
  "cost_vat_exempt",
]);

export function listMasterFields(): readonly FieldPersistenceMap[] {
  return MASTER_FIELDS;
}

export function listDerivedFields(): readonly {
  key: CommercialDerivedFieldKey;
  description: string;
}[] {
  return DERIVED_FIELDS;
}

export function listOperationalFields(): readonly {
  key: CommercialOperationalFieldKey;
  description: string;
}[] {
  return OPERATIONAL_FIELDS;
}

export function isMasterFieldKey(key: string): key is CommercialMasterFieldKey {
  return MASTER_BY_KEY.has(key as CommercialMasterFieldKey);
}

export function isDerivedFieldKey(key: string): key is CommercialDerivedFieldKey {
  return DERIVED_FIELDS.some((f) => f.key === key);
}

export function isOperationalFieldKey(
  key: string
): key is CommercialOperationalFieldKey {
  return OPERATIONAL_FIELDS.some((f) => f.key === key);
}

export function getFieldLevel(key: string): CommercialFieldLevel | null {
  if (isMasterFieldKey(key)) return "master";
  if (isDerivedFieldKey(key)) return "derived";
  if (isOperationalFieldKey(key)) return "operational";
  return null;
}

export function getMasterFieldMap(
  key: CommercialMasterFieldKey
): FieldPersistenceMap | null {
  return MASTER_BY_KEY.get(key) ?? null;
}

/** True when every key in `changes` is a registered Master field. */
export function assertOnlyMasterChanges(changes: MasterCommercialValues): {
  ok: true;
} | { ok: false; rejectedFields: string[] } {
  const rejected: string[] = [];
  for (const key of Object.keys(changes)) {
    if (!isMasterFieldKey(key)) rejected.push(key);
  }
  if (rejected.length > 0) return { ok: false, rejectedFields: rejected };
  return { ok: true };
}

/** Project logical Master values → quotation_items patch. */
export function toQuotationColumns(
  values: MasterCommercialValues
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!isMasterFieldKey(key)) continue;
    const map = MASTER_BY_KEY.get(key);
    if (!map || value === undefined) continue;
    patch[map.quotationColumn] = value;
    // Keep campaign_lines.revenue/cost mirrors aligned when writing quote→campaign
    // is handled separately; on quote, also keep legacy cost/revenue columns.
  }
  // Dual-write campaign-facing mirrors on quote side are N/A.
  // When creator_cost/client_revenue set, quotation uses cost/revenue only.
  return patch;
}

/** Project logical Master values → campaign_lines patch. */
export function toCampaignColumns(
  values: MasterCommercialValues
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!isMasterFieldKey(key)) continue;
    const map = MASTER_BY_KEY.get(key);
    if (!map || value === undefined) continue;
    patch[map.campaignColumn] = value;
    // Convert seeds both revenue and revenue_before_vat — keep mirrors in sync.
    if (key === "client_revenue") {
      patch.revenue = value;
      patch.revenue_before_vat = value;
      patch.po_amount = value;
    }
    if (key === "creator_cost") {
      patch.cost = value;
      patch.cost_before_vat = value;
    }
  }
  return patch;
}

/** Read logical Master values from a quotation_items-like row. */
export function fromQuotationRow(
  row: Record<string, unknown>
): MasterCommercialValues {
  const out: MasterCommercialValues = {};
  for (const field of MASTER_FIELDS) {
    if (field.quotationColumn in row) {
      out[field.key] = row[field.quotationColumn] as
        | string
        | number
        | boolean
        | null;
    }
  }
  return out;
}

/** Read logical Master values from a campaign_lines-like row. */
export function fromCampaignRow(
  row: Record<string, unknown>
): MasterCommercialValues {
  const out: MasterCommercialValues = {};
  for (const field of MASTER_FIELDS) {
    const col = field.campaignColumn;
    if (col in row) {
      out[field.key] = row[col] as string | number | boolean | null;
    }
  }
  // Prefer before-VAT when both present
  if ("revenue_before_vat" in row) {
    out.client_revenue = row.revenue_before_vat as number | null;
  } else if ("revenue" in row) {
    out.client_revenue = row.revenue as number | null;
  }
  if ("cost_before_vat" in row) {
    out.creator_cost = row.cost_before_vat as number | null;
  } else if ("cost" in row) {
    out.creator_cost = row.cost as number | null;
  }
  return out;
}

/**
 * For 1:N Assignments sharing one Commercial Line, split absolute Master amounts.
 * Rates/flags are copied unchanged.
 */
export function allocateMasterAcrossAssignments(
  agreement: MasterCommercialValues,
  assignmentCount: number
): MasterCommercialValues[] {
  const n = Math.max(1, assignmentCount);
  if (n === 1) return [{ ...agreement }];

  const shares: MasterCommercialValues[] = Array.from({ length: n }, () => ({}));
  for (const [key, value] of Object.entries(agreement) as [
    CommercialMasterFieldKey,
    string | number | boolean | null | undefined,
  ][]) {
    if (value === undefined) continue;
    if (RATE_MASTER_KEYS.has(key) || !ABSOLUTE_MASTER_KEYS.has(key)) {
      for (const share of shares) share[key] = value;
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      for (const share of shares) share[key] = value;
      continue;
    }
    const base = Math.floor((value / n) * 100) / 100;
    let allocated = 0;
    for (let i = 0; i < n; i++) {
      const amount = i === n - 1 ? round2(value - allocated) : base;
      shares[i][key] = amount;
      allocated = round2(allocated + amount);
    }
  }
  return shares;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const MASTER_LABELS: Record<CommercialMasterFieldKey, string> = {
  creator_cost: "Creator Cost",
  client_revenue: "Client Revenue",
  cost_currency: "Currency",
  exchange_rate: "Exchange Rate",
  agency_fee_percent: "Agency Fee / Commission",
  commercial_input_mode: "Pricing Mode",
  gp_pct_input: "GP %",
  gp_value_input: "GP Value",
  usage_rights_amount: "Usage Rights Amount",
  usage_rights_cost: "Usage Rights Cost",
  revenue_vat_percent: "Revenue VAT %",
  cost_vat_percent: "Cost VAT %",
  revenue_vat_exempt: "Revenue VAT Exempt",
  cost_vat_exempt: "Cost VAT Exempt",
};

/** Master → Derived dependency graph (registry-driven recalculation). */
const MASTER_DERIVED_DEPS: Record<
  CommercialMasterFieldKey,
  readonly CommercialDerivedFieldKey[]
> = {
  creator_cost: [
    "total_cost",
    "gross_profit",
    "gross_margin_pct",
    "cost_egp",
    "gp_value_egp",
    "profit",
    "profit_margin",
    "quotation_totals",
    "campaign_financial_summary",
  ],
  client_revenue: [
    "total_revenue",
    "gross_profit",
    "gross_margin_pct",
    "agency_fee_amount",
    "revenue_egp",
    "gp_value_egp",
    "af_value_egp",
    "profit",
    "profit_margin",
    "quotation_totals",
    "campaign_financial_summary",
  ],
  cost_currency: [
    "cost_egp",
    "revenue_egp",
    "gp_value_egp",
    "af_value_egp",
    "quotation_totals",
    "campaign_financial_summary",
  ],
  exchange_rate: [
    "cost_egp",
    "revenue_egp",
    "gp_value_egp",
    "af_value_egp",
    "quotation_totals",
    "campaign_financial_summary",
  ],
  agency_fee_percent: [
    "agency_fee_amount",
    "af_value_egp",
    "quotation_totals",
    "campaign_financial_summary",
  ],
  commercial_input_mode: [
    "gross_profit",
    "gross_margin_pct",
    "quotation_totals",
    "campaign_financial_summary",
  ],
  gp_pct_input: [
    "gross_profit",
    "gross_margin_pct",
    "gp_value_egp",
    "quotation_totals",
    "campaign_financial_summary",
  ],
  gp_value_input: [
    "gross_profit",
    "gross_margin_pct",
    "gp_value_egp",
    "quotation_totals",
    "campaign_financial_summary",
  ],
  usage_rights_amount: [
    "total_revenue",
    "gross_profit",
    "quotation_totals",
    "campaign_financial_summary",
  ],
  usage_rights_cost: [
    "total_cost",
    "gross_profit",
    "quotation_totals",
    "campaign_financial_summary",
  ],
  revenue_vat_percent: ["campaign_financial_summary"],
  cost_vat_percent: ["campaign_financial_summary"],
  revenue_vat_exempt: ["campaign_financial_summary"],
  cost_vat_exempt: ["campaign_financial_summary"],
};

export function masterFieldLabel(key: CommercialMasterFieldKey): string {
  return MASTER_LABELS[key] ?? key;
}

export function valuesEqual(
  a: string | number | boolean | null | undefined,
  b: string | number | boolean | null | undefined
): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (typeof a === "number" && typeof b === "number") {
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9;
  }
  return String(a) === String(b);
}

/**
 * Dirty-state detection: only keys whose proposed value differs from current.
 * Identical values are omitted so sync/audit stay field-precise.
 */
export function diffMasterChanges(
  current: MasterCommercialValues,
  proposed: MasterCommercialValues
): {
  dirty: MasterCommercialValues;
  fieldChanges: MasterFieldChange[];
} {
  const dirty: MasterCommercialValues = {};
  const fieldChanges: MasterFieldChange[] = [];

  for (const [key, newValue] of Object.entries(proposed) as [
    CommercialMasterFieldKey,
    string | number | boolean | null | undefined,
  ][]) {
    if (newValue === undefined) continue;
    if (!isMasterFieldKey(key)) continue;
    const oldValue = current[key];
    if (valuesEqual(oldValue, newValue)) continue;
    dirty[key] = newValue;
    fieldChanges.push({
      field: key,
      label: masterFieldLabel(key),
      oldValue,
      newValue,
    });
  }

  return { dirty, fieldChanges };
}

export type DerivedRecalcPlan = {
  derivedKeys: CommercialDerivedFieldKey[];
  requiresQuotationTotals: boolean;
  requiresCampaignSummary: boolean;
};

/** Resolve which Derived fields must recalculate given dirty Master keys. */
export function resolveDerivedRecalcPlan(
  dirtyKeys: readonly CommercialMasterFieldKey[]
): DerivedRecalcPlan {
  const derived = new Set<CommercialDerivedFieldKey>();
  for (const key of dirtyKeys) {
    for (const d of MASTER_DERIVED_DEPS[key] ?? []) derived.add(d);
  }
  const derivedKeys = [...derived];
  return {
    derivedKeys,
    requiresQuotationTotals: derived.has("quotation_totals"),
    requiresCampaignSummary: derived.has("campaign_financial_summary"),
  };
}
