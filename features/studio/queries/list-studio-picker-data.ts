import { getCampaignsList } from "@/features/campaigns/queries";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { listStudioCampaignHistory } from "./list-studio-campaign-history";
import type { StudioCampaignHistoryItem } from "../services/studio-campaign-history";

export type StudioPickerCampaign = {
  id: string;
  name: string;
  documentNumber: string;
  brandName: string | null;
  clientName: string | null;
  status: string;
};

export type StudioPickerData = {
  history: StudioCampaignHistoryItem[];
  campaigns: StudioPickerCampaign[];
};

/** Campaign History + CRM campaigns for the Studio home picker. */
export async function listStudioPickerData(): Promise<StudioPickerData | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.read");
  if ("error" in auth) return { error: auth.error };

  const [history, campaignList] = await Promise.all([
    listStudioCampaignHistory(),
    getCampaignsList({ page: 1, search: "" }),
  ]);

  if (history && typeof history === "object" && "error" in history) {
    return { error: history.error };
  }

  return {
    history,
    campaigns: campaignList.campaigns.map((row) => ({
      id: row.id,
      name: row.name,
      documentNumber: row.document_number,
      brandName: row.brand?.name ?? null,
      clientName: row.client?.name ?? null,
      status: row.status,
    })),
  };
}
