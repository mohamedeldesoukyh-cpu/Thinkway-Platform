import type { ProfitabilityBand } from "@/lib/quotations/commercial-workspace/profitability-thresholds";

/** Map Workspace health bands onto the exact Creators-grid card variants. */
export function commercialWorkspaceCreatorCardClass(
  band: ProfitabilityBand
): "quotation-creator-card--green" | "quotation-creator-card--orange" | "quotation-creator-card--missing-cost" {
  switch (band) {
    case "healthy":
      return "quotation-creator-card--green";
    case "warning":
      return "quotation-creator-card--orange";
    case "critical":
      return "quotation-creator-card--missing-cost";
  }
}
