"use server";

import { revalidatePath } from "next/cache";

import { SHORTLIST_PERMISSIONS } from "@/features/discovery/shortlists/constants";
import { requirePermission } from "@/lib/auth/permissions-server";
import {
  deleteDiscoveryCreator,
  getDiscoveryCreatorDeleteEligibility,
  type DeleteDiscoveryCreatorResult,
} from "@/lib/discovery/delete-discovery-creator";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getDiscoveryCreatorDeleteEligibilityAction(influencerId: string) {
  const trimmed = influencerId?.trim();
  if (!trimmed) {
    return { canDelete: false, message: "Creator id is required.", links: [] };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, SHORTLIST_PERMISSIONS.write);
  if ("error" in auth) {
    return { canDelete: false, message: auth.error, links: [] };
  }

  return getDiscoveryCreatorDeleteEligibility(supabase, trimmed);
}

export async function deleteDiscoveryCreatorAction(
  influencerId: string
): Promise<DeleteDiscoveryCreatorResult> {
  const trimmed = influencerId?.trim();
  if (!trimmed) {
    return { ok: false, message: "Creator id is required." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, SHORTLIST_PERMISSIONS.write);
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const result = await deleteDiscoveryCreator(supabase, trimmed);

  if (result.ok) {
    revalidatePath("/discovery");
    revalidatePath("/discovery/search");
    revalidatePath("/discovery/shortlists", "layout");
    revalidatePath("/vendors", "layout");
  }

  return result;
}
