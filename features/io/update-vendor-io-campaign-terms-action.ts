"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { vendorIoCampaignTermsPatch, vendorIoCampaignTermsSchema } from "@/lib/io/vendor-io-campaign-terms";

export async function updateVendorIoCampaignTermsAction(input: unknown): Promise<{ ok: boolean; message: string }> {
  const parsed = vendorIoCampaignTermsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the usage rights, payment terms, and country selection." };
  const supabase = await createSupabaseServerClient();
  const permission = await requirePermission(supabase, "vendor_ios.write");
  if ("error" in permission) return { ok: false, message: permission.error };

  const values = parsed.data;
  // Scope to the selected campaign IO and reject stale edits/superseded revisions.
  const { data, error } = await supabase.from("vendor_ios")
    .update(vendorIoCampaignTermsPatch(values, permission.userId) as never)
    .eq("id", values.id)
    .eq("campaign_header_id", values.campaign_header_id)
    .eq("is_superseded", false)
    .eq("updated_at", values.updated_at)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "This IO changed or is no longer editable. Refresh and try again." };

  revalidatePath(`/campaigns/${values.campaign_header_id}`);
  revalidatePath("/ios/vendor");
  revalidatePath(`/ios/vendor/${values.id}/preview`);
  return { ok: true, message: "Terms saved for this campaign IO. Preview and downloads use the updated terms." };
}
