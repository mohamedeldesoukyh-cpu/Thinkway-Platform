/**
 * Creator DNA baseline coverage report — generated after Phase 2 backfill.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { calculateDnaCompleteness } from "./dna-completeness-engine";
import { parseCreatorDNADocument } from "./document-factory";
import type { CreatorDNADocument } from "../types";

type AnySupabase = SupabaseClient;

export type CompletenessBand = "0-20" | "21-40" | "41-60" | "61-80" | "81-100";

export type CreatorDnaCoverageReport = {
  generatedAt: string;
  phase: "creator-dna-baseline-coverage";
  totals: {
    creators: number;
    dnaDocuments: number;
    missingDna: number;
    averageCompleteness: number;
    createdDuringBackfill: number;
    mergedDuringBackfill: number;
    skippedDuringBackfill: number;
    errorsDuringBackfill: number;
  };
  completenessDistribution: Record<CompletenessBand, number>;
  platformBreakdown: Record<string, number>;
  topMissingFields: Array<{ field: string; count: number }>;
  lifecycleBreakdown: Record<string, number>;
  sourceHistoryBreakdown: Record<string, number>;
};

export type BackfillRunStats = {
  created: number;
  merged: number;
  skipped: number;
  errors: number;
};

const COMPLETENESS_BANDS: CompletenessBand[] = [
  "0-20",
  "21-40",
  "41-60",
  "61-80",
  "81-100",
];

function completenessBand(score: number): CompletenessBand {
  if (score <= 20) return "0-20";
  if (score <= 40) return "21-40";
  if (score <= 60) return "41-60";
  if (score <= 80) return "61-80";
  return "81-100";
}

function emptyDistribution(): Record<CompletenessBand, number> {
  return {
    "0-20": 0,
    "21-40": 0,
    "41-60": 0,
    "61-80": 0,
    "81-100": 0,
  };
}

/** Scan creator_dna rows and produce Sprint 1 coverage report. */
export async function generateCreatorDnaCoverageReport(
  supabase: AnySupabase,
  backfillStats?: BackfillRunStats
): Promise<CreatorDnaCoverageReport> {
  const [creatorCountResult, dnaCountResult] = await Promise.all([
    supabase.from("influencers").select("id", { count: "exact", head: true }),
    supabase.from("creator_dna").select("influencer_id", { count: "exact", head: true }),
  ]);

  if (creatorCountResult.error) throw new Error(creatorCountResult.error.message);
  if (dnaCountResult.error) throw new Error(dnaCountResult.error.message);

  const totalCreators = creatorCountResult.count ?? 0;
  const totalDna = dnaCountResult.count ?? 0;

  const distribution = emptyDistribution();
  const missingFieldCounts = new Map<string, number>();
  const lifecycleBreakdown: Record<string, number> = {};
  const sourceHistoryBreakdown: Record<string, number> = {};

  let completenessSum = 0;
  let completenessCount = 0;

  const PAGE_SIZE = 1000;
  let dnaOffset = 0;
  while (true) {
    const { data: page, error: dnaPageError } = await supabase
      .from("creator_dna")
      .select("influencer_id, document, dna_completeness_score")
      .range(dnaOffset, dnaOffset + PAGE_SIZE - 1);

    if (dnaPageError) throw new Error(dnaPageError.message);
    const rows = page ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const cached = Number(
        (row as { dna_completeness_score?: number | null }).dna_completeness_score
      );
      const document = parseCreatorDNADocument(
        (row as { document?: unknown }).document
      ) as CreatorDNADocument;

      const completeness = Number.isFinite(cached)
        ? cached
        : calculateDnaCompleteness(document).dnaCompleteness;

      completenessSum += completeness;
      completenessCount += 1;
      distribution[completenessBand(completeness)] += 1;

      const lifecycle = document.meta.lifecycle ?? "UNKNOWN";
      lifecycleBreakdown[lifecycle] = (lifecycleBreakdown[lifecycle] ?? 0) + 1;

      for (const source of document.meta.sources ?? []) {
        sourceHistoryBreakdown[source] = (sourceHistoryBreakdown[source] ?? 0) + 1;
      }

      const missing = calculateDnaCompleteness(document).missingFields;
      for (const field of missing) {
        missingFieldCounts.set(field, (missingFieldCounts.get(field) ?? 0) + 1);
      }
    }

    if (rows.length < PAGE_SIZE) break;
    dnaOffset += PAGE_SIZE;
  }

  const platformByInfluencer = new Map<string, string>();
  let platformOffset = 0;
  while (true) {
    const { data: platformPage, error: platformPageError } = await supabase
      .from("influencer_platform_accounts")
      .select("influencer_id, platform, is_primary")
      .range(platformOffset, platformOffset + PAGE_SIZE - 1);

    if (platformPageError) throw new Error(platformPageError.message);
    const rows = platformPage ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const influencerId = (row as { influencer_id: string }).influencer_id;
      const platform = String((row as { platform: string }).platform ?? "unknown")
        .trim()
        .toLowerCase();
      const isPrimary = Boolean((row as { is_primary?: boolean }).is_primary);

      if (!platformByInfluencer.has(influencerId) || isPrimary) {
        platformByInfluencer.set(influencerId, platform);
      }
    }

    if (rows.length < PAGE_SIZE) break;
    platformOffset += PAGE_SIZE;
  }

  const platformBreakdown: Record<string, number> = {};
  for (const platform of platformByInfluencer.values()) {
    platformBreakdown[platform] = (platformBreakdown[platform] ?? 0) + 1;
  }
  platformBreakdown.unknown =
    (platformBreakdown.unknown ?? 0) + Math.max(0, totalDna - platformByInfluencer.size);

  const topMissingFields = [...missingFieldCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([field, count]) => ({ field, count }));

  return {
    generatedAt: new Date().toISOString(),
    phase: "creator-dna-baseline-coverage",
    totals: {
      creators: totalCreators,
      dnaDocuments: totalDna,
      missingDna: Math.max(0, totalCreators - totalDna),
      averageCompleteness:
        completenessCount > 0 ? Math.round((completenessSum / completenessCount) * 10) / 10 : 0,
      createdDuringBackfill: backfillStats?.created ?? 0,
      mergedDuringBackfill: backfillStats?.merged ?? 0,
      skippedDuringBackfill: backfillStats?.skipped ?? 0,
      errorsDuringBackfill: backfillStats?.errors ?? 0,
    },
    completenessDistribution: distribution,
    platformBreakdown,
    topMissingFields,
    lifecycleBreakdown,
    sourceHistoryBreakdown,
  };
}
