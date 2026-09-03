import { roundOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";

export type PricingCalculatorMode = "af" | "gpm" | "pr" | "gpv";

export const PRICING_CALCULATOR_MODES: Record<
  PricingCalculatorMode,
  { label: string; formula: string; unit: string; defaultValue: number }
> = {
  af: {
    label: "Cost + AF %",
    formula: "rev = cost × (1 + af%)",
    unit: "%",
    defaultValue: 50,
  },
  gpm: {
    label: "Cost + GP margin %",
    formula: "rev = cost ÷ (1 − margin%)",
    unit: "%",
    defaultValue: 35,
  },
  pr: {
    label: "Cost + client price",
    formula: "rev = price you enter",
    unit: "",
    defaultValue: 300000,
  },
  gpv: {
    label: "Cost + GP value",
    formula: "rev = cost + GP",
    unit: "",
    defaultValue: 100000,
  },
};

/** Spec §7 — margin ≥ 100% is unsolvable; hold revenue at cost. */
export function computeProposedRevenue(
  cost: number,
  mode: PricingCalculatorMode,
  value: number
): number {
  const c = roundOperationalAmount(Math.max(0, Number(cost) || 0));
  const v = Math.max(0, Number(value) || 0);
  if (mode === "af") return roundOperationalAmount(c * (1 + v / 100));
  if (mode === "gpm") {
    if (v >= 100) return c;
    return roundOperationalAmount(c / (1 - v / 100));
  }
  if (mode === "pr") return roundOperationalAmount(v);
  return roundOperationalAmount(c + v);
}

export type PricingCalculatorLineInput = {
  lineId: string;
  cost: number;
  revenue: number;
  vatPercent: number;
};

export type PricingCalculatorLinePreview = PricingCalculatorLineInput & {
  newRevenue: number;
  gp: number;
  marginPercent: number;
  vat: number;
  delta: number;
  belowCost: boolean;
};

export function previewPricingCalculatorLines(
  lines: readonly PricingCalculatorLineInput[],
  mode: PricingCalculatorMode,
  value: number,
  vatPercentOverride?: number
): PricingCalculatorLinePreview[] {
  return lines.map((line) => {
    const newRevenue = computeProposedRevenue(line.cost, mode, value);
    const gp = roundOperationalAmount(newRevenue - line.cost);
    const marginPercent = newRevenue
      ? roundOperationalAmount((gp / newRevenue) * 100)
      : 0;
    const vatRate =
      vatPercentOverride != null ? vatPercentOverride : line.vatPercent;
    const vat = roundOperationalAmount(newRevenue * (Math.max(0, vatRate) / 100));
    return {
      ...line,
      newRevenue,
      gp,
      marginPercent,
      vat,
      delta: roundOperationalAmount(newRevenue - line.revenue),
      belowCost: gp < 0,
    };
  });
}
