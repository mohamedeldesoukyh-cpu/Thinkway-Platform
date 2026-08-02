"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { formDataDefersRevalidate } from "@/components/workspace/bulk-operations/bulk-defer-revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  id: z.string().uuid(),
  campaign_header_id: z.string().uuid(),
  special_payment_terms: z.string().trim().max(500).optional().or(z.literal("")),
});

export type UpdateVendorIoSpecialPaymentTermsState = {
  ok: boolean;
  message?: string;
};

export async function updateVendorIoSpecialPaymentTermsAction(
  _prev: UpdateVendorIoSpecialPaymentTermsState,
  formData: FormData
): Promise<UpdateVendorIoSpecialPaymentTermsState> {
  const parsed = schema.safeParse({
    id: String(formData.get("id") ?? ""),
    campaign_header_id: String(formData.get("campaign_header_id") ?? ""),
    special_payment_terms: String(formData.get("special_payment_terms") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, message: "Invalid payment terms." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Unauthorized" };
  }

  const value = parsed.data.special_payment_terms?.trim() || null;

  const { error } = await supabase
    .from("vendor_ios")
    .update({
      special_payment_terms: value,
      updated_by: user.id,
    } as never)
    .eq("id", parsed.data.id)
    .eq("is_superseded", false);

  if (error) {
    return { ok: false, message: error.message };
  }

  if (!formDataDefersRevalidate(formData)) {
    revalidatePath(`/campaigns/${parsed.data.campaign_header_id}`);
    revalidatePath("/ios/vendor");
    revalidatePath(`/ios/vendor/${parsed.data.id}/preview`);
  }

  return {
    ok: true,
    message: value
      ? "Special payment terms saved for this Vendor IO."
      : "Special payment terms cleared — IO will use vendor bank details.",
  };
}
