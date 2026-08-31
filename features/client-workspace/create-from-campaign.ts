import { getCampaignAssignmentHierarchy } from "@/features/campaigns/queries/assignment-hierarchy";
import { getCampaignWorkspace } from "@/features/campaigns/queries";
import type { SupabaseClient } from "@supabase/supabase-js";

import { persistClientReview, type CreateClientReviewResult } from "./persist-client-review";
import { fingerprintFromSnapshotCreators } from "./snapshot";
import { loadIdentityLogoForReview } from "./identity-logo";
import { defaultQuotationClientSelection } from "./client-review-selection";
import {
  snapshotCreatorsFromAssignmentHierarchy,
  snapshotFromCampaignAssignments,
} from "./snapshot-from-campaign";

export type CreateClientReviewFromCampaignInput = {
  campaignHeaderId: string;
  userId: string;
  origin: string;
};

export {
  snapshotCreatorsFromAssignmentHierarchy,
  snapshotFromCampaignAssignments,
} from "./snapshot-from-campaign";

export async function createClientReviewFromCampaign(
  supabase: SupabaseClient,
  input: CreateClientReviewFromCampaignInput
): Promise<CreateClientReviewResult> {
  const workspace = await getCampaignWorkspace(input.campaignHeaderId);
  if (!workspace) {
    return {
      ok: false,
      message: "Campaign not found.",
      blockers: ["Campaign not found."],
    };
  }

  const hierarchy = await getCampaignAssignmentHierarchy(input.campaignHeaderId, workspace);
  const creators = snapshotCreatorsFromAssignmentHierarchy(hierarchy);
  const snapshot = snapshotFromCampaignAssignments({ workspace, creators });
  snapshot.identityLogo =
    (await loadIdentityLogoForReview(supabase, {
      campaignHeaderId: workspace.id,
      clientLabel: snapshot.clientLabel,
      brandName: snapshot.brandName,
      campaignName: snapshot.campaignName,
    })) ?? undefined;

  return persistClientReview({
    supabase,
    userId: input.userId,
    origin: input.origin,
    source: "studio",
    scope: workspace.campaign_object_id
      ? { source: "studio", campaignObjectId: workspace.campaign_object_id }
      : { source: "campaign", campaignHeaderId: workspace.id },
    campaignObjectId: workspace.campaign_object_id ?? null,
    campaignHeaderId: workspace.id,
    quotationId: workspace.quotation_id ?? null,
    shortlistId: workspace.shortlist_id ?? null,
    clientLabel: snapshot.clientLabel,
    brandName: snapshot.brandName,
    campaignName: snapshot.campaignName,
    fingerprint: fingerprintFromSnapshotCreators(creators, {
      source: "campaign",
      campaignHeaderId: workspace.id,
    }),
    selection: defaultQuotationClientSelection(
      creators.map((creator) => creator.creatorId),
      true
    ),
    snapshot,
    alreadyOpenMessage: "A Client Workspace link already exists for this campaign.",
    reuseInteractiveReview: true,
    mintMissingShareToken: true,
  });
}
