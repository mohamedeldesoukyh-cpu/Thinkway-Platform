const OPERATIONAL_AMOUNT_LOCALE = "en-US";

/** Numeric display for assignment operational grid — no currency symbols (CCY column holds code). */
export function formatOperationalAmount(amount: number): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "0.00";
  return value.toLocaleString(OPERATIONAL_AMOUNT_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Per-unit amounts (REV/AD, COST/AD) — omit trailing .00 when whole. */
export function formatOperationalUnitAmount(amount: number): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(OPERATIONAL_AMOUNT_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function roundOperationalAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Parse user-typed amount (allows commas). Returns null when empty/invalid. */
export function parseOperationalAmountInput(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? roundOperationalAmount(n) : null;
}

export function syncCommercialFromRevPerAd(qty: number, revPerAd: number) {
  const q = Math.max(1, Math.floor(qty) || 1);
  const per = roundOperationalAmount(revPerAd);
  return {
    qty: q,
    revPerAd: per,
    rev: roundOperationalAmount(q * per),
  };
}

export function syncCommercialFromRev(qty: number, rev: number) {
  const q = Math.max(1, Math.floor(qty) || 1);
  const total = roundOperationalAmount(rev);
  return {
    qty: q,
    rev: total,
    revPerAd: roundOperationalAmount(total / q),
  };
}

export function syncCommercialFromCostPerAd(qty: number, costPerAd: number) {
  const q = Math.max(1, Math.floor(qty) || 1);
  const per = roundOperationalAmount(costPerAd);
  return {
    qty: q,
    costPerAd: per,
    cost: roundOperationalAmount(q * per),
  };
}

export function syncCommercialFromCost(qty: number, cost: number) {
  const q = Math.max(1, Math.floor(qty) || 1);
  const total = roundOperationalAmount(cost);
  return {
    qty: q,
    cost: total,
    costPerAd: roundOperationalAmount(total / q),
  };
}
