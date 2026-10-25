"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions-server";
import { validPostingDate } from "@/lib/campaigns/planned-posting-date";

const schema = z.object({ campaignId: z.string().uuid(), deliverableId: z.string().uuid(), plannedDate: z.string().nullable() });
export async function savePlannedPostingDate(input: z.infer<typeof schema>) {
  const parsed = schema.safeParse(input);
  if (!parsed.success || (parsed.data.plannedDate !== null && !validPostingDate(parsed.data.plannedDate))) return { ok: false, message: "Enter a valid planned date." };
  const { campaignId, deliverableId, plannedDate } = parsed.data;
  try {
    const supabase = await createSupabaseServerClient();
    const auth = await requirePermission(supabase, "campaigns.write");
    if ("error" in auth) return { ok: false, message: auth.error };
    const { data: row, error } = await supabase.from("assignment_deliverables").select("id, campaign_line_id, metadata").eq("id", deliverableId).maybeSingle();
    if (error || !row) return { ok: false, message: error?.message ?? "Deliverable not found." };
    const { data: line } = await supabase.from("campaign_lines").select("id").eq("id", row.campaign_line_id).eq("campaign_header_id", campaignId).maybeSingle();
    if (!line) return { ok: false, message: "Deliverable does not belong to this campaign." };
    // Only planning metadata is written: no actual date, live status or recognition fields.
    let update = supabase.from("assignment_deliverables").update({ metadata: { ...(row.metadata ?? {}), planned_posting_date: plannedDate } }).eq("id", deliverableId);
    update = row.metadata == null ? update.is("metadata", null) : update.filter("metadata", "eq", JSON.stringify(row.metadata));
    const { data: saved, error: saveError } = await update.select("id").maybeSingle();
    if (saveError || !saved) return { ok: false, message: saveError?.message ?? "This deliverable changed. Refresh and try again." };
    revalidatePath("/campaigns/[id]", "page");
    return { ok: true, message: "Planned date saved. Revenue recognition is unchanged." };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Could not save planned date." }; }
}
