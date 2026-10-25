import { loadIdentityLogoForClientId } from "./identity-logo";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  return loadCampaignReviewSchedule(db, access.campaignHeaderId);
}

/** Both exports read current campaign identity, never a frozen quotation/review label. */
export async function loadCampaignReviewSchedule(db: SupabaseClient, campaignId: string): Promise<ScheduleData | null> {
  const { data: header, error } = await db.from("campaign_headers").select("id, name, client_id, client:clients(name)").eq("id", campaignId).maybeSingle();
  if (error) throw new Error("Campaign unavailable");
  if (!header) return null;
  const [execution, content, scripts, identityLogo] = await Promise.all([
    loadClientCampaignExecution(db, campaignId, true),
    loadClientCampaignContent(db, campaignId, true),
    listAttachedCampaignScriptPresence(db, campaignId),
    loadIdentityLogoForClientId(db, header.client_id),
  ]);
  const client = Array.isArray(header.client) ? header.client[0] : header.client;
  return {
    identityLogo, campaignId, name: header.name || "Campaign", client_name: client?.name || "",
    start_date: execution.startDate, end_date: execution.endDate,
    rows: scheduleRows(execution.posts, content.items, new Set(scripts.keys())),
  };
}
