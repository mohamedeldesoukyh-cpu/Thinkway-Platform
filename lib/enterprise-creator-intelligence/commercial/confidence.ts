import type { CommercialConfidence } from "@/lib/enterprise-creator-intelligence/commercial/types";

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatBasedOnValue(value: string | number): string {
  if (typeof value !== "number") return String(value);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function buildConfidenceReason(
  basedOn: CommercialConfidence["basedOn"]
): string {
  if (basedOn.length === 0) return "Insufficient sample evidence.";
  return `Based on ${basedOn
    .map((b) => `${formatBasedOnValue(b.value)} ${b.label}`)
    .join(", ")}.`;
}

export type ConfidenceSample = {
  campaignCount?: number;
  monthCount?: number;
  engagementTotal?: number;
  impressionTotal?: number;
  publicationCount?: number;
  quoteCount?: number;
  deliverableCount?: number;
  viewSampleCount?: number;
  reachSampleCount?: number;
};

/**
 * Explainable confidence from sample coverage (not a black-box model).
 * Weights are transparent and listed in `basedOn` + `reason`.
 */
export function computeCommercialConfidence(
  sample: ConfidenceSample,
  kind:
    | "efficiency"
    | "roi"
    | "views"
    | "reach"
    | "pricing"
    | "deliverable"
): CommercialConfidence {
  const basedOn: CommercialConfidence["basedOn"] = [];
  let score = 0;
  let weight = 0;

  const add = (
    label: string,
    raw: number | undefined,
    cap: number,
    portion: number
  ) => {
    const value = raw ?? 0;
    basedOn.push({ label, value });
    score += Math.min(value / cap, 1) * portion;
    weight += portion;
  };

  if (kind === "efficiency" || kind === "roi") {
    add("Campaigns", sample.campaignCount, 28, 40);
    add("Months", sample.monthCount, 14, 30);
    add("Engagements", sample.engagementTotal, 3_100_000, 30);
  } else if (kind === "views") {
    add("View samples", sample.viewSampleCount, 24, 50);
    add("Months", sample.monthCount, 12, 30);
    add("Publications", sample.publicationCount, 40, 20);
  } else if (kind === "reach") {
    add("Reach samples", sample.reachSampleCount, 20, 60);
    add("Campaigns", sample.campaignCount, 20, 40);
  } else if (kind === "pricing") {
    add("Quotes", sample.quoteCount, 12, 70);
    add("Months", sample.monthCount, 12, 30);
  } else {
    add("Deliverables", sample.deliverableCount, 20, 50);
    add("Campaigns", sample.campaignCount, 20, 50);
  }

  if (sample.impressionTotal != null) {
    basedOn.push({ label: "Impressions", value: sample.impressionTotal });
  }
  if (sample.publicationCount != null && kind !== "views") {
    basedOn.push({ label: "Publications", value: sample.publicationCount });
  }

  const percent = weight <= 0 ? null : clampPercent((score / weight) * 100);

  return {
    percent,
    reason: buildConfidenceReason(basedOn),
    basedOn,
  };
}
