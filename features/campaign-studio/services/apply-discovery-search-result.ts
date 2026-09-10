import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { buildVendorDiscoveryFunnel } from "@/features/campaign-intelligence/services/reasoning/vendor-discovery-funnel";
import { beginPendingCreatorProposal } from "@/features/campaign-intelligence/services/section-updaters";
import {
  buildCreatorDiscoveryData,
  formatDiscoveryDisplay,
} from "@/features/campaign-intelligence/services/structured-section-builders";
import type { GroundedCreator } from "@/features/ai-workflows/formatters/creator-formatter";
import type { ValidatedCampaignIntelligence } from "@/features/campaign-intelligence-profile/types/validated-intelligence";

import { proposeInitialCreatorSlateWithStatus } from "./propose-creator-slate";

/**
 * Write a Discovery search result onto the campaign object.
 *
 * This is the same assembly the workflow's `search-creators` task result goes
 * through in `section-updaters` — the same builders, the same section fields,
 * the same `beginPendingCreatorProposal` → `proposeInitialCreatorSlate`
 * handoff. It exists as a function because the workflow route is driven by a
 * task result and the Studio needs to run the identical write from an operator
 * action. There is no second Discovery, no second slate composer and no new
 * section field.
 *
 * `lastDiscoveryAt` is always stamped, including on an empty result: that stamp
 * is what `resolveStudioDiscoverySufficiency` reads to tell "searched, and this
 * profile has no inventory" apart from "never searched".
 */
export function applyDiscoverySearchResultToCampaignObject(input: {
  campaignObject: CampaignObject;
  creators: GroundedCreator[];
  total: number;
  query?: string;
  facts?: CampaignFacts;
  strategy?: CampaignStrategyDocument | null;
  validated?: ValidatedCampaignIntelligence | null;
  constraintReport?: CreatorsSectionData["constraintReport"];
  cipProfileId?: string;
  now?: string;
}): { campaignObject: CampaignObject; proposed: boolean } {
  const section = input.campaignObject.sections.creators;
  const existingData = (section.data ?? {}) as CreatorsSectionData;
  const hasResults = input.creators.length > 0;
  const discoveryDisplay = formatDiscoveryDisplay(input.creators, input.total, input.query);
  const funnel =
    input.facts && input.strategy
      ? buildVendorDiscoveryFunnel(input.facts, input.strategy, input.total, !hasResults)
      : existingData.vendorDiscoveryFunnel;

  const withDiscovery: CampaignObject = {
    ...input.campaignObject,
    sections: {
      ...input.campaignObject.sections,
      creators: {
        ...section,
        content: hasResults ? discoveryDisplay : section.content,
        data: {
          ...beginPendingCreatorProposal(existingData),
          phase: hasResults ? "discovery" : (existingData.phase ?? "pending"),
          discovery: buildCreatorDiscoveryData(
            input.creators,
            input.total,
            input.query,
            input.facts,
            input.strategy ?? undefined
          ),
          discoveryDisplay,
          vendorDiscoveryFunnel: funnel,
          discoveryPipeline: funnel,
          discoveryEngine: input.cipProfileId ? "cip" : "keyword",
          cipProfileId: input.cipProfileId,
          constraintReport: input.constraintReport ?? existingData.constraintReport,
          lastDiscoveryAt: input.now ?? new Date().toISOString(),
        },
        status: hasResults ? "working" : "pending",
      },
    },
    updatedAt: input.now ?? new Date().toISOString(),
  };

  // With no creators there is nothing to compose; the section stays in the
  // searched-with-no-inventory state rather than recording a failed proposal.
  if (!hasResults) return { campaignObject: withDiscovery, proposed: false };

  const proposal = proposeInitialCreatorSlateWithStatus(withDiscovery, {
    poolCreators: input.creators,
    query: input.query,
    strategy: input.strategy,
    validated: input.validated,
  });
  return { campaignObject: proposal.campaignObject, proposed: proposal.proposed };
}
