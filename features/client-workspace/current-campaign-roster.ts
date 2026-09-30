import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import { hydrateSnapshotCreatorsFromCrm } from "./creator-snapshot";
import { projectCreatorsFromSnapshot } from "./snapshot";
import type { ClientReviewSourceSnapshot, ClientReviewSourceSnapshotCreator } from "./types";

export type CurrentCampaignLine = {
  id: string;
  status: string;
  name: string;
  description: string | null;
  platform: string | null;
  revenue: number;
  revenue_base: number | null;
  currency_code: string;
  influencerId: string;
  displayName: string;
};

/** Display projection only. Never write campaign changes into an approved proposal. */
export function currentCampaignCreators(
  previous: ClientReviewSourceSnapshotCreator[],
  lines: CurrentCampaignLine[],
  currency: string,
  rateToEgp: number,
): ClientReviewSourceSnapshotCreator[] {
  const creators = new Map<string, ClientReviewSourceSnapshotCreator>();
  for (const line of lines) {
    if (line.status === "cancelled" || !line.influencerId) continue;
    const existing = creators.get(line.influencerId);
    const original = previous.find(c => c.influencerId === line.influencerId || c.creatorId === `inf:${line.influencerId}`);
    const amount = line.currency_code === currency
      ? Number(line.revenue)
      : line.revenue_base == null ? undefined : Number(line.revenue_base) / rateToEgp;
    const description = [existing?.serviceDescription, line.description].filter(Boolean).join(" · ");
    creators.set(line.influencerId, {
      ...original,
      creatorId: original?.creatorId ?? `inf:${line.influencerId}`,
      influencerId: line.influencerId,
      displayName: original?.displayName ?? line.displayName,
      platform: original?.platform ?? line.platform ?? undefined,
      serviceDescription: description,
      deliverables: description,
      deliverableItems: undefined,
      investmentAmount: amount == null || (existing && existing.investmentAmount == null)
        ? undefined : (existing?.investmentAmount ?? 0) + amount,
      investmentCurrency: currency,
      originalInvestmentAmount: undefined,
      originalInvestmentCurrency: undefined,
      agencyFeeAmount: 0,
      usageRightsAmount: 0,
      quotationEligible: amount != null,
      thinkwayStatus: undefined,
    });
  }
  return [...creators.values()];
}

export async function loadCurrentCampaignRoster(
  db: SupabaseClient,
  campaignId: string,
  snapshot: ClientReviewSourceSnapshot,
) {
  const [linesResult, membersResult] = await Promise.all([
    db.from("campaign_lines")
      .select("id,status,name,description,platform,revenue,revenue_base,currency_code")
      .eq("campaign_header_id", campaignId).order("sort_order").order("created_at"),
    db.from("campaign_influencers")
      .select("campaign_line_id,influencer_id,influencer:influencers(display_name)")
      .eq("campaign_header_id", campaignId),
  ]);
  if (linesResult.error || membersResult.error) throw new Error("Current campaign roster unavailable");
  const members = membersResult.data ?? [];
  const lines: CurrentCampaignLine[] = (linesResult.data ?? []).map(line => {
    const member = members.find(row => row.campaign_line_id === line.id);
    const profile = Array.isArray(member?.influencer) ? member.influencer[0] : member?.influencer;
    return { ...line, influencerId: member?.influencer_id ?? "", displayName: profile?.display_name ?? line.name };
  });
  const currency = snapshot.commercial.currency;
  const rate = lines.some(line => line.status !== "cancelled" && line.currency_code !== currency)
    ? await resolveRateToEgp(db, currency) : 1;
  const creators = currentCampaignCreators(snapshot.creators, lines, currency, rate);
  const hydrated = await hydrateSnapshotCreatorsFromCrm(db, { ...snapshot, creators });
  return projectCreatorsFromSnapshot(hydrated,
    Object.fromEntries(creators.map(c => [c.creatorId, "accepted" as const])),
    { includeCommercial: snapshot.source !== "studio" });
}
