"use server";

import { revalidatePath } from "next/cache";

import { generateVendorIoDocument } from "@/lib/io/vendor-io-document-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RegenerateVendorIoDocumentState = {
  ok: boolean;
  message?: string;
};

export async function regenerateVendorIoDocumentAction(
  _prev: RegenerateVendorIoDocumentState,
  formData: FormData
): Promise<RegenerateVendorIoDocumentState> {
  const id = String(formData.get("id") ?? "");
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "");

  if (!id || !campaignHeaderId) {
    return { ok: false, message: "Missing Vendor IO context." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Unauthorized" };
  }

  try {
    const result = await generateVendorIoDocument(supabase, id, user.id);
    revalidatePath(`/campaigns/${campaignHeaderId}`);
    revalidatePath("/ios/vendor");
    revalidatePath(`/ios/vendor/${id}/preview`);
    return {
      ok: true,
      message: `Vendor IO document regenerated (${result.documentNumber}).`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Document regeneration failed.",
    };
  }
}
