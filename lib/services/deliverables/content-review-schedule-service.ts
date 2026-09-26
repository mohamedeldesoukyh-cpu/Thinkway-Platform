import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { mergeContentReviewDates, readContentReviewDates, type ContentReviewDates } from "./content-review-schedule";
type Supabase = SupabaseClient<Database>;

export type ReviewScheduleUnit = { campaignHeaderId: string; assignmentDeliverableId: string; assignmentPostScheduleId: string | null; sequenceNumber: number | null };

export async function readScheduleUnit(supabase: Supabase, input: ReviewScheduleUnit) {
  const { data, error } = await supabase.from("assignment_deliverables")
    .select("id, metadata, quantity").eq("id", input.assignmentDeliverableId)
    .eq("campaign_header_id", input.campaignHeaderId).maybeSingle();
  if (error || !data) throw new Error("This deliverable is unavailable.");
  const sequence = data.quantity > 1 ? input.sequenceNumber : null;
  if (data.quantity > 1 && (!sequence || !Number.isInteger(sequence) || sequence < 1 || sequence > data.quantity)) {
    throw new Error("Select an individual content slot to set its review dates.");
  }
  if (data.quantity > 1 && !input.assignmentPostScheduleId) throw new Error("Create individual post slots in Assignments before setting review dates.");
  if (input.assignmentPostScheduleId) {
    const { data: post, error: postError } = await supabase.from("assignment_post_schedule")
      .select("id, sequence_number").eq("id", input.assignmentPostScheduleId)
      .eq("assignment_deliverable_id", data.id).maybeSingle();
    if (postError || !post || (sequence !== null && post.sequence_number !== sequence)) throw new Error("The selected content slot has changed. Reload and try again.");
  }
  return { ...data, sequence };
}

export async function persistContentReviewDates(supabase: Supabase, userId: string, input: ReviewScheduleUnit & { dates: ContentReviewDates; previous: ContentReviewDates }) {
    const row = await readScheduleUnit(supabase, input);
    const current = readContentReviewDates(row.metadata, row.sequence);
    if (current.script !== input.previous?.script || current.draft !== input.previous?.draft) {
      return { ok: false as const, message: "Someone changed these dates. Reload the slot before saving." };
    }
    const dates = { script: input.dates.script, draft: input.dates.draft };
    const metadata = mergeContentReviewDates(row.metadata ?? {}, row.sequence, dates, userId);
    let query = supabase.from("assignment_deliverables").update({ metadata })
      .eq("id", row.id).eq("campaign_header_id", input.campaignHeaderId);
    query = row.metadata === null ? query.is("metadata", null) : query.filter("metadata", "eq", JSON.stringify(row.metadata));
    const { data, error } = await query.select("id").maybeSingle();
    if (error) return { ok: false as const, message: "Could not save review dates. Please try again." };
    if (!data) return { ok: false as const, message: "This deliverable changed while saving. Reload the slot and try again." };
    return { ok: true as const, data: dates };
}
