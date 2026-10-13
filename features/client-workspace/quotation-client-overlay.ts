import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { shouldIncludeItemInLiveTotals } from "@/lib/quotations/quotation-collapse-package";
import { quotationServiceDescription } from "@/lib/quotations/service-description";

import { formatDeliverableItems, parseDeliverableItems } from "./deliverables";
import { clientFacingAgencyFeeFromLine, clientFacingQuotationPrice } from "./quotation-client-facing";
import { quotationItemClientCreatorId } from "./quotation-item-creator-id";
import { overlayQuotationOnShortlistCreators } from "./selection-flow";
import type { ClientReviewSourceSnapshotCreator } from "./types";

export function formatQuotationItemDeliverables(item: QuotationItemRow): string | undefined {
  const items = parseDeliverableItems(item.deliverables);
  return formatDeliverableItems(items) || item.service_description?.trim() || undefined;
}

/** Same source as the quotation workspace Service description column. */
export function clientServiceDescriptionFromQuotationItem(item: {
  service_description?: string | null;
  deliverables?: Array<{ service_description?: string | null }> | null;
}): string | undefined {
  return quotationServiceDescription(item);
}

export function quotationItemSnapshotCreator(
  item: QuotationItemRow,
  currency: string,
  quotationFxRateToEgp = 1,
  allItems?: QuotationItemRow[]
): ClientReviewSourceSnapshotCreator {
  const deliverableItems = parseDeliverableItems(item.deliverables);
  const price = clientFacingQuotationPrice({
    revenue: item.revenue,
    revenueEgp: item.revenue_egp,
    costCurrency: item.cost_currency,
    revenueFxOverride: item.revenue_fx_override,
    lineFxRateToEgp: item.fx_rate_to_egp,
    quotationCurrency: currency,
    quotationFxRateToEgp,
  });
  const handle = item.handle?.trim()
    ? item.handle.startsWith("@")
      ? item.handle
      : `@${item.handle}`
    : undefined;
  return {
    quotationOptions: allItems
      ?.filter((candidate) => quotationItemClientCreatorId(candidate) === quotationItemClientCreatorId(item) && shouldIncludeItemInLiveTotals(candidate, allItems))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((candidate, index) => {
        const quoted = quotationItemSnapshotCreator(candidate, currency, quotationFxRateToEgp);
        return {
          itemId: candidate.id,
          memberItemIds: candidate.collapse_group_id ? allItems.filter(row => row.collapse_group_id === candidate.collapse_group_id).map(row => row.id) : undefined,
          optionNumber: index + 1,
          deliverables: quoted.deliverables,
          serviceDescription: quoted.serviceDescription,
          investmentAmount: quoted.investmentAmount,
          investmentCurrency: quoted.investmentCurrency,
          agencyFeeAmount: quoted.agencyFeeAmount,
        };
      }),
    creatorId: quotationItemClientCreatorId(item),
    displayName: item.creator_name?.trim() || handle || "Creator",
    handle,
    platform: item.platform ?? undefined,
    followers: item.followers ?? undefined,
    engagementRate: item.engagement_rate ?? undefined,
    country: item.country_code ?? undefined,
    category: item.creator_categories?.[0] ?? undefined,
    categories: item.creator_categories?.filter(Boolean) ?? undefined,
    deliverables: formatQuotationItemDeliverables(item),
    deliverableItems: deliverableItems.length > 0 ? deliverableItems : undefined,
    serviceDescription: clientServiceDescriptionFromQuotationItem(item),
    investmentAmount: price.amount,
    investmentCurrency: price.currency,
    agencyFeeAmount: price.amount
      ? clientFacingAgencyFeeFromLine({
          afValue: item.af_value,
          afValueEgp: item.af_value_egp,
          afPct: item.af_pct,
          convertedRevenue: price.amount,
          costCurrency: item.cost_currency,
    revenueFxOverride: item.revenue_fx_override,
          lineFxRateToEgp: item.fx_rate_to_egp,
          quotationCurrency: currency,
          quotationFxRateToEgp,
        })
      : undefined,
    originalInvestmentAmount: price.originalAmount,
    originalInvestmentCurrency: price.originalCurrency,
    avatarUrl: item.profile_image_url ?? item.creator_profile_source?.avatarUrl ?? undefined,
    influencerId: item.influencer_id ?? undefined,
    shortlistItemId: item.source_shortlist_item_id ?? undefined,
    profileId: item.profile_id ?? undefined,
    unifiedId: item.unified_id ?? undefined,
  };
}

export function overlayQuotationDetailOnCreators(
  creators: ClientReviewSourceSnapshotCreator[],
  items: QuotationItemRow[],
  currency: string,
  quotationFxRateToEgp = 1,
  allItems: QuotationItemRow[] = items
): ClientReviewSourceSnapshotCreator[] {
  return overlayQuotationOnShortlistCreators(
    creators,
    items.map((item) => quotationItemSnapshotCreator(item, currency, quotationFxRateToEgp, allItems)),
    { currency }
  );
}
