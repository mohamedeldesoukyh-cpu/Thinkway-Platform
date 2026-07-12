/**
 * Source adapters — normalize each business object into a `CampaignSeed`.
 * Deterministic and defensive: they read only the fields a source actually
 * carries and never invent values. Tier is taken from an explicit role when
 * present, otherwise inferred from follower count.
 */

import type { QuotationDetail } from "@/lib/domains/commercial/quotation-detail-types";
import type { ShortlistDetail } from "@/features/discovery/shortlists/types";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

import type { CampaignSeed, SeedCreator } from "./hydration-types";

/** Follower-count → tier, when a source has no explicit role. */
export function inferTier(followers?: number | null): string | undefined {
  if (!followers || followers <= 0) return undefined;
  if (followers >= 1_000_000) return "Celebrity";
  if (followers >= 500_000) return "Macro";
  if (followers >= 100_000) return "Mid-Tier";
  if (followers >= 10_000) return "Micro";
  return "Nano";
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v && v.trim())).map((v) => v.trim()))];
}

// ---------------------------------------------------------------------------
// Quotation → seed
// ---------------------------------------------------------------------------

export function seedFromQuotation(quotation: QuotationDetail): CampaignSeed {
  const items = quotation.items ?? [];

  const creators: SeedCreator[] = items.map((item) => ({
    creatorId: item.unified_id ?? item.influencer_id ?? item.profile_id ?? item.id,
    displayName: item.creator_name ?? "Creator",
    tier: inferTier(item.followers),
    platform: item.platform ?? undefined,
    followers: item.followers ?? undefined,
    engagementRate: item.engagement_rate ?? undefined,
    categories: item.creator_categories ?? undefined,
    country: item.country_code ?? undefined,
  }));

  const deliverables = uniqueStrings(
    items.flatMap((item) =>
      (item.deliverables ?? []).map((d) => {
        const lines = d.type_lines?.length
          ? d.type_lines.map((line) => `${line.quantity}× ${line.type}`).join(", ")
          : d.type
            ? `${d.quantity ?? 1}× ${d.type}`
            : null;
        return lines ? `${d.platform ? `${d.platform}: ` : ""}${lines}` : item.service_description ?? null;
      })
    )
  );

  const kpis: string[] = [];
  if (quotation.estimated_reach > 0) kpis.push(`${quotation.estimated_reach.toLocaleString()} reach`);
  if (quotation.estimated_engagement_rate)
    kpis.push(`${quotation.estimated_engagement_rate}% engagement`);

  return {
    source: "quotation",
    campaignName: quotation.campaign_name ?? quotation.name ?? undefined,
    client: quotation.client_name ?? quotation.temporary_client_name ?? undefined,
    brand: quotation.brand_name ?? quotation.temporary_brand_name ?? undefined,
    budget:
      quotation.total_revenue_egp > 0
        ? { amount: quotation.total_revenue_egp, currency: "EGP" }
        : undefined,
    market: uniqueStrings(items.map((item) => item.country_code)),
    platforms: uniqueStrings(items.map((item) => item.platform)),
    deliverables,
    kpis,
    creators,
  };
}

// ---------------------------------------------------------------------------
// Creator Shortlist / Discovery → seed (both map a UnifiedCreatorResult slate)
// ---------------------------------------------------------------------------

function metricValue(metric: { value?: number | null } | undefined | null): number | undefined {
  return typeof metric?.value === "number" ? metric.value : undefined;
}

function seedCreatorFromUnified(creator: UnifiedCreatorResult): SeedCreator {
  const followers = metricValue(creator.metrics?.followers) ?? creator.platforms?.[0]?.follower_count ?? undefined;
  const engagementRate =
    metricValue(creator.metrics?.engagement_rate) ?? creator.platforms?.[0]?.engagement_rate ?? undefined;
  return {
    creatorId: creator.unified_id,
    displayName: creator.display_name,
    tier: creator.role?.trim() || inferTier(followers),
    platform: creator.platforms?.[0]?.platform ?? undefined,
    followers: followers ?? undefined,
    engagementRate: engagementRate ?? undefined,
    categories: creator.categories?.length ? creator.categories : undefined,
    country: creator.country_code ?? creator.estimated_country ?? undefined,
    brandFit: creator.brand_fit_score ?? undefined,
    aiScore: typeof creator.thinkway_score === "number" ? creator.thinkway_score : undefined,
  };
}

function seedFromUnifiedCreators(
  source: CampaignSeed["source"],
  creators: UnifiedCreatorResult[],
  base?: Partial<CampaignSeed>
): CampaignSeed {
  const seedCreators = creators.map(seedCreatorFromUnified);
  const audienceInterests = uniqueStrings(creators.flatMap((c) => c.audience_interests ?? [])).slice(0, 6);
  return {
    source,
    client: base?.client,
    brand: base?.brand,
    platforms: uniqueStrings(creators.flatMap((c) => (c.platforms ?? []).map((p) => p.platform))),
    market: uniqueStrings(creators.map((c) => c.country_code ?? c.estimated_country)),
    categories: uniqueStrings(creators.flatMap((c) => c.categories ?? [])),
    audience: audienceInterests.length ? `Interested in ${audienceInterests.join(", ")}` : undefined,
    creators: seedCreators,
    ...base,
  };
}

export function seedFromShortlist(shortlist: ShortlistDetail): CampaignSeed {
  const creators = (shortlist.creators ?? [])
    .map((item) => item.creator)
    .filter((c): c is UnifiedCreatorResult => Boolean(c));
  return seedFromUnifiedCreators("creator_shortlist", creators, {
    client: shortlist.client_name ?? undefined,
    brand: shortlist.brand_name ?? undefined,
    campaignName: shortlist.name ?? undefined,
  });
}

export function seedFromDiscovery(creators: UnifiedCreatorResult[]): CampaignSeed {
  return seedFromUnifiedCreators("discovery_selection", creators);
}

// ---------------------------------------------------------------------------
// Brief / Manual wizard → seed (explicit fields only)
// ---------------------------------------------------------------------------

export function seedFromManual(fields: Partial<Omit<CampaignSeed, "source" | "creators">> & { creators?: SeedCreator[] }): CampaignSeed {
  return { source: "manual_wizard", creators: fields.creators ?? [], ...fields };
}

export function seedFromBrief(fields: Partial<Omit<CampaignSeed, "source" | "creators">> & { creators?: SeedCreator[] }): CampaignSeed {
  return { source: "campaign_brief", creators: fields.creators ?? [], ...fields };
}
