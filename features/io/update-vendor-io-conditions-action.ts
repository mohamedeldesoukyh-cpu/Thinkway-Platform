"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serializeTermsText } from "@/lib/io/client-io-terms";

const schema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  updatedAt: z.string().datetime({ offset: true }),
  terms: z.array(z.object({
    title: z.string().trim().min(1).max(1000),
    body: z.string().trim().min(1).max(20000),
  })).min(1).max(100).nullable(),
});

export async function updateVendorIoConditionsAction(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Each term needs a title and description." };
  const supabase = await createSupabaseServerClient();
  const permission = await requirePermission(supabase, "vendor_ios.write");
  if ("error" in permission) return { ok: false, message: permission.error };
  const { id, campaignId, updatedAt, terms } = parsed.data;
  const { data, error } = await supabase.from("vendor_ios")
    .update({ terms_text: terms === null ? null : serializeTermsText(terms), updated_by: permission.userId } as never)
    .eq("id", id)
    .eq("campaign_header_id", campaignId)
    .eq("is_superseded", false)
    .eq("updated_at", updatedAt)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "This IO changed or is superseded. Refresh before editing again." };
  revalidatePath("/campaigns", "layout");
  revalidatePath("/ios/vendor");
  revalidatePath(`/ios/vendor/${id}`);
  revalidatePath(`/ios/vendor/${id}/preview`);
  return { ok: true, message: "Terms & conditions saved for this IO." };
}
