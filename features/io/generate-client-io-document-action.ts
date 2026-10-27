"use server";

import { revalidatePath } from "next/cache";

import { generateClientIoDocument } from "@/lib/io/client-io-document-service";
import { syncCampaignHeaderStatus } from "@/lib/campaigns/sync-campaign-header-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isClientIoDocumentLayout } from "@/lib/io/client-io-document-layout";

export type GenerateClientIoDocumentState = {
  ok: boolean;
  message?: string;
};

export async function generateClientIoDocumentAction(
  _prev: GenerateClientIoDocumentState,
  formData: FormData
): Promise<GenerateClientIoDocumentState> {
  const id = String(formData.get("id") ?? "");
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "");
  const layout = String(formData.get("layout") ?? "detailed");
  if (!isClientIoDocumentLayout(layout)) return { ok: false, message: "Choose a valid Client IO format." };

  if (!id || !campaignHeaderId) {
    return { ok: false, message: "Missing Client IO context." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Unauthorized" };
  }

  try {
    const result = await generateClientIoDocument(supabase, id, user.id, layout);
    await syncCampaignHeaderStatus(supabase, campaignHeaderId);
    revalidatePath(`/campaigns/${campaignHeaderId}`);
    revalidatePath("/ios/client");
    revalidatePath(`/ios/client/${id}/preview`);
    return {
      ok: true,
      message: `Client IO document generated (${result.documentNumber}).`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Document generation failed.",
    };
  }
}
