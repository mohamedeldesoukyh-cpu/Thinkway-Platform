/**
 * Source adapters — normalize each business object into a `CampaignSeed`.
 * Deterministic and defensive: they read only the fields a source actually
 * carries and never invent values. Tier is taken from an explicit role when
 * present, otherwise inferred from follower count.
 */

import type { QuotationDetail, QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import {
  deliverableTypeLines,
  formatTypeLinesSummary,
  quotationPostTypeLabel,
} from "@/lib/quotations/quotation-deliverable-types";
import { buildQuotationCreatorProfileSource } from "@/lib/quotations/quotation-creator-source";
import { groupQuotationItemsByCreator } from "@/lib/quotations/quotation-creator-options";
import { formatCreatorDisplayName } from "@/lib/text/decode-html-entities";
import type { ShortlistDetail } from "@/features/discovery/shortlists/types";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

import { getInfluencerTier, type InfluencerTier } from "@/lib/creators/influencer-tier";

import type { CampaignSeed, SeedCreator } from "./hydration-types";
import { normalizeCreatorMatchKey, parseAggregatedServiceLabel } from "./quotation-service-types";

/** Follower-count → tier, when a source has no explicit role. */
export function inferTier(followers?: number | null): InfluencerTier | undefined {
  if (followers == null || followers <= 0) return undefined;
  return getInfluencerTier(followers);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v && v.trim())).map((v) => v.trim()))];
}

// ---------------------------------------------------------------------------
// Quotation → seed
// ---------------------------------------------------------------------------

function serviceTypeLabel(line: { type: string; quantity: number }): string {
  return `${line.quantity}× ${quotationPostTypeLabel(line.type)}`;
}

function serviceTypesForItem(item: QuotationItemRow): string[] {
  const types: string[] = [];
  for (const deliverable of item.deliverables ?? []) {
    const lines = deliverableTypeLines(deliverable).filter((line) => line.type.trim());
    if (lines.length) {
      for (const line of lines) {
        types.push(serviceTypeLabel(line));
      }
      continue;
    }
    const typeSummary = formatTypeLinesSummary(deliverableTypeLines(deliverable));
    if (typeSummary && typeSummary !== "Select type…") {
      types.push(...parseAggregatedServiceLabel(typeSummary));
      continue;
    }
    const service = deliverable.service_description?.trim();
    if (service) types.push(...parseAggregatedServiceLabel(service));
  }
  if (!types.length && item.service_description?.trim()) {
    types.push(...parseAggregatedServiceLabel(item.service_description));
  }
  return [...new Set(types)];
}

function serviceLabelForItem(item: QuotationItemRow): string | undefined {
  const types = serviceTypesForItem(item);
  if (types.length) return [...new Set(types)].join(" · ");
  return undefined;
}

function seedCreatorFromQuotationItem(item: QuotationItemRow): SeedCreator {
  const profile = buildQuotationCreatorProfileSource(item);
  const serviceTypes = serviceTypesForItem(item);
  return {
    creatorId: item.unified_id ?? item.influencer_id ?? item.profile_id ?? item.id,
    displayName:
      formatCreatorDisplayName(profile.displayName) ||
      formatCreatorDisplayName(item.creator_name) ||
      "Creator",
    tier: inferTier(item.followers),
    quotedRevenue: item.revenue_egp > 0 ? item.revenue_egp : undefined,
    quotedCurrency: item.revenue_egp > 0 ? "EGP" : undefined,
    platform: item.platform ?? profile.platform ?? undefined,
    handle: profile.handle ?? item.handle ?? undefined,
    avatarUrl: profile.avatarUrl ?? item.profile_image_url ?? undefined,
    profileUrl: profile.profile_url ?? item.profile_url ?? undefined,
    serviceTypes: serviceTypes.length ? serviceTypes : undefined,
    serviceLabel: serviceTypes.length ? serviceTypes.join(" · ") : undefined,
    followers: item.followers ?? undefined,
    engagementRate: item.engagement_rate ?? undefined,
    categories: item.creator_categories ?? undefined,
    country: item.country_code ?? undefined,
  };
}

function seedCreatorsFromQuotationItems(items: QuotationItemRow[]): SeedCreator[] {
  if (!items.length) return [];

  return groupQuotationItemsByCreator(items).map((group) => {
    const primaryItems = group.optionSets[0]?.items ?? [];
    const sourceItems = primaryItems.length ? primaryItems : items.slice(0, 1);

    const mergedTypes: string[] = [];
    let base: SeedCreator | undefined;
    let quotedRevenue = 0;

    for (const item of sourceItems) {
      mergedTypes.push(...serviceTypesForItem(item));
      if (!base) base = seedCreatorFromQuotationItem(item);
      if (item.revenue_egp > 0) quotedRevenue += item.revenue_egp;
    }

    const serviceTypes = [...new Set(mergedTypes)];
    return {
      ...base!,
      serviceTypes: serviceTypes.length ? serviceTypes : undefined,
      serviceLabel: serviceTypes.length ? serviceTypes.join(" · ") : undefined,
      quotedRevenue: quotedRevenue > 0 ? quotedRevenue : base!.quotedRevenue,
      quotedCurrency: quotedRevenue > 0 ? "EGP" : base!.quotedCurrency,
    };
  });
}

export function seedFromQuotation(quotation: QuotationDetail): CampaignSeed {
  const items = quotation.items ?? [];

  const creators: SeedCreator[] = seedCreatorsFromQuotationItems(items);

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
    group: quotation.group_name ?? undefined,
    agencyOrDirect: quotation.agency_or_direct ?? undefined,
    agencyName:
      quotation.agency_or_direct === "agency"
        ? quotation.agency_name ?? quotation.client_name ?? undefined
        : undefined,
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
