/**
 * Creator DNA lifecycle — forward-only maturity transitions.
 */

import type {
  CreatorDnaLifecycle,
  DnaIntelligenceSource,
  LineageEventType,
} from "../types";
import { DNA_LIFECYCLE_RANK } from "../types";

export function intelligenceSourceFromEventType(
  eventType: LineageEventType | undefined,
  explicit?: DnaIntelligenceSource | null
): DnaIntelligenceSource | null {
  if (explicit) return explicit;
  switch (eventType) {
    case "baseline_population":
      return "baseline_import";
    case "ipl_snapshot_merge":
    case "reprocess_merge":
      return "apify_enrichment";
    case "manual_update":
      return "manual_update";
    case "ai_score_merge":
      return "api_provider";
    default:
      return null;
  }
}

function maxLifecycle(
  current: CreatorDnaLifecycle,
  candidate: CreatorDnaLifecycle
): CreatorDnaLifecycle {
  if (candidate === "ARCHIVED") return "ARCHIVED";
  if (current === "ARCHIVED") return "ARCHIVED";
  return DNA_LIFECYCLE_RANK[candidate] > DNA_LIFECYCLE_RANK[current]
    ? candidate
    : current;
}

export function resolveLifecycleAfterMerge(input: {
  current: CreatorDnaLifecycle | null | undefined;
  mergeSource: DnaIntelligenceSource | null;
  influencerStatus: string;
  isImport: boolean;
  hasCampaignHistory: boolean;
  hasEnrichmentSnapshot: boolean;
}): CreatorDnaLifecycle {
  const status = input.influencerStatus.toLowerCase();
  if (status === "archived" || status === "inactive") {
    return "ARCHIVED";
  }

  let lifecycle: CreatorDnaLifecycle =
    input.current ??
    (input.isImport && input.mergeSource === "baseline_import" ? "IMPORTED" : "BASELINE");

  if (input.mergeSource === "baseline_import") {
    if (lifecycle === "IMPORTED") {
      lifecycle = "BASELINE";
    } else if (!input.current) {
      lifecycle = input.isImport ? "IMPORTED" : "BASELINE";
      if (input.isImport) {
        lifecycle = "BASELINE";
      }
    } else {
      lifecycle = maxLifecycle(lifecycle, "BASELINE");
    }
  }

  if (
    input.mergeSource === "apify_enrichment" ||
    input.hasEnrichmentSnapshot
  ) {
    lifecycle = maxLifecycle(lifecycle, "ENRICHED");
  }

  if (input.hasCampaignHistory) {
    lifecycle = maxLifecycle(lifecycle, "ACTIVE");
  }

  return lifecycle;
}

export function appendIntelligenceSource(
  existing: DnaIntelligenceSource[] | null | undefined,
  source: DnaIntelligenceSource | null
): DnaIntelligenceSource[] {
  if (!source) return existing ?? [];
  const list = [...(existing ?? [])];
  if (!list.includes(source)) {
    list.push(source);
  }
  return list;
}
