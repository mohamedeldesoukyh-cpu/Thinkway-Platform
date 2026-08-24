"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import { CREATOR_ENRICHMENT_PERMISSION } from "@/lib/creator-enrichment/constants";
import {
  getMergeCreatorsEligibility,
  mergeCreators,
  type MergeCreatorsEligibility,
  type MergeCreatorsResult,
} from "@/lib/discovery/merge-creators";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getMergeCreatorsEligibilityAction(input: {
  targetInfluencerId: string;
  sourceInfluencerId: string;
}): Promise<MergeCreatorsEligibility> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return {
      canMerge: false,
      message: auth.error,
      platformConflicts: [],
      platformsToMove: [],
    };
  }

  return getMergeCreatorsEligibility(supabase, input);
}

export async function mergeCreatorsAction(input: {
  targetInfluencerId: string;
  sourceInfluencerId: string;
  targetUnifiedId: string;
}): Promise<MergeCreatorsResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
    if ("error" in auth) {
      return { ok: false, message: auth.error };
    }

    const result = await mergeCreators(createSupabaseAdminClient(), {
      ...input,
      actorId: auth.userId,
    });

    if (result.ok) {
      // One layout invalidation per surface — multiple revalidatePath calls stack
      // client refreshes and make shortlist pages look like they are "re-rendering"
      // with no useful UI change.
      revalidatePath("/discovery/shortlists", "layout");
      revalidatePath("/vendors", "layout");
    }

    return result;
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not combine creators. Please try again.",
    };
  }
}
