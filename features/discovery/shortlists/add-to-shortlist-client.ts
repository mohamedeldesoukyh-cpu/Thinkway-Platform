import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { defaultPlatformAccountIds } from "./components/select-platform-accounts-dialog";
import { addCreatorToShortlistV2 } from "./actions";
import {
  applyAddResult,
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

  let outcome = emptyOutcome();
  const selectionByUnifiedId = new Map(
    (selections ?? []).map((entry) => [entry.creator.unified_id, entry.platformAccountIds])
  );

  for (const shortlistId of uniqueShortlistIds) {
    for (const creator of creators) {
      if (!isAddableCreator(creator)) {
        outcome = { ...outcome, ineligible: outcome.ineligible + 1 };
        continue;
      }

      const platformAccountIds =
        selectionByUnifiedId.get(creator.unified_id) ?? defaultPlatformAccountIds(creator);

      // Sequential to keep the per-item dedup check race-free.
      const result = await addCreatorToShortlistV2({
        shortlistId,
        unifiedId: creator.unified_id,
        discoveredProfileId: creator.discovered_profile_id,
        influencerId: creator.influencer_id,
        platformAccountIds,
      });

      outcome = applyAddResult(outcome, result);
    }
  }

  return outcome;
}
