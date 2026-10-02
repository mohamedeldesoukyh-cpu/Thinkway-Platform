"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  campaignId: z.string().uuid(),
  lineId: z.string().uuid(),
  reason: z.string().trim().min(3).max(2000),
});

export async function removeCampaignAssignmentAction(input: z.infer<typeof inputSchema>) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose an assignment and enter a removal reason." };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const { error } = await supabase.rpc("remove_campaign_assignment" as never, {
    p_campaign_id: parsed.data.campaignId,
    p_line_id: parsed.data.lineId,
    p_reason: parsed.data.reason,
  } as never);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/campaigns/${parsed.data.campaignId}`);
  revalidatePath("/campaigns");
  revalidatePath("/io");
  return { ok: true, message: "Assignment removed. Add the new creator, then open Client IO and create an amendment for approval. Previous documents are preserved." };
}
