/**
 * Pack Overlay C pricing calculator — 04-quotation-detail.md / discovery.html qNew · qRows.
 */

export type QuotationCalcMode = "af" | "gpm" | "price" | "gpv";

export const QUOTATION_CALC_MODES: Record<
  QuotationCalcMode,
  { label: string; formula: string; defaultValue: number }
> = {
  af: {
    label: "Cost + AF %",
    formula: "client = cost × (1 + af%)",
    defaultValue: 25,
  },
  gpm: {
    label: "Cost + GP margin %",
    formula: "client = cost ÷ (1 − margin%)",
    defaultValue: 30,
  },
  price: {
    label: "Cost + client price",
    formula: "client = price you enter",
    defaultValue: 300_000,
  },
  gpv: {
    label: "Cost + GP value",
    formula: "client = cost + GP",
    defaultValue: 100_000,
  },
};

/** Pack `qNew(cost)` — gpm ≥ 100 holds at cost (never Infinity). */
export function quotationCalcNewClient(
  cost: number,
  mode: QuotationCalcMode,
  value: number
): number {
  const c = Number.isFinite(cost) ? cost : 0;
  const v = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (mode === "af") return c * (1 + v / 100);
  if (mode === "gpm") return v >= 100 ? c : c / (1 - v / 100);
  if (mode === "price") return v;
  return c + v;
}

export type QuotationCalcLineInput = {
  id: string;
  name: string;
  handle: string | null;
  optionNumber: number;
  baseCost: number;
  clientNow: number;
};

export type QuotationCalcLinePreview = QuotationCalcLineInput & {
  newClient: number;
  gp: number;
  marginPct: number;
  vat: number;
  delta: number;
  belowCost: boolean;
};

export function buildQuotationCalcPreview(
  lines: QuotationCalcLineInput[],
  mode: QuotationCalcMode,
  value: number,
  vatPct: number
): QuotationCalcLinePreview[] {
  const vat = Number.isFinite(vatPct) ? Math.max(0, vatPct) : 0;
  return lines.map((line) => {
    const newClient =
      Math.round(quotationCalcNewClient(line.baseCost, mode, value) * 100) / 100;
    const gp = newClient - line.baseCost;
    const marginPct = newClient ? (gp / newClient) * 100 : 0;
    return {
      ...line,
      newClient,
      gp,
      marginPct,
      vat: (newClient * vat) / 100,
      delta: newClient - line.clientNow,
      belowCost: newClient < line.baseCost,
    };
  });
}

export function sumQuotationCalcPreview(rows: QuotationCalcLinePreview[]) {
  const baseCost = rows.reduce((a, r) => a + r.baseCost, 0);
  const clientNow = rows.reduce((a, r) => a + r.clientNow, 0);
  const newClient = rows.reduce((a, r) => a + r.newClient, 0);
  const gp = rows.reduce((a, r) => a + r.gp, 0);
  const vat = rows.reduce((a, r) => a + r.vat, 0);
  const belowCostCount = rows.filter((r) => r.belowCost).length;
  return {
    baseCost,
    clientNow,
    newClient,
    gp,
    marginPct: newClient ? (gp / newClient) * 100 : 0,
    vat,
    /** Pack footer “Client pays” = new client + VAT. */
    clientPays: newClient + vat,
    change: newClient - clientNow,
    belowCostCount,
    hasBelowCost: belowCostCount > 0,
  };
}

export function F2(n: number): string {
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
