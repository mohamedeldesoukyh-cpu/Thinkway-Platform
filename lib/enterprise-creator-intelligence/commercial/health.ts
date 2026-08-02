import type {
  CommercialHealth,
  CommercialHealthLevel,
  CommercialMetric,
} from "@/lib/enterprise-creator-intelligence/commercial/types";

function worst(
  levels: CommercialHealthLevel[]
): CommercialHealthLevel {
  const order: CommercialHealthLevel[] = [
    "Excellent",
    "Good",
    "Monitor",
    "Attention",
    "Critical",
  ];
  let worstIdx = 0;
  for (const level of levels) {
    worstIdx = Math.max(worstIdx, order.indexOf(level));
  }
  return order[worstIdx] ?? "Monitor";
}

function levelFromConfidence(percent: number | null): CommercialHealthLevel {
  if (percent == null) return "Attention";
  if (percent >= 85) return "Excellent";
  if (percent >= 70) return "Good";
  if (percent >= 50) return "Monitor";
  if (percent >= 30) return "Attention";
  return "Critical";
}

function metric(metrics: CommercialMetric[], key: string): CommercialMetric | undefined {
  return metrics.find((m) => m.key === key);
}

/**
 * Commercial Health summary — not an investment score.
 * Dimensions: Pricing · Efficiency · Performance · Stability · Confidence.
 */
export function computeCommercialHealth(
  metrics: CommercialMetric[]
): CommercialHealth {
  const reasons: string[] = [];
  const roi = metric(metrics, "roi");
  const cpm = metric(metrics, "cpm");
  const cpe = metric(metrics, "cpe");
  const pricing = metric(metrics, "historical_pricing");
  const negotiation = metric(metrics, "negotiation_trend");
  const priceMove = metric(metrics, "price_movement");

  const confidences = metrics
    .map((m) => m.confidence.percent)
    .filter((v): v is number => v != null);
  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((s, n) => s + n, 0) / confidences.length
      : null;

  const commercialConfidence = levelFromConfidence(avgConfidence);

  let efficiency: CommercialHealthLevel = "Monitor";
  if (cpm?.currentValue == null && cpe?.currentValue == null) {
    efficiency = "Attention";
    reasons.push("Efficiency metrics missing Thinkway cost/performance inputs.");
  } else if (
    cpm?.trendLabel === "Improving" ||
    cpe?.trendLabel === "Improving"
  ) {
    efficiency = "Good";
  } else if (
    cpm?.trendLabel === "Declining" ||
    cpe?.trendLabel === "Declining"
  ) {
    efficiency = "Attention";
    reasons.push("CPM/CPE efficiency is declining.");
  } else {
    efficiency = "Good";
  }

  let performance: CommercialHealthLevel = "Monitor";
  if (roi?.currentValue == null) {
    performance = "Attention";
    reasons.push("ROI unavailable — campaign revenue/cost attribution incomplete.");
  } else if (roi.currentValue >= 2) {
    performance = "Excellent";
  } else if (roi.currentValue >= 0.5) {
    performance = "Good";
  } else if (roi.currentValue >= 0) {
    performance = "Monitor";
  } else {
    performance = "Critical";
    reasons.push("ROI is negative.");
  }

  let pricingLevel: CommercialHealthLevel = "Monitor";
  if (pricing?.currentValue == null) {
    pricingLevel = "Attention";
    reasons.push("Historical pricing unavailable.");
  } else if (
    negotiation?.trendLabel === "Increasing" ||
    priceMove?.trendLabel === "Increasing"
  ) {
    pricingLevel = "Monitor";
    reasons.push("Quoted pricing is increasing — monitor negotiation.");
  } else {
    pricingLevel = "Good";
  }

  let commercialStability: CommercialHealthLevel = "Good";
  const unstable = metrics.filter(
    (m) => m.trendLabel === "Unknown" || m.historicalSeriesAvailable === "No"
  ).length;
  if (unstable > metrics.length * 0.6) {
    commercialStability = "Attention";
    reasons.push("Limited historical commercial series for stability.");
  } else if (
    metrics.some(
      (m) => m.trendLabel === "Declining" && m.key === "roi"
    )
  ) {
    commercialStability = "Monitor";
  }

  const level = worst([
    pricingLevel,
    efficiency,
    performance,
    commercialStability,
    commercialConfidence,
  ]);

  if (reasons.length === 0) {
    reasons.push("Commercial metrics are available with acceptable confidence.");
  }

  return {
    level,
    summary: `Commercial Health: ${level}.`,
    dimensions: {
      pricing: pricingLevel,
      efficiency,
      performance,
      commercialStability,
      commercialConfidence,
    },
    reasons,
  };
}
