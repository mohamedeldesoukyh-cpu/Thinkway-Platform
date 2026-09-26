import { listAttachedCampaignScriptPresence } from "@/lib/campaign-script/load-master";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import { requireCurrentCampaignContentAccess } from "./content-decisions";
import { loadClientCampaignExecution } from "./load-campaign-execution";
import { loadClientCampaignContent } from "./load-campaign-content";
import { scheduleRows, type ScheduleData } from "./review-schedule-model";

export async function loadReviewSchedule(
  token: string,
  requestedId: string,
): Promise<ScheduleData | null> {
  const access = await requireCurrentCampaignContentAccess(token);
  if (
    !access.ok ||
    (requestedId !== "current" && requestedId !== access.campaignHeaderId)
  )
    return null;
  const db = tryCreateServiceRoleClient().client;
  if (!db) throw new Error("Schedule unavailable");
  const [execution, content, scripts] = await Promise.all([
    loadClientCampaignExecution(db, access.campaignHeaderId, true),
    loadClientCampaignContent(db, access.campaignHeaderId, true),
    listAttachedCampaignScriptPresence(db, access.campaignHeaderId),
  ]);
  return {
    campaignId: access.campaignHeaderId,
    name: access.review.campaignName || "Campaign",
    client_name: access.review.clientLabel || "",
    start_date: execution.startDate,
    end_date: execution.endDate,
    rows: scheduleRows(execution.posts, content.items, new Set(scripts.keys())),
  };
}
