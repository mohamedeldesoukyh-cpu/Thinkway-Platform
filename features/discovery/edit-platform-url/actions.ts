"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import { CREATOR_ENRICHMENT_PERMISSION } from "@/lib/creator-enrichment/constants";
import {
  updatePlatformProfileUrl,
  type UpdatePlatformProfileUrlResult,
} from "@/lib/discovery/update-platform-profile-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updatePlatformProfileUrlAction(input: {
  profileUrl: string;
  unifiedId: string;
  influencerId: string;
  platformAccountId: string;
}): Promise<UpdatePlatformProfileUrlResult> {
  const trimmed = input.profileUrl.trim();
  if (!trimmed) {
    return { ok: false, message: "Paste a profile link." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const result = await updatePlatformProfileUrl(supabase, {
    profileUrl: trimmed,
    actorId: auth.userId,
    influencerId: input.influencerId,
    platformAccountId: input.platformAccountId,
    unifiedId: input.unifiedId,
  });

  if (result.ok) {
    revalidatePath("/discovery");
    revalidatePath("/discovery/search");
    revalidatePath("/discovery/shortlists", "layout");
    revalidatePath("/discovery/quotations", "layout");
    revalidatePath("/vendors");
  }

  return result;
}
