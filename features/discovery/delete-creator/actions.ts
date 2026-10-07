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

export async function processCreatorDeletionBatch(ids: string[], confirm: boolean = false) {
  if (!Array.isArray(ids) || ids.length > 10 || ids.some(id => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) throw new Error("Choose up to 10 valid creators per batch.");
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, SHORTLIST_PERMISSIONS.write);
  if ("error" in auth) throw new Error(auth.error);
  const results = [];
  for (const id of new Set(ids)) {
    try {
      if (confirm === true) {
        const result = await deleteDiscoveryCreator(supabase, id);
        results.push({ id, canDelete: false, deleted: result.ok, message: result.message, links: result.ok ? [] : result.links ?? [] });
      } else {
        results.push({ id, ...await getDiscoveryCreatorDeleteEligibility(supabase, id), deleted: false });
      }
    } catch (error) {
      results.push({ id, canDelete: false, deleted: false, message: error instanceof Error ? error.message : "Could not check creator. Retry.", links: [] });
    }
  }
  if (confirm === true) {
    revalidatePath("/discovery/search");
    revalidatePath("/discovery/shortlists", "layout");
    revalidatePath("/vendors", "layout");
  }
  return results;
}

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
