import { creatorProfileSourceFromUnified } from "@/lib/creators/creator-profile-source";
import { formatCreatorCount } from "@/features/discovery/components/creator-search/creator-search-utils";
import { formatMoneyKpi } from "@/lib/finance/currency-format";
import {
  computeCampaignForecastFromProfiles,
  quotationItemsToForecastProfiles,
  shortlistGroupsToForecastProfiles,
} from "@/lib/campaign-forecast";
import type { ShortlistCreatorItem } from "@/features/discovery/shortlists/types";
import type { QuotationItemRow } from "@/features/quotations/types";
import { countUniqueQuotationCreators } from "@/lib/quotations/quotation-creator-options";
import { buildShortlistCreatorOptions, buildQuotationCreatorOptions } from "./build-creator-options";

export type DocumentSelectionSummaryMetric = {
  label: string;
  value: string;
};

export type DocumentSelectionSummary = {
  selectedCreatorCount: number;
  totalCreatorCount: number;
  metrics: DocumentSelectionSummaryMetric[];
};

function formatEr(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${value.toFixed(2)}%`;
}

export function summarizeShortlistSelection(
  creators: ShortlistCreatorItem[],
  selectedItemIds: string[]
): DocumentSelectionSummary {
  const options = buildShortlistCreatorOptions(creators);
  const totalCreatorCount = options.length;
  const selectedSet = new Set(selectedItemIds);
  const selectedCreators =
    selectedItemIds.length > 0
      ? creators.filter((item) => selectedSet.has(item.item_id))
      : creators;

  const selectedCreatorCount =
    selectedItemIds.length > 0
      ? options.filter((option) => option.itemIds.some((id) => selectedSet.has(id))).length
      : totalCreatorCount;

  const groups = selectedCreators
    .map((item) => {
      const creator = item.creator;
      if (!creator) return null;
      const source = creatorProfileSourceFromUnified(creator);
      return {
        creatorKey: item.item_id,
        creator: source.displayName,
        handle: source.handle ?? "—",
        followersNumeric: creator.metrics.followers.value ?? null,
        engagementRateNumeric: creator.metrics.engagement_rate.value ?? null,
        platformLinks: creator.platforms.map((platform) => ({
          platform: platform.platform,
        })),
      };
    })
    .filter(
      (group): group is NonNullable<typeof group> => group != null
    );

  const forecast = computeCampaignForecastFromProfiles(
    shortlistGroupsToForecastProfiles(groups)
  );

  const metrics: DocumentSelectionSummaryMetric[] = [
    {
      label: "Est. reach",
      value: formatCreatorCount(forecast.estimatedReach > 0 ? forecast.estimatedReach : null) || "—",
    },
    {
      label: "Audience",
      value: formatCreatorCount(forecast.audienceSize > 0 ? forecast.audienceSize : null) || "—",
    },
  ];
  const er = formatEr(forecast.averageEngagementRate);
  if (er) metrics.push({ label: "Avg ER", value: er });

  return { selectedCreatorCount, totalCreatorCount, metrics };
}

export function summarizeQuotationSelection(
  items: QuotationItemRow[],
  selectedItemIds: string[],
  currency = "EGP"
): DocumentSelectionSummary {
  const options = buildQuotationCreatorOptions(items);
  const totalCreatorCount = options.length;
  const selectedSet = new Set(selectedItemIds);
  const selectedItems =
    selectedItemIds.length > 0
      ? items.filter((item) => selectedSet.has(item.id))
      : items;

  const selectedCreatorCount =
    selectedItemIds.length > 0
      ? countUniqueQuotationCreators(selectedItems)
      : totalCreatorCount;

  const revenueEgp = selectedItems.reduce((sum, item) => sum + (Number(item.revenue_egp) || 0), 0);
  const afEgp = selectedItems.reduce((sum, item) => sum + (Number(item.af_value_egp) || 0), 0);
  const costEgp = selectedItems.reduce((sum, item) => sum + (Number(item.cost_egp) || 0), 0);
  const displayCurrency = (currency || "EGP").toUpperCase();

  const forecast = computeCampaignForecastFromProfiles(
    quotationItemsToForecastProfiles(selectedItems)
  );

  const metrics: DocumentSelectionSummaryMetric[] = [
    {
      label: "Client cost",
      value: formatMoneyKpi(revenueEgp, displayCurrency),
    },
    {
      label: "Agency fee",
      value: formatMoneyKpi(afEgp, displayCurrency),
    },
    {
      label: "Total incl. AF",
      value: formatMoneyKpi(revenueEgp + afEgp, displayCurrency),
    },
    {
      label: "Creator cost",
      value: formatMoneyKpi(costEgp, displayCurrency),
    },
    {
      label: "Est. reach",
      value: formatCreatorCount(forecast.estimatedReach > 0 ? forecast.estimatedReach : null) || "—",
    },
  ];
  const er = formatEr(forecast.averageEngagementRate);
  if (er) metrics.push({ label: "Avg ER", value: er });

  return { selectedCreatorCount, totalCreatorCount, metrics };
}
