import type { SupabaseClient } from "@supabase/supabase-js";

/** Record actual delivery for the whole creator package without touching invoice or vendor commercials. */
export async function recordAdLiveDate(supabase: SupabaseClient, input: {
  campaignId: string; scheduleId: string; liveDate: string; actorId: string;
}, today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" })) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.liveDate) ||
      !Number.isFinite(Date.parse(input.liveDate)) ||
      new Date(input.liveDate).toISOString().slice(0, 10) !== input.liveDate || input.liveDate > today) {
    return { ok: false, message: "Choose a valid actual live date today or earlier." };
  }
  const { error } = await supabase.rpc("record_assignment_went_live", {
    p_campaign: input.campaignId, p_schedule: input.scheduleId, p_date: input.liveDate,
  });
  return error ? { ok: false, message: error.message } : { ok: true, message: "Creator package marked Went live. Revenue and matching cost are recognized." };
}
