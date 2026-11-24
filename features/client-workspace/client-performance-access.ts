import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
import { requireClientWorkspaceSectionAccess } from "./require-workspace-access";
import { hydrateReviewCampaigns } from "./resolve-review-campaign";

export async function clientPerformanceAccess(token: string) {
  const access = await requireClientWorkspaceSectionAccess(token, "approval");
  if (!access.ok) throw new Error(access.message);
  const db = createServiceRoleClient();
  const [review] = await hydrateReviewCampaigns(db, [access.review]);
  if (!review.campaignHeaderId) throw new Error("Performance reporting is available once the campaign starts.");
  return { db, campaignId: review.campaignHeaderId, workspaceId: review.journeyId || review.id, review, entitlement: access.entitlement };
}
