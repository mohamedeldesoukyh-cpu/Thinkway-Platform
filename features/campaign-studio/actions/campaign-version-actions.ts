"use server";

import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CampaignVersionRow = {
  version: number;
  createdAt: string;
};

export type ListCampaignVersionsResult =
  | { ok: true; versions: CampaignVersionRow[] }
  | { ok: false; message: string };

/** Read-only version list for the Campaign Studio history panel. */
export async function listCampaignObjectVersionsAction(input: {
  campaignObjectId: string;
}): Promise<ListCampaignVersionsResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const auth = await requirePermission(supabase, "ai.read");
    if ("error" in auth) return { ok: false, message: auth.error };

    const versions = await CampaignObjectPersistenceService.listVersions(
      supabase,
      input.campaignObjectId
    );
    return {
      ok: true,
      versions: versions.map((v) => ({ version: v.version, createdAt: v.createdAt })),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not load version history.",
    };
  }
}
