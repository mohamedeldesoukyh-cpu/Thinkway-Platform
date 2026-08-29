import { applyCampaignScriptToLinesAction } from "@/features/campaigns/actions/campaign-script-actions";
import { classifyApplyCampaignScriptLineItems } from "@/lib/campaign-script";

export async function mutateApplyCampaignScriptToLine(input: {
  campaignId: string;
  lineId: string;
}): Promise<{ ok: boolean; skipped?: boolean; message?: string; id?: string }> {
  const result = await applyCampaignScriptToLinesAction({
    campaignId: input.campaignId,
    lineIds: [input.lineId],
    deferRevalidate: true,
  });
  if (!result.ok) {
    return { ok: false, id: input.lineId, message: result.message };
  }
  const classified = classifyApplyCampaignScriptLineItems(result.data.items);
  return {
    ok: true,
    id: input.lineId,
    skipped: classified.skipped || undefined,
    message: classified.message,
  };
}
