import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeCreatorCommercialIntelligence,
  type CreatorCommercialFacts,
} from "@/lib/enterprise-creator-intelligence/commercial/compute";
import { loadCreatorCommercialFacts } from "@/lib/enterprise-creator-intelligence/commercial/load-facts";
import { appendCommercialIntelligenceCapture } from "@/lib/enterprise-creator-intelligence/commercial/persist";
import type {
  CommercialHistoryCapture,
  CommercialMetricKey,
  CommercialMetricPoint,
  CreatorCommercialAiHints,
  CreatorCommercialIntelligence,
} from "@/lib/enterprise-creator-intelligence/commercial/types";
import { isMissingTableError } from "@/lib/platform/schema-validation";

async function loadPriorCommercialContext(
  supabase: SupabaseClient,
  influencerId: string
): Promise<{
  priorMetrics: Partial<Record<CommercialMetricKey, number | null>>;
  priorTrend: Partial<Record<CommercialMetricKey, CommercialMetricPoint[]>>;
  history: CommercialHistoryCapture[];
}> {
  const { data, error } = await supabase
    .from("creator_intelligence_commercial_history")
    .select("id, influencer_id, platform, captured_at, currency_code, metrics")
    .eq("influencer_id", influencerId)
    .order("captured_at", { ascending: true })
    .limit(36);

  if (error) {
    if (isMissingTableError(error.message, error.code)) {
      return { priorMetrics: {}, priorTrend: {}, history: [] };
    }
    throw new Error(error.message);
  }

  const history: CommercialHistoryCapture[] = (
    (data ?? []) as Array<Record<string, unknown>>
  ).map((row) => ({
    id: String(row.id),
    influencerId: String(row.influencer_id),
    platform: (row.platform as string | null) ?? null,
    capturedAt: String(row.captured_at),
    currencyCode: (row.currency_code as string | null) ?? null,
    metrics: (row.metrics as CommercialHistoryCapture["metrics"]) ?? [],
  }));

  const priorMetrics: Partial<Record<CommercialMetricKey, number | null>> = {};
  const priorTrend: Partial<Record<CommercialMetricKey, CommercialMetricPoint[]>> =
    {};

  if (history.length > 0) {
    const latest = history[history.length - 1]!;
    for (const metric of latest.metrics) {
      priorMetrics[metric.key] = metric.currentValue;
    }
  }

  for (const capture of history) {
    for (const metric of capture.metrics) {
      const series = priorTrend[metric.key] ?? [];
      series.push({ at: capture.capturedAt, value: metric.currentValue });
      priorTrend[metric.key] = series;
    }
  }

  return { priorMetrics, priorTrend, history };
}

/**
 * Compute current commercial intelligence, enrich with append-only history trends,
 * optionally persist a new capture (never overwrites prior rows).
 */
export async function loadCreatorCommercialIntelligence(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platform?: string | null;
    /** When true, append a new history row after compute. Default false (read-path safe). */
    persistCapture?: boolean;
    factsOverride?: CreatorCommercialFacts;
  }
): Promise<{
  current: CreatorCommercialIntelligence;
  history: CommercialHistoryCapture[];
}> {
  const { priorMetrics, priorTrend, history } = await loadPriorCommercialContext(
    supabase,
    input.influencerId
  );

  const facts =
    input.factsOverride ??
    (await loadCreatorCommercialFacts(supabase, {
      influencerId: input.influencerId,
      platform: input.platform,
    }));

  const current = computeCreatorCommercialIntelligence({
    ...facts,
    priorMetrics,
    priorTrend,
  });

  if (input.persistCapture) {
    await appendCommercialIntelligenceCapture(supabase, current);
  }

  return { current, history };
}

/** AI-ready commercial hints — no AI execution. */
export function buildCommercialAiHints(
  intelligence: CreatorCommercialIntelligence
): CreatorCommercialAiHints {
  return intelligence.aiHints;
}
