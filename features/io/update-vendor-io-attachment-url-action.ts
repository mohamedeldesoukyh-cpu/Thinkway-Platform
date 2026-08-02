"use server";

import { revalidatePath } from "next/cache";

import { formDataDefersRevalidate } from "@/components/workspace/bulk-operations/bulk-defer-revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { httpsUrlSchema } from "@/lib/validation/schemas";

type ActionState = {
  ok: boolean;
  message?: string;
};

export async function updateVendorIoAttachmentUrlAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "").trim();
  const rawUrl = String(formData.get("attachment_url") ?? "").trim();

  if (!id || !campaignHeaderId) {
    return { ok: false, message: "Missing Vendor IO context." };
  }

  let attachmentUrl: string | null = null;
  if (rawUrl) {
    const parsed = httpsUrlSchema.safeParse(rawUrl);
    if (!parsed.success) {
      return {
        ok: false,
        message: "Attachment must be a valid https link (Google Drive, Dropbox, or signed PDF URL).",
      };
    }
    attachmentUrl = parsed.data;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, message: authError?.message ?? "Unauthorized" };
  }

  const { data: existing, error: loadError } = await supabase
    .from("vendor_ios")
    .select("id, is_superseded")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, message: loadError?.message ?? "Vendor IO not found." };
  }

  if ((existing as { is_superseded?: boolean }).is_superseded) {
    return {
      ok: false,
      message: "This Vendor IO revision is superseded. Edit the active revision only.",
    };
  }

  const { error: updateError } = await supabase
    .from("vendor_ios")
    .update({
      attachment_url: attachmentUrl,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id)
    .eq("is_superseded", false);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  if (!formDataDefersRevalidate(formData)) {
    revalidatePath("/ios/vendor");
    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${campaignHeaderId}`);
  }
  return {
    ok: true,
    message: attachmentUrl
      ? "Signed document link saved."
      : "Signed document link cleared.",
  };
}
