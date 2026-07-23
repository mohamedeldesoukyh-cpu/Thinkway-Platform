/**
 * Pure, server-free policy helpers for adding creators to a shortlist. Kept
 * separate from `add-to-shortlist-client.ts` (which imports the server action) so
 * the logic is unit-testable without a Next.js/Supabase runtime.
 */

export type AddableCreatorRef = {
  influencer_id: string | null;
  discovered_profile_id: string | null;
};

export type ShortlistItemMembershipRef = {
  influencer_id?: string | null;
  profile_id?: string | null;
  unified_id?: string | null;
  collapse_group_id?: string | null;
};

/** True when the creator already has a standalone (non-collapsed) row on the list. */
export function hasStandaloneShortlistCreator(
  existingItems: ShortlistItemMembershipRef[],
  resolved: {
    influencerId?: string | null;
    discoveredProfileId?: string | null;
    unifiedId?: string | null;
  }
): boolean {
  return existingItems.some((item) => {
    if (item.collapse_group_id) return false;
    if (
      resolved.discoveredProfileId &&
      item.profile_id === resolved.discoveredProfileId
    ) {
      return true;
    }
    if (resolved.influencerId && item.influencer_id === resolved.influencerId) {
      return true;
    }
    if (resolved.unifiedId && item.unified_id === resolved.unifiedId) {
      return true;
    }
    return false;
  });
}

export type AddToShortlistOutcome = {
  added: number;
  alreadyOnList: number;
  ineligible: number;
  failed: number;
  firstError: string | null;
};

export function emptyOutcome(): AddToShortlistOutcome {
  return { added: 0, alreadyOnList: 0, ineligible: 0, failed: 0, firstError: null };
}

/**
 * A unified creator can be added when it resolves to EITHER an imported/internal
 * influencer OR a discovered profile. The shortlist items table accepts both
 * (`influencer_id` / `profile_id` partial-unique columns), so we never require a
 * `discovered_profile_id` — that was the original bug that rejected imported
 * influencers ("cannot be added to discovery lists").
 */
export function isAddableCreator(creator: AddableCreatorRef): boolean {
  return Boolean(creator.influencer_id || creator.discovered_profile_id);
}

/** Folds a single V2 add-action result into a running outcome (pure). */
export function applyAddResult(
  outcome: AddToShortlistOutcome,
  result: { ok: boolean; message?: string }
): AddToShortlistOutcome {
  if (result.ok) {
    if (result.message?.toLowerCase().includes("already")) {
      return { ...outcome, alreadyOnList: outcome.alreadyOnList + 1 };
    }
    return { ...outcome, added: outcome.added + 1 };
  }
  return {
    ...outcome,
    failed: outcome.failed + 1,
    firstError: outcome.firstError ?? result.message ?? "Add failed",
  };
}

/** Builds a single, human-friendly summary line for a bulk add outcome. */
export function describeAddOutcome(outcome: AddToShortlistOutcome): string {
  const parts: string[] = [];
  if (outcome.added > 0) parts.push(`${outcome.added} added`);
  if (outcome.alreadyOnList > 0) parts.push(`${outcome.alreadyOnList} already on list`);
  if (outcome.ineligible > 0) parts.push(`${outcome.ineligible} not addable`);
  if (outcome.failed > 0) parts.push(`${outcome.failed} failed`);
  return parts.join(" · ") || "No creators added";
}
