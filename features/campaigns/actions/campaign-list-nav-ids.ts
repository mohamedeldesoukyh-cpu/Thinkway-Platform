"use server";

import { requirePermission } from "@/lib/auth/permissions-server";
import {
  getCampaignListNavIds,
  getCampaignListNavOptions,
} from "@/lib/services/campaigns/campaign-service";
import type { CampaignNavOption } from "@/lib/services/campaigns/campaign-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function loadCampaignListNavIdsAction(input?: {
  search?: string;
}): Promise<{ ok: true; ids: string[] } | { ok: false; message: string }> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "campaigns.read");
  if ("error" in auth) return { ok: false, message: auth.error };

  try {
    const ids = await getCampaignListNavIds(supabase, {
      search: input?.search,
    });
    return { ok: true, ids };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to load campaign navigation.",
    };
  }
}

export async function loadCampaignListNavOptionsAction(input?: {
  search?: string;
}): Promise<
  { ok: true; options: CampaignNavOption[] } | { ok: false; message: string }
> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "campaigns.read");
  if ("error" in auth) return { ok: false, message: auth.error };

  try {
    const options = await getCampaignListNavOptions(supabase, {
      search: input?.search,
    });
    return { ok: true, options };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Failed to load campaign jump list.",
    };
  }
}
