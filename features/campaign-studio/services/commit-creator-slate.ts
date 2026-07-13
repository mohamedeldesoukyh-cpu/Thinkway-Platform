import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignObject } from "@/features/campaign-intelligence";
import {
  markStaleCampaignOutputs,
  regenerateStaleCampaignOutputs,
} from "@/features/campaign-outputs/output-registry";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";

import { reoptimizeCampaignAfterApply } from "./apply-draft-reoptimize";
import { mapBrowseCreatorToSearchResult } from "./creator-platform-utils";
import { regeneratePlanSectionsFromSlate } from "./plan-section-regeneration";
import { normalizeCreatorId } from "./studio-draft";

/**
 * After draft changes are applied to the slate: reoptimize, regenerate dependent
 * plan sections, mark stale outputs, and regenerate outputs.
 */
export async function commitCreatorSlateAndRegeneratePlan(
  supabase: SupabaseClient,
  campaignObject: CampaignObject,
  options: { unenrichedCreatorIds?: string[] } = {}
): Promise<CampaignObject> {
  const reoptimized = await reoptimizeCampaignAfterApply(supabase, campaignObject, {
    unenrichedCreatorIds: options.unenrichedCreatorIds,
  });

  const creatorsData = reoptimized.sections.creators.data as
    | { recommendations?: { creatorIds?: string[] } }
    | undefined;
  const slateIds = creatorsData?.recommendations?.creatorIds ?? [];

  let next = reoptimized;
  if (slateIds.length > 0) {
    const facts = getCampaignFacts(reoptimized);
    const influencerIds = [
      ...new Set(
        slateIds
          .filter((id) => id && !id.startsWith("dp:") && !id.startsWith("dis:"))
          .map(normalizeCreatorId)
      ),
    ];

    if (influencerIds.length > 0) {
      try {
        const result = await browseUnifiedCreators(
          supabase,
          { influencerIds, page: 1, pageSize: influencerIds.length, productionOnly: true },
          "discovery"
        );
        const cards = result.creators.map((c) =>
          mapBrowseCreatorToSearchResult(c, facts?.platforms)
        );
        next = regeneratePlanSectionsFromSlate(reoptimized, cards);
      } catch {
        next = reoptimized;
      }
    }
  }

  const marked = markStaleCampaignOutputs(next);
  return regenerateStaleCampaignOutputs(marked, { origin: "automatic" });
}
