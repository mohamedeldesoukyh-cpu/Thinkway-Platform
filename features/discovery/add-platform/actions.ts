"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import { CREATOR_ENRICHMENT_PERMISSION } from "@/lib/creator-enrichment/constants";
import {
  addPlatformToCreator,
  type AddPlatformToCreatorResult,
} from "@/lib/discovery/add-platform-to-creator";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function addPlatformToCreatorAction(input: {
  profileUrl: string;
  unifiedId: string;
  influencerId?: string | null;
  discoveredProfileId?: string | null;
}): Promise<AddPlatformToCreatorResult> {
  const trimmed = input.profileUrl.trim();
  if (!trimmed) {
    return { ok: false, message: "Paste a profile link." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const result = await addPlatformToCreator(supabase, {
    profileUrl: trimmed,
    actorId: auth.userId,
    influencerId: input.influencerId,
    discoveredProfileId: input.discoveredProfileId,
    unifiedId: input.unifiedId,
  });

  if (result.ok) {
    // Client already patches the open creator row; one light revalidation is enough.
    revalidatePath("/discovery/search");
  }

  return result;
}
