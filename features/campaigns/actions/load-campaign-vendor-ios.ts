"use server";

import { requirePermission } from "@/lib/auth/permissions-server";
import { getCampaignVendorIos } from "@/lib/io/campaign-io-queries";
import type { VendorIoRow } from "@/lib/domains/io/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Client reload for Campaign Workspace Vendor IO tab after generate/revise/ungenerate.
 * SSR `workspace.vendor_ios` can lag when router.refresh() does not remount with new props.
 */
export async function loadCampaignVendorIosAction(
  campaignId: string
): Promise<{ ok: true; rows: VendorIoRow[] } | { ok: false; message: string }> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "campaigns.read");
  if ("error" in auth) return { ok: false, message: auth.error };

  try {
    const rows = await getCampaignVendorIos(campaignId);
    return { ok: true, rows };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to load Vendor IOs.",
    };
  }
}
