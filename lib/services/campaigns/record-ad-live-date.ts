import type { SupabaseClient } from "@supabase/supabase-js";
import { canEditLiveAdDate } from "@/lib/campaigns/live-ad-date";
import { withManualLiveDateSource } from "@/lib/campaigns/sync-live-date-from-publication";

/** Record actual delivery for one ad without touching invoice or vendor commercials. */
export async function recordAdLiveDate(supabase: SupabaseClient, input: {
  campaignId: string; scheduleId: string; liveDate: string; actorId: string;
}, today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" })) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.liveDate) ||
      !Number.isFinite(Date.parse(input.liveDate)) ||
      new Date(input.liveDate).toISOString().slice(0, 10) !== input.liveDate || input.liveDate > today) {
    return { ok: false, message: "Choose a valid actual live date today or earlier." };
  }
  const { data: post, error } = await supabase.from("assignment_post_schedule")
    .select("id, campaign_line_id, assignment_deliverable_id, live_date, locked_at, status, metadata")
    .eq("id", input.scheduleId).maybeSingle();
  if (error || !post) return { ok: false, message: error?.message ?? "Ad not found." };
  const { data: line, error: lineError } = await supabase.from("campaign_lines")
    .select("id").eq("id", post.campaign_line_id).eq("campaign_header_id", input.campaignId).maybeSingle();
  if (lineError || !line) return { ok: false, message: "Ad does not belong to this campaign or you do not have access." };
  const { data: deliverable, error: deliverableError } = await supabase.from("assignment_deliverables")
    .select("locked_at").eq("id", post.assignment_deliverable_id).maybeSingle();
  if (deliverableError || !deliverable) return { ok: false, message: deliverableError?.message ?? "Deliverable not found." };
  if (post.live_date !== input.liveDate && !canEditLiveAdDate(post.live_date, post.locked_at ?? deliverable.locked_at)) {
    return { ok: false, message: "This recorded date is locked. You can confirm the existing date as live, or ask Finance to reopen it for correction." };
  }
  const metadata = withManualLiveDateSource(post.metadata ?? null);
  const { error: saveError } = await supabase.from("assignment_post_schedule").update({
    live_date: input.liveDate,
    status: "posted",
    metadata: { ...metadata, manual_live_confirmation: {
      confirmed_by: input.actorId, confirmed_at: new Date().toISOString(),
      previous_date: post.live_date, previous_status: post.status,
    } },
  }).eq("id", input.scheduleId).eq("campaign_line_id", post.campaign_line_id);
  return saveError ? { ok: false, message: saveError.message } : { ok: true, message: "Ad confirmed live. Revenue and matching cost will use this date." };
}
