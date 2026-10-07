/**
 * Pricing rules for rate cards.
 *
 * These mirror existing business rules. They are deliberately total functions
 * that return `null` rather than throwing or coercing, because the UI has to
 * distinguish three different things that all look like "no number":
 *
 *   missing   — never entered            -> null        -> renders "Not set"
 *   zero      — deliberately priced at 0 -> 0           -> renders "0"
 *   incomparable — cannot be computed    -> null from gp/markup -> renders "—"
 *
 * Collapsing any of those into another is the single easiest way to make this
 * screen lie, so nothing here ever substitutes 0 for null.
 */

export type Currency = 'EGP' | 'USD' | 'AED' | 'SAR' | 'EUR' | 'GBP';

/** A price that may legitimately be absent. `null` is NOT the same as 0. */
export type Money = { amount: number | null; currency: Currency | null };

export const isMissing = (m: Money | null | undefined): boolean =>
  !m || m.amount === null || m.amount === undefined;

/** Zero is a real price. This is true only for a deliberate 0. */
export const isZero = (m: Money | null | undefined): boolean =>
  !!m && m.amount === 0;

/** A price is only usable if it has an amount AND an active currency. */
export const isPriced = (m: Money | null | undefined): boolean =>
  !!m && m.amount !== null && m.amount !== undefined && !!m.currency;

/**
 * GP % = (client price - creator cost) / client price * 100
 *
 * Returns null when:
 *  - either side is missing
 *  - the currencies differ (the subtraction would be meaningless)
 *  - the client price is 0 (division by zero)
 *
 * Never converts between currencies. There is no FX rate in this screen and
 * inventing one would silently fabricate margin.
 */
export function grossProfitPct(cost: Money, price: Money): number | null {
  if (!isPriced(cost) || !isPriced(price)) return null;
  if (cost.currency !== price.currency) return null;
  if (price.amount === 0) return null;
  return ((price.amount! - cost.amount!) / price.amount!) * 100;
}

/**
 * Markup % = (client price - creator cost) / creator cost * 100
 * Same guards; the denominator here is the cost.
 */
export function markupPct(cost: Money, price: Money): number | null {
  if (!isPriced(cost) || !isPriced(price)) return null;
  if (cost.currency !== price.currency) return null;
  if (cost.amount === 0) return null;
  return ((price.amount! - cost.amount!) / cost.amount!) * 100;
}

/** Why a percentage could not be shown — surfaced as a tooltip, never guessed. */
export function incomparableReason(cost: Money, price: Money): string | null {
  if (isMissing(cost) || isMissing(price)) return 'A price is missing';
  if (cost.currency !== price.currency) return 'Currencies differ';
  if (price.amount === 0) return 'Client price is zero';
  if (cost.amount === 0) return 'Creator cost is zero';
  return null;
}

/* ------------------------------------------------------------------ *
 * Periodic services. Monthly or daily rate x quantity.
 * Creator and client sides can carry DIFFERENT quantities; the UI must
 * show both when they differ rather than picking one.
 * ------------------------------------------------------------------ */

export type PeriodicPrice = {
  creator: Money;
  client: Money;
  creatorQty: number | null;
  clientQty: number | null;
  /** Agency fee for THIS service. May differ from the content fee. */
  agencyFeePct: number | null;
};

export const MONTHS_MIN = 1, MONTHS_MAX = 120;
export const DAYS_MIN = 1,  DAYS_MAX  = 365;

/** Event days default to 1 when blank — months never do. */
export const effectiveEventDays = (d: number | null | undefined): number =>
  d === null || d === undefined ? 1 : d;

export function periodicTotal(side: Money, qty: number | null): Money {
  if (!isPriced(side) || qty === null || qty === undefined) {
    return { amount: null, currency: side?.currency ?? null };
  }
  return { amount: side.amount! * qty, currency: side.currency! };
}

export const quantitiesDiffer = (p: PeriodicPrice): boolean =>
  p.creatorQty !== null && p.clientQty !== null && p.creatorQty !== p.clientQty;

/* ------------------------------------------------------------------ *
 * Agency fees
 * ------------------------------------------------------------------ */

export const isValidAgencyFee = (v: number | null): boolean =>
  v === null || (Number.isFinite(v) && v >= 0 && v <= 100);

/**
 * Content, usage rights, boosting and event attendance can each carry a
 * different agency fee. Returning a single blended number would misrepresent
 * the commercials, so this reports the distinct values instead.
 */
export function agencyFeeSummary(fees: (number | null)[]): {
  uniform: boolean; value: number | null; values: number[];
} {
  const present = fees.filter((f): f is number => f !== null && f !== undefined);
  const distinct = Array.from(new Set(present));
  if (distinct.length === 0) return { uniform: true, value: null, values: [] };
  if (distinct.length === 1) return { uniform: true, value: distinct[0], values: distinct };
  return { uniform: false, value: null, values: distinct.sort((a, b) => a - b) };
}

