import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

import { formatDeliverableItems, parseDeliverableItems } from "./deliverables";
import { clientFacingAgencyFeeFromLine, clientFacingQuotationPrice } from "./quotation-client-facing";
import { quotationItemClientCreatorId } from "./quotation-item-creator-id";
import { overlayQuotationOnShortlistCreators } from "./selection-flow";
import type { ClientReviewSourceSnapshotCreator } from "./types";

export function formatQuotationItemDeliverables(item: QuotationItemRow): string | undefined {
  const items = parseDeliverableItems(item.deliverables);
  return formatDeliverableItems(items) || item.service_description?.trim() || undefined;
}

export function quotationItemSnapshotCreator(
  item: QuotationItemRow,
  currency: string,
  quotationFxRateToEgp = 1
): ClientReviewSourceSnapshotCreator {
  const deliverableItems = parseDeliverableItems(item.deliverables);
  const price = clientFacingQuotationPrice({
    revenue: item.revenue,
    revenueEgp: item.revenue_egp,
    costCurrency: item.cost_currency,
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
    investmentAmount: price.amount,
    investmentCurrency: price.currency,
    agencyFeeAmount: price.amount
      ? clientFacingAgencyFeeFromLine({
          afValue: item.af_value,
          afValueEgp: item.af_value_egp,
          afPct: item.af_pct,
          convertedRevenue: price.amount,
          costCurrency: item.cost_currency,
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
  quotationFxRateToEgp = 1
): ClientReviewSourceSnapshotCreator[] {
  return overlayQuotationOnShortlistCreators(
    creators,
    items.map((item) => quotationItemSnapshotCreator(item, currency, quotationFxRateToEgp)),
    { currency }
  );
}
