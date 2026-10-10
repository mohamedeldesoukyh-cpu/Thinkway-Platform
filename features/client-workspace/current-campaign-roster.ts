import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import { creatorFxAmount } from "@/lib/commercial/creator-fx";
import { requireReportingRate, resolveLineRevenueCurrency, type CampaignLineCommercialFxInput } from "@/lib/campaigns/campaign-display-financials";
import { resolveClientTaxableBase } from "@/lib/assignments/client-billing-commercial";
import { hydrateSnapshotCreatorsFromUnified } from "./creator-snapshot";
import { projectCreatorsFromSnapshot } from "./snapshot";
import type { ClientReviewRecord, ClientReviewSourceSnapshot, ClientReviewSourceSnapshotCreator } from "./types";
import { hydrateReviewCampaigns } from "./resolve-review-campaign";

export type CurrentCampaignLine = CampaignLineCommercialFxInput & {
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
  rates: ReadonlyMap<string, number>,
): ClientReviewSourceSnapshotCreator[] {
  currency = currency.trim().toUpperCase();
  const targetRate = requireReportingRate(rates, currency);
  const creators = new Map<string, ClientReviewSourceSnapshotCreator>();
  for (const line of lines) {
    if (line.status === "cancelled" || !line.influencerId) continue;
    const existing = creators.get(line.influencerId);
    const original = previous.find(c => c.influencerId === line.influencerId || c.creatorId === `inf:${line.influencerId}`);
    // Legacy revenue_base is revenue / fx_rate, not an EGP snapshot.
    // Match the campaign financials' commercial masters and negotiated FX.
    const sourceCurrency = resolveLineRevenueCurrency(line, currency);
    const conversion = { from: sourceCurrency, to: currency,
      sourceRateToEgp: requireReportingRate(rates, sourceCurrency), targetRateToEgp: targetRate,
      override: line.revenue_fx_override };
    const revenue = Number(line.revenue_before_vat ?? line.revenue ?? 0);
    const usage = Number(line.usage_rights_amount ?? 0);
    const billable = resolveClientTaxableBase({ revenueBeforeVat: revenue, usageRightsAmount: usage,
      agencyFeeAmount: line.agency_fee_amount, agencyFeePercent: line.agency_fee_percent ?? 0 });
    const amount = creatorFxAmount(revenue, conversion);
    const usageAmount = creatorFxAmount(usage, conversion);
    const feeAmount = creatorFxAmount(billable, conversion) - amount - usageAmount;
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
      agencyFeeAmount: (existing?.agencyFeeAmount ?? 0) + feeAmount,
      usageRightsAmount: (existing?.usageRightsAmount ?? 0) + usageAmount,
      quotationEligible: amount != null,
      thinkwayStatus: undefined,
    });
  }
  return [...creators.values()];
}

export async function loadCurrentCampaignSnapshot(
  db: SupabaseClient,
  campaignId: string,
  snapshot: ClientReviewSourceSnapshot,
) {
  const [linesResult, membersResult] = await Promise.all([
    db.from("campaign_lines")
      .select("id,status,name,description,platform,revenue,revenue_base,currency_code,revenue_before_vat,usage_rights_amount,agency_fee_amount,agency_fee_percent,revenue_fx_override")
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
  const currencies = new Set([currency.trim().toUpperCase(), ...lines
    .filter(line => line.status !== "cancelled" && line.influencerId)
    .map(line => resolveLineRevenueCurrency(line, currency))]);
  const rates = new Map(await Promise.all([...currencies].map(async code =>
    [code, await resolveRateToEgp(db, code)] as const)));
  const creators = currentCampaignCreators(snapshot.creators, lines, currency, rates);
  return hydrateSnapshotCreatorsFromUnified(db, { ...snapshot, creators });
}

export async function loadCurrentCampaignRoster(db: SupabaseClient, campaignId: string, snapshot: ClientReviewSourceSnapshot) {
  const hydrated = await loadCurrentCampaignSnapshot(db, campaignId, snapshot);
  return projectCreatorsFromSnapshot(hydrated,
    Object.fromEntries(hydrated.creators.map(c => [c.creatorId, "accepted" as const])),
    { includeCommercial: snapshot.source !== "studio" });
}

/** Token-gated callers resolve only relationships belonging to their review. */
export async function loadCurrentCampaignSnapshotForReview(db: SupabaseClient, review: ClientReviewRecord) {
  if (!review.sourceSnapshot) return null;
  const [linked] = await hydrateReviewCampaigns(db, [review]);
  if (!linked.campaignHeaderId) return null;
  return loadCurrentCampaignSnapshot(db, linked.campaignHeaderId, review.sourceSnapshot);
}
