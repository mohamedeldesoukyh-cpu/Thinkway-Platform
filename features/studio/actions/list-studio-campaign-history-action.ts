"use server";

import { listStudioCampaignHistory } from "../queries/list-studio-campaign-history";
import type { StudioCampaignHistoryItem } from "../services/studio-campaign-history";

export async function listStudioCampaignHistoryAction(): Promise<
  { ok: true; items: StudioCampaignHistoryItem[] } | { ok: false; message: string }
> {
  const result = await listStudioCampaignHistory();
  if (result && typeof result === "object" && "error" in result) {
    return { ok: false, message: result.error };
  }
  return { ok: true, items: result };
}
