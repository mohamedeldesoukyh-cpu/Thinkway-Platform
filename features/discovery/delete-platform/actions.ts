"use server";

import { SHORTLIST_PERMISSIONS } from "@/features/discovery/shortlists/constants";
import { requirePermission } from "@/lib/auth/permissions-server";
import {
  deletePlatformFromCreator,
  type DeletePlatformFromCreatorResult,
} from "@/lib/discovery/delete-platform-from-creator";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function deletePlatformFromCreatorAction(input: {
  influencerId: string;
  platformAccountId: string;
  unifiedId: string;
}): Promise<DeletePlatformFromCreatorResult> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, SHORTLIST_PERMISSIONS.write);
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  return deletePlatformFromCreator(supabase, input);
}
