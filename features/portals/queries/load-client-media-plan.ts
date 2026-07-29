import type { CampaignObject } from "@/features/campaign-intelligence";
import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { getCampaignAssignmentHierarchy } from "@/features/campaigns/queries/assignment-hierarchy";
import {
  buildClientPortalOriginalPayload,
  type ClientMediaPlanPayload,
} from "@/features/portals/queries/client-media-plan-payload";
import { requireClientScope } from "@/features/portals/scope";
import { annotateMediaPlanExecutionStatus } from "@/lib/media-plan/annotate-execution-status";
import { performanceFactsFromAssignmentHierarchy } from "@/lib/media-plan/performance-facts";
import { safeOperationalQuery } from "@/lib/platform/safe-query";

export type { ClientMediaPlanPayload } from "@/features/portals/queries/client-media-plan-payload";
export { buildClientPortalOriginalPayload } from "@/features/portals/queries/client-media-plan-payload";

async function clientHasApproveRole(
  supabase: Awaited<ReturnType<typeof requireClientScope>>["supabase"],
  userId: string,
  clientId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("client_users")
    .select("access_role")
    .eq("profile_id", userId)
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as { access_role: string } | null)?.access_role === "approve";
}

export async function loadClientMediaPlan(
  campaignHeaderId: string
): Promise<ClientMediaPlanPayload | null> {
  const result = await safeOperationalQuery(
    "client-portal:loadMediaPlan",
    async () => {
      const { supabase, scope } = await requireClientScope("client_portal.read");
      const id = campaignHeaderId.trim();
      if (!id) return null;

      const { data: header, error: headerError } = await supabase
        .from("campaign_headers")
        .select("id, name, document_number, client_id, campaign_object_id")
        .eq("id", id)
        .maybeSingle();

      if (headerError) throw new Error(headerError.message);
      if (!header) return null;

      const typed = header as {
        id: string;
        name: string;
        document_number: string | null;
        client_id: string | null;
        campaign_object_id: string | null;
      };

      if (!typed.client_id || !scope.clientIds.includes(typed.client_id)) {
        return null;
      }

      const hasApproveRole = await clientHasApproveRole(
        supabase,
        scope.userId,
        typed.client_id
      );

      const campaignObjectId = typed.campaign_object_id?.trim() || null;
      if (!campaignObjectId) {
        return buildClientPortalOriginalPayload({
          campaignId: typed.id,
          campaignName: typed.name,
          documentNumber: typed.document_number,
          campaignObject: null,
          hasApproveRole,
        });
      }

      const { data: head, error: headError } = await supabase
        .from("campaign_objects")
        .select("id, conversation_id, current_version")
        .eq("id", campaignObjectId)
        .maybeSingle();

      if (headError) throw new Error(headError.message);

      const typedHead = head as {
        id: string;
        conversation_id: string | null;
        current_version: number;
      } | null;

      let campaignObject: CampaignObject | null = null;
      if (typedHead && typedHead.current_version > 0) {
        const version = await CampaignObjectPersistenceService.loadVersion(
          supabase,
          campaignObjectId,
          typedHead.current_version
        );
        campaignObject = version?.campaignObject ?? null;
      }
      if (!campaignObject && typedHead?.conversation_id) {
        campaignObject = await CampaignObjectPersistenceService.restoreForConversation(
          supabase,
          typedHead.conversation_id
        );
      }

      const payload = buildClientPortalOriginalPayload({
        campaignId: typed.id,
        campaignName: typed.name,
        documentNumber: typed.document_number,
        campaignObject,
        conversationId: typedHead?.conversation_id ?? null,
        hasApproveRole,
      });

      try {
        const hierarchy = await getCampaignAssignmentHierarchy(typed.id);
        const facts = performanceFactsFromAssignmentHierarchy(hierarchy);
        return {
          ...payload,
          original: annotateMediaPlanExecutionStatus(payload.original, facts),
        };
      } catch {
        return payload;
      }
    },
    null
  );

  return result.data;
}
