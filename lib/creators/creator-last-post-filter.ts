/**
 * Canonical last-publication freshness filter for Creator Search.
 *
 * Product contract (Phase 0):
 * - Only `recent_publications[].posted_at` (creator-level or per-platform) qualifies.
 * - Never infer freshness from `last_enriched_at` / sync timestamps.
 * - Missing or unparseable dates do NOT match when a window is selected.
 */

import type { UnifiedCreatorResult } from "@/lib/creators/types";

export const LAST_POST_WITHIN_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "365d": 365,
};

export function latestCanonicalPublicationTimestamp(
  creator: UnifiedCreatorResult
): number | null {
  const timestamps: number[] = [];
  const pushDate = (value: string | null | undefined) => {
    if (!value) return;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) timestamps.push(parsed);
  };

  for (const publication of creator.recent_publications ?? []) {
    pushDate(publication.posted_at);
  }
  for (const platform of creator.platforms) {
    for (const publication of platform.recent_publications ?? []) {
      pushDate(publication.posted_at);
    }
  }

  if (timestamps.length === 0) return null;
  return Math.max(...timestamps);
}

export function creatorMatchesLastPostWithin(
  creator: UnifiedCreatorResult,
  within: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  const key = within?.trim() ?? "";
  if (!key) return true;
  const days = LAST_POST_WITHIN_DAYS[key];
  if (!days) return true;

  const latest = latestCanonicalPublicationTimestamp(creator);
  if (latest == null) return false;
  return latest >= nowMs - days * 86_400_000;
}
