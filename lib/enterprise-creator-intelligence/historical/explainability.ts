/**
 * Lightweight Historical explainability wrapper.
 * Sprint 1 series primitives remain unchanged — this wraps the series only.
 */

import { deriveGrowthTrend } from "@/lib/enterprise-creator-intelligence/historical/compute";
import type { CreatorHistoricalMonthlySeries } from "@/lib/enterprise-creator-intelligence/historical/types";
import {
  clampConfidenceToEvidence,
  historicalEvidenceCoverage,
} from "@/lib/enterprise-creator-intelligence/shared/evidence-coverage";
import type { EvidenceCoverage } from "@/lib/enterprise-creator-intelligence/shared/types";

export type CreatorHistoricalExplainability = {
  value: string | number | null;
  meaning: string;
  confidence: number | null;
  evidence: string[];
  historicalTrend: string;
  businessContext: string;
  source: {
    platform: string | null;
    collectionMethod: string;
    refreshTime: string | null;
    confidence: number | null;
  };
  lastUpdated: string | null;
  missingInputs: string[];
};

/**
 * Attach Evidence Coverage + thin explainability without redesigning monthly rows.
 */
export function enrichHistoricalSeries(
  series: Omit<
    CreatorHistoricalMonthlySeries,
    "evidenceCoverage" | "explainability"
  >
): CreatorHistoricalMonthlySeries {
  const monthCount = series.months.length;
  const sampleCaptureCount = series.months.reduce(
    (s, m) => s + (m.sampleCaptureCount ?? 0),
    0
  );
  const evidenceCoverage: EvidenceCoverage = historicalEvidenceCoverage({
    monthCount,
    sampleCaptureCount,
  });
  const explainability = wrapHistoricalSeriesExplainability(
    series,
    evidenceCoverage
  );

  return {
    ...series,
    evidenceCoverage,
    explainability,
  };
}

export function wrapHistoricalSeriesExplainability(
  series: Pick<CreatorHistoricalMonthlySeries, "months" | "platform">,
  evidenceCoverage?: EvidenceCoverage
): CreatorHistoricalExplainability {
  const latest = series.months[series.months.length - 1] ?? null;
  const trend = deriveGrowthTrend(series.months);
  const coverage =
    evidenceCoverage ??
    historicalEvidenceCoverage({
      monthCount: series.months.length,
      sampleCaptureCount: series.months.reduce(
        (s, m) => s + (m.sampleCaptureCount ?? 0),
        0
      ),
    });

  const rawConfidence =
    series.months.length === 0
      ? null
      : Math.min(100, series.months.length * 8 + Math.min(sampleCap(series), 40));
  const confidence = clampConfidenceToEvidence(
    rawConfidence,
    coverage.percent
  );

  const missingInputs = [
    ...(series.months.length === 0 ? ["monthly_metrics"] : []),
    ...coverage.missingInputs,
  ];

  return {
    value: latest?.followers ?? null,
    meaning:
      series.months.length === 0
        ? "No historical monthly series available."
        : `Canonical historical foundation with ${series.months.length} month(s) of append-only projections.`,
    confidence,
    evidence: [
      `months=${series.months.length}`,
      `sample_captures=${sampleCap(series)}`,
      `growth_trend=${trend}`,
      latest ? `latest_period=${latest.periodMonth}` : "latest_period=none",
    ],
    historicalTrend: trend,
    businessContext:
      "Historical Intelligence is the append-only time-series foundation for all later Creator Intelligence layers.",
    source: {
      platform: series.platform,
      collectionMethod:
        "Sprint 1 creator_intelligence_monthly_metrics (append-only captures → monthly projection)",
      refreshTime: latest?.computedAt ?? null,
      confidence,
    },
    lastUpdated: latest?.computedAt ?? null,
    missingInputs: [...new Set(missingInputs)],
  };
}

function sampleCap(
  series: Pick<CreatorHistoricalMonthlySeries, "months">
): number {
  return series.months.reduce((s, m) => s + (m.sampleCaptureCount ?? 0), 0);
}
