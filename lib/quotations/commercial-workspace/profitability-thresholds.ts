/**
 * Central Commercial Workspace profitability bands.
 * Labels are Healthy / Warning / Critical — thresholds are configurable.
 */

export type ProfitabilityBand = "healthy" | "warning" | "critical";

export type ProfitabilityThresholds = {
  /** GP% ≥ this → Healthy */
  healthyMinPct: number;
  /** GP% ≥ this and < healthyMinPct → Warning; below → Critical */
  warningMinPct: number;
};

/** Product-approved defaults (Decision 5). */
export const DEFAULT_PROFITABILITY_THRESHOLDS: ProfitabilityThresholds = {
  healthyMinPct: 25,
  warningMinPct: 15,
};

export function resolveProfitabilityBand(
  gpPct: number,
  thresholds: ProfitabilityThresholds = DEFAULT_PROFITABILITY_THRESHOLDS
): ProfitabilityBand {
  if (!Number.isFinite(gpPct)) return "critical";
  if (gpPct >= thresholds.healthyMinPct) return "healthy";
  if (gpPct >= thresholds.warningMinPct) return "warning";
  return "critical";
}

export function profitabilityBandLabel(band: ProfitabilityBand): string {
  switch (band) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Warning";
    case "critical":
      return "Critical";
  }
}
