"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  loadCreatorContentEvidence,
  type CreatorContentEvidenceByCreatorId,
} from "../services/creator-content-evidence";

/** Authenticated, read-only DTO action for the active Studio planning slate. */
export async function loadCreatorContentEvidenceAction(
  creatorIds: string[]
): Promise<CreatorContentEvidenceByCreatorId> {
  const ids = [...new Set(creatorIds.map((id) => id.trim()).filter(Boolean))].slice(0, 50);
  if (ids.length === 0) return {};
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};
  return loadCreatorContentEvidence(supabase, ids);
}
