"use server";

import { revalidatePath } from "next/cache";

import { generateClientIoDocument } from "@/lib/io/client-io-document-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    const result = await generateClientIoDocument(supabase, id, user.id);
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