/* ------------------------------------------------------------------ *
 * Travel uplifts — optional, additive, and allowed to exceed 100%.
 * They sit OUTSIDE the base price and are never folded into it.
 * ------------------------------------------------------------------ */

export type TravelUplifts = { tuA: number | null; tuB: number | null; itu: number | null };

/** A blank field preserves the existing value; it does not clear it. */
export function mergeUplifts(existing: TravelUplifts, incoming: Partial<TravelUplifts>): TravelUplifts {
  const keep = (next: number | null | undefined, prev: number | null) =>
    next === null || next === undefined || Number.isNaN(next) ? prev : next;
  return {
    tuA: keep(incoming.tuA, existing.tuA),
    tuB: keep(incoming.tuB, existing.tuB),
    itu: keep(incoming.itu, existing.itu),
  };
}

export const isValidUplift = (v: number | null): boolean =>
  v === null || (Number.isFinite(v) && v >= 0);   // may exceed 100

/* ------------------------------------------------------------------ *
 * Bulk pricing
 * ------------------------------------------------------------------ */

export type BulkRule =
  | { kind: 'targetGp'; pct: number; agencyFeePct?: number | null }
  | { kind: 'markup';   pct: number; agencyFeePct?: number | null }
  | { kind: 'feeOnly';  agencyFeePct: number };

export type BulkScope = 'fillMissing' | 'overwrite';

/** price = cost / (1 - gp/100). Undefined at gp >= 100. */
export function priceFromTargetGp(cost: Money, gpPct: number): Money {
  if (!isPriced(cost) || gpPct >= 100) return { amount: null, currency: cost?.currency ?? null };
  return { amount: cost.amount! / (1 - gpPct / 100), currency: cost.currency! };
}

/** price = cost * (1 + markup/100) */
export function priceFromMarkup(cost: Money, markupPct: number): Money {
  if (!isPriced(cost)) return { amount: null, currency: cost?.currency ?? null };
  return { amount: cost.amount! * (1 + markupPct / 100), currency: cost.currency! };
}

export type BulkChange = {
  lineId: string; label: string; before: Money; after: Money; skipped?: string;
};

export function previewBulk(
  lines: { id: string; label: string; cost: Money; price: Money }[],
  rule: BulkRule,
  scope: BulkScope,
): BulkChange[] {
  const out: BulkChange[] = [];
  for (const l of lines) {
    if (rule.kind === 'feeOnly') continue;              // fee-only touches no price
    if (scope === 'fillMissing' && !isMissing(l.price)) continue;
    if (!isPriced(l.cost)) {
      out.push({ lineId: l.id, label: l.label, before: l.price, after: l.price,
                 skipped: 'No creator cost to calculate from' });
      continue;
    }
    const after = rule.kind === 'targetGp'
      ? priceFromTargetGp(l.cost, rule.pct)
      : priceFromMarkup(l.cost, rule.pct);
    if (isMissing(after)) {
      out.push({ lineId: l.id, label: l.label, before: l.price, after: l.price,
                 skipped: 'Target GP of 100% or more has no solution' });
      continue;
    }
    out.push({ lineId: l.id, label: l.label, before: l.price, after });
  }
  return out;
}

/** Any change to the rule or scope invalidates a generated preview. */
export const previewKey = (rule: BulkRule, scope: BulkScope): string =>
  JSON.stringify({ rule, scope });

/* ------------------------------------------------------------------ *
 * Import rounding (upload workflow)
 * ------------------------------------------------------------------ */

export const ACCEPTED_DECIMALS = 4;

/** Amounts and fee percentages round to 4dp and raise a NON-blocking warning. */
export function roundImported(v: number): { value: number; rounded: boolean } {
  const f = Math.pow(10, ACCEPTED_DECIMALS);
  const r = Math.round(v * f) / f;
  return { value: r, rounded: r !== v };
}

/** Quantities must be whole. These are rejected, never silently rounded. */
export function validateQuantity(v: number, min: number, max: number): string | null {
  if (!Number.isInteger(v)) return `Must be a whole number between ${min} and ${max}`;
  if (v < min || v > max) return `Must be between ${min} and ${max}`;
  return null;
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

/**
 * Numerals stay Latin in both languages: these are financial values read
 * against an Excel workbook, and Arabic-Indic digits would not match it.
 */
export function formatMoney(m: Money, locale: 'en' | 'ar' = 'en'): string | null {
  if (isMissing(m)) return null;
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(m.amount!);
}

export function formatPct(v: number | null, dp = 2): string {
  return v === null || v === undefined ? '—' : `${v.toFixed(dp)}%`;
}
