/**
 * Quick Analysis filters for Commercial Workspace rows.
 */

import {
  resolveProfitabilityBand,
  type ProfitabilityThresholds,
  DEFAULT_PROFITABILITY_THRESHOLDS,
} from "./profitability-thresholds";

export type CommercialWorkspaceQuickFilter =
  | "all"
  | "negative_gp"
  | "low_gp"
  | "high_gp"
  | "high_revenue"
  | "high_cost"
  | "missing_cost"
  | "missing_revenue"
  | "band_healthy"
  | "band_warning"
  | "band_critical";

export type CommercialWorkspaceFilterRow = {
  itemId: string;
  revenueEgp: number;
  costEgp: number;
  gpValueEgp: number;
  gpPct: number;
  influencerName: string;
};

export const QUICK_FILTER_LABELS: Record<CommercialWorkspaceQuickFilter, string> = {
  all: "All lines",
  negative_gp: "Negative GP",
  low_gp: "Low GP",
  high_gp: "High GP",
  high_revenue: "High Revenue",
  high_cost: "High Cost",
  missing_cost: "Missing Cost",
  missing_revenue: "Missing Revenue",
  band_healthy: "Healthy",
  band_warning: "Warning",
  band_critical: "Critical",
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export function filterCommercialWorkspaceRows<T extends CommercialWorkspaceFilterRow>(
  rows: T[],
  filter: CommercialWorkspaceQuickFilter,
  search: string,
  thresholds: ProfitabilityThresholds = DEFAULT_PROFITABILITY_THRESHOLDS
): T[] {
  const q = search.trim().toLowerCase();
  const revenues = rows.map((r) => r.revenueEgp).filter((n) => n > 0);
  const costs = rows.map((r) => r.costEgp).filter((n) => n > 0);
  const revenueCut = median(revenues);
  const costCut = median(costs);

  return rows.filter((row) => {
    if (q) {
      if (!row.influencerName.toLowerCase().includes(q)) return false;
    }

    const band = resolveProfitabilityBand(row.gpPct, thresholds);

    switch (filter) {
      case "all":
        return true;
      case "negative_gp":
        return row.gpValueEgp < 0;
      case "low_gp":
        return band === "warning" || band === "critical";
      case "high_gp":
        return band === "healthy";
      case "high_revenue":
        return row.revenueEgp > 0 && row.revenueEgp >= revenueCut;
      case "high_cost":
        return row.costEgp > 0 && row.costEgp >= costCut;
      case "missing_cost":
        return !Number.isFinite(row.costEgp) || row.costEgp <= 0;
      case "missing_revenue":
        return !Number.isFinite(row.revenueEgp) || row.revenueEgp <= 0;
      case "band_healthy":
        return band === "healthy";
      case "band_warning":
        return band === "warning";
      case "band_critical":
        return band === "critical";
    }
  });
}

export function countCommercialHealth(
  rows: CommercialWorkspaceFilterRow[],
  thresholds: ProfitabilityThresholds = DEFAULT_PROFITABILITY_THRESHOLDS
): { healthy: number; warning: number; critical: number } {
  let healthy = 0;
  let warning = 0;
  let critical = 0;
  for (const row of rows) {
    const band = resolveProfitabilityBand(row.gpPct, thresholds);
    if (band === "healthy") healthy += 1;
    else if (band === "warning") warning += 1;
    else critical += 1;
  }
  return { healthy, warning, critical };
}
