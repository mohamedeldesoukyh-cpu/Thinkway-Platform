import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { defaultPlatformAccountIds } from "./components/select-platform-accounts-dialog";
import { addCreatorsToShortlistsV2 } from "./actions";
import {
  describeAddOutcome,
  emptyOutcome,
  isAddableCreator,
  type AddToShortlistOutcome,
} from "./add-to-shortlist-policy";

export { describeAddOutcome, isAddableCreator };
export type { AddToShortlistOutcome };

export type AddCreatorPlatformSelection = {
  creator: UnifiedCreatorResult;
  platformAccountIds: string[];
};

export async function addUnifiedCreatorsToShortlist(
  shortlistId: string,
  creators: UnifiedCreatorResult[],
  selections?: AddCreatorPlatformSelection[]
): Promise<AddToShortlistOutcome> {
  return addUnifiedCreatorsToShortlists([shortlistId], creators, selections);
}

/**
 * One server round-trip for the full selection (avoids N sequential actions that
 * timed out mid-batch and dropped creators — e.g. 24 selected → only 12 saved).
 */
export async function addUnifiedCreatorsToShortlists(
  shortlistIds: string[],
  creators: UnifiedCreatorResult[],
  selections?: AddCreatorPlatformSelection[]
): Promise<AddToShortlistOutcome> {
  const uniqueShortlistIds = [...new Set(shortlistIds.filter(Boolean))];
  if (uniqueShortlistIds.length === 0) {
    return {
      ...emptyOutcome(),
      failed: creators.length,
      firstError: "Select at least one shortlist.",
    };
  }

  const selectionByUnifiedId = new Map(
    (selections ?? []).map((entry) => [entry.creator.unified_id, entry.platformAccountIds])
  );

  let ineligible = 0;
  const payload: Array<{
    unifiedId?: string | null;
    discoveredProfileId?: string | null;
    influencerId?: string | null;
    platformAccountIds?: string[];
  }> = [];

  for (const creator of creators) {
    if (!isAddableCreator(creator)) {
      ineligible += 1;
      continue;
    }
    payload.push({
      unifiedId: creator.unified_id,
      discoveredProfileId: creator.discovered_profile_id,
      influencerId: creator.influencer_id,
      platformAccountIds:
        selectionByUnifiedId.get(creator.unified_id) ?? defaultPlatformAccountIds(creator),
    });
  }

  if (payload.length === 0) {
    return {
      ...emptyOutcome(),
      ineligible,
      firstError:
        ineligible > 0 ? "Selected creators cannot be added to discovery lists." : null,
    };
  }

  const result = await addCreatorsToShortlistsV2({
    shortlistIds: uniqueShortlistIds,
    creators: payload,
  });

  return {
    added: result.added ?? 0,
    alreadyOnList: result.alreadyOnList ?? 0,
    ineligible,
    failed: result.failed ?? 0,
    firstError: result.ok ? null : (result.message ?? "Failed to add to list"),
    addedUnifiedIds: result.addedUnifiedIds ?? [],
    alreadyUnifiedIds: result.alreadyUnifiedIds ?? [],
  };
}
