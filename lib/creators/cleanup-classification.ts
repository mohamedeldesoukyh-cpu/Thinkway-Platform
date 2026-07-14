/**
 * Creator cleanup classification — decides, with evidence, whether a creator
 * carries ANY usable intelligence or platform value, and whether it is
 * referenced anywhere that makes it unsafe to archive.
 *
 * Pure: the ops script gathers rows/references and asks; nothing here touches
 * the database. Verdicts:
 *   must_keep     — has intelligence, signals, metrics, references, or manual
 *                   edits (each reason listed)
 *   safe_archive  — verified empty on EVERY dimension below
 * Archiving is soft (influencers.status = 'archived'); the browse already
 * filters status='active' everywhere, so archived creators disappear from
 * Discovery, ranking, and the coverage denominator without data loss.
 */
import type { UnifiedCreatorResult } from "@/lib/creators/types";

export type CreatorReferences = {
  campaignUsage: boolean;
  shortlistReferences: boolean;
  quotationReferences: boolean;
  portalOrDocuments: boolean;
};

export type CleanupVerdict = {
  unifiedId: string;
  sourceType: string;
  verdict: "must_keep" | "safe_archive";
  /** Every reason the creator must be kept (empty for safe_archive). */
  keepReasons: string[];
};

/** True when the creator has any resolvable intelligence or profile signal. */
function intelligenceReasons(creator: UnifiedCreatorResult): string[] {
  const reasons: string[] = [];
  if ((creator.dna_completeness ?? 0) > 0) reasons.push("has_creator_dna");
  if (creator.ai_category?.trim() || creator.ai_niche?.trim()) reasons.push("has_ai_score");
  if (creator.bio?.trim()) reasons.push("has_bio");
  if ((creator.audience_interests?.length ?? 0) > 0) reasons.push("has_audience_interests");
  if ((creator.recent_publications ?? []).some((p) => p.caption?.trim())) {
    reasons.push("has_captions");
  }
  if ((creator.hashtags?.length ?? 0) > 0 || (creator.mentions?.length ?? 0) > 0) {
    reasons.push("has_profile_signals");
  }
  if (creator.source_type !== "public_discovery" && (creator.categories?.length ?? 0) > 0) {
    reasons.push("has_stored_categories");
  }
  return reasons;
}

/** True when any platform account carries real metrics. */
function metricsReasons(creator: UnifiedCreatorResult): string[] {
  const hasMetrics = (creator.platforms ?? []).some(
    (account) =>
      (account.follower_count ?? 0) > 0 ||
      (account.engagement_rate ?? 0) > 0 ||
      (account.avg_views ?? 0) > 0
  );
  return hasMetrics ? ["has_platform_metrics"] : [];
}

/** Manual investment: notes, manual/uploaded avatars, manual metric overrides. */
function manualEditReasons(creator: UnifiedCreatorResult): string[] {
  const reasons: string[] = [];
  if (creator.notes?.trim()) reasons.push("has_manual_notes");
  if (creator.primaryAvatarSource === "manual" || creator.primaryAvatarSource === "uploaded") {
    reasons.push("has_manual_avatar");
  }
  // Manual metric overrides surface on the read model as confidence "verified"
  // — for internal creators that level is ONLY produced by is_manual_override
  // (see resolveInternalMetricConfidence). Discovery "verified" means
  // crawl-verified, not a manual edit, so it is excluded here.
  if (
    creator.source_type !== "public_discovery" &&
    Object.values(creator.metrics ?? {}).some((metric) => metric?.confidence === "verified")
  ) {
    reasons.push("has_manual_metric_override");
  }
  return reasons;
}

function referenceReasons(references: CreatorReferences): string[] {
  const reasons: string[] = [];
  if (references.campaignUsage) reasons.push("referenced_by_campaigns");
  if (references.shortlistReferences) reasons.push("referenced_by_shortlists");
  if (references.quotationReferences) reasons.push("referenced_by_quotations");
  if (references.portalOrDocuments) reasons.push("referenced_by_portals_or_documents");
  return reasons;
}

/** Classify one creator; safe_archive ONLY when every dimension is empty. */
export function classifyCreatorForCleanup(
  creator: UnifiedCreatorResult,
  references: CreatorReferences
): CleanupVerdict {
  const keepReasons = [
    ...intelligenceReasons(creator),
    ...metricsReasons(creator),
    ...manualEditReasons(creator),
    ...referenceReasons(references),
  ];
  return {
    unifiedId: creator.unified_id,
    sourceType: creator.source_type,
    verdict: keepReasons.length === 0 ? "safe_archive" : "must_keep",
    keepReasons,
  };
}
