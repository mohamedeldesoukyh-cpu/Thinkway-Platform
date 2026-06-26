/**
 * Pure, testable enrichment policy: 30-day freshness skip, priority assignment,
 * next-refresh scheduling, and BullMQ priority mapping.
 *
 * CRITICAL credit-preservation rules (spec §2):
 *  - NEVER auto-enrich during import / PDF / CSV / manual creation / discovery.
 *  - Enrich ONLY on detail open, shortlist add, campaign move, explicit refresh,
 *    or when data is stale.
 *  - Skip if last_enriched_at within 30 days UNLESS forced (explicit Refresh).
 */

import {
  ENRICHMENT_STALE_AFTER_DAYS,
} from "./constants";
import type { EnrichmentPriority, EnrichmentTrigger } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
export const STALE_AFTER_MS = ENRICHMENT_STALE_AFTER_DAYS * DAY_MS;

/**
 * True when the creator has never been enriched or was last enriched more than
 * {@link ENRICHMENT_STALE_AFTER_DAYS} days ago.
 */
export function isEnrichmentStale(
  lastEnrichedAt: string | Date | null | undefined,
  now: number = Date.now()
): boolean {
  if (!lastEnrichedAt) return true;
  const ts =
    lastEnrichedAt instanceof Date
      ? lastEnrichedAt.getTime()
      : new Date(lastEnrichedAt).getTime();
  if (Number.isNaN(ts)) return true;
  return now - ts >= STALE_AFTER_MS;
}

export type SkipDecision =
  | { skip: false }
  | { skip: true; reason: string };

/**
 * Decide whether to skip enrichment. Forced (explicit Refresh) never skips.
 * Otherwise skip when data is still fresh (within 30 days).
 */
export function decideEnrichment(input: {
  lastEnrichedAt: string | Date | null | undefined;
  force?: boolean;
  now?: number;
}): SkipDecision {
  if (input.force) return { skip: false };
  if (!isEnrichmentStale(input.lastEnrichedAt, input.now ?? Date.now())) {
    return {
      skip: true,
      reason: `Fresh within ${ENRICHMENT_STALE_AFTER_DAYS} days`,
    };
  }
  return { skip: false };
}

/** Spec §2.D priorities: 1 campaign, 2 shortlist, 3 detail, 4 manual. */
export function priorityForTrigger(trigger: EnrichmentTrigger): EnrichmentPriority {
  switch (trigger) {
    case "campaign":
      return 1;
    case "shortlist":
      return 2;
    case "detail":
      return 3;
    case "manual":
      return 4;
    case "stale":
      return 4;
    default:
      return 4;
  }
}

/**
 * Map business priority (1=highest) to BullMQ's numeric priority. BullMQ also
 * treats lower numbers as higher priority, so the values map 1:1 — but we keep
 * an explicit mapping so the queue contract is independent of business values.
 */
export function bullmqPriority(priority: EnrichmentPriority): number {
  return priority;
}

/**
 * Compute the next scheduled refresh. Higher-reach creators refresh sooner.
 * Keeps Apify usage proportional to commercial value.
 */
export function computeNextRefreshAt(input: {
  followers?: number | null;
  from?: number;
}): Date {
  const from = input.from ?? Date.now();
  const followers = input.followers ?? 0;
  const days = followers >= 500_000 ? 7 : followers >= 50_000 ? 14 : ENRICHMENT_STALE_AFTER_DAYS;
  return new Date(from + days * DAY_MS);
}
