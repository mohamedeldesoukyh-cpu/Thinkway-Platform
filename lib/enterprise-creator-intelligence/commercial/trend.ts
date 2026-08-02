import type {
  CommercialMetricKey,
  CommercialTrendDirection,
  CommercialTrendLabel,
  CommercialTrendPolarity,
} from "@/lib/enterprise-creator-intelligence/commercial/types";

export function metricTrendPolarity(
  key: CommercialMetricKey
): CommercialTrendPolarity {
  switch (key) {
    case "cpm":
    case "cpe":
    case "cost_per_deliverable":
      return "lower_is_better";
    case "historical_pricing":
    case "negotiation_trend":
    case "price_movement":
      return "price_direction";
    default:
      return "higher_is_better";
  }
}

export function deriveTrendDirection(
  current: number | null,
  previous: number | null
): CommercialTrendDirection {
  if (current == null || previous == null) return "unknown";
  const delta = current - previous;
  const basis = Math.abs(previous) > 0 ? Math.abs(previous) : 1;
  if (Math.abs(delta) / basis < 0.01) return "flat";
  return delta > 0 ? "up" : "down";
}

/** Consistent business trend labels for all commercial metrics. */
export function classifyBusinessTrend(
  key: CommercialMetricKey,
  direction: CommercialTrendDirection
): CommercialTrendLabel {
  if (direction === "unknown") return "Unknown";
  if (direction === "flat") return "Stable";

  const polarity = metricTrendPolarity(key);
  if (polarity === "price_direction") {
    return direction === "up" ? "Increasing" : "Decreasing";
  }
  if (polarity === "lower_is_better") {
    // Numeric up in CPM/CPE is commercially worse.
    return direction === "up" ? "Declining" : "Improving";
  }
  return direction === "up" ? "Improving" : "Declining";
}
