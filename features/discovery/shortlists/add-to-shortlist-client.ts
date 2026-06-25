import type { UnifiedCreatorResult } from "@/lib/creators/types";

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

export async function addUnifiedCreatorsToShortlist(
  shortlistId: string,
  creators: UnifiedCreatorResult[]
): Promise<AddToShortlistOutcome> {
  let outcome = emptyOutcome();

  for (const creator of creators) {
    if (!isAddableCreator(creator)) {
      outcome = { ...outcome, ineligible: outcome.ineligible + 1 };
      continue;
    }

    // Sequential to keep the per-item dedup check race-free.
    const result = await addCreatorToShortlistV2({
      shortlistId,
      unifiedId: creator.unified_id,
      discoveredProfileId: creator.discovered_profile_id,
      influencerId: creator.influencer_id,
    });

    outcome = applyAddResult(outcome, result);
  }

  return outcome;
}
