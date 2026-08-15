"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import { CREATOR_ENRICHMENT_PERMISSION } from "@/lib/creator-enrichment/constants";
import {
  addCreatorByProfileUrl,
  addCreatorsByProfileUrls,
  type AddCreatorByProfileUrlResult,
  type AddCreatorsByProfileUrlsResult,
} from "@/lib/discovery/add-creator-by-profile-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function addCreatorByProfileUrlAction(
  profileUrl: string
): Promise<AddCreatorByProfileUrlResult> {
  const trimmed = profileUrl.trim();
  if (!trimmed) {
    return { ok: false, message: "Paste a creator profile link." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const result = await addCreatorByProfileUrl(supabase, {
    profileUrl: trimmed,
    actorId: auth.userId,
  });

  if (result.ok) {
    revalidatePath("/discovery");
    revalidatePath("/discovery/search");
    revalidatePath("/discovery/shortlists", "layout");
  }

  return result;
}

export async function addCreatorsByProfileUrlsAction(
  raw: string
): Promise<AddCreatorsByProfileUrlsResult | { ok: false; message: string }> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: "Paste one or more creator profile links." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const result = await addCreatorsByProfileUrls(supabase, {
    raw: trimmed,
    actorId: auth.userId,
  });

  if (result.added.length > 0) {
    revalidatePath("/discovery");
    revalidatePath("/discovery/search");
    revalidatePath("/discovery/shortlists", "layout");
  }

  return result;
}
