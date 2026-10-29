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

export type DocumentSelectionSummaryMetric = {
  label: string;
  value: string;
  scope?: "client" | "internal";
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
  const totalCreatorCount = creators.length;
  const selectedSet = new Set(selectedItemIds);
  const selectedCreators =
    creators.filter((item) => selectedSet.has(item.item_id));

  const selectedCreatorCount =
    selectedCreators.length;

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
  currency = "EGP",
  options: { showOriginalCurrency?: boolean; displayFxRateToEgp?: number } = {}
): DocumentSelectionSummary {
  const totalCreatorCount = countUniqueQuotationCreators(items);
  const selectedSet = new Set(selectedItemIds);
  const selectedItems =
    items.filter((item) => selectedSet.has(item.id));

  const selectedCreatorCount =
    countUniqueQuotationCreators(selectedItems);

  const revenueEgp = selectedItems.reduce((sum, item) => sum + (Number(item.revenue_egp) || 0), 0);
  const afEgp = selectedItems.reduce((sum, item) => sum + (Number(item.af_value_egp) || 0), 0);
  const costEgp = selectedItems.reduce((sum, item) => sum + (Number(item.cost_egp) || 0), 0);
  const gpEgp = revenueEgp + afEgp - costEgp;
  const requestedCurrency = (currency || "EGP").toUpperCase();
  const native = options.showOriginalCurrency || requestedCurrency === "FOREIGN";
  const rate = requestedCurrency === "EGP" ? 1 : options.displayFxRateToEgp;
  // Never relabel EGP as another currency when its conversion rate is unavailable.
  const displayCurrency = rate && rate > 0 ? requestedCurrency : "EGP";
  const money = (egp: number, field: "revenue" | "af_value" | "cost" | "gp_value" | "total") => {
    if (!native) return formatMoneyKpi(egp / (rate && rate > 0 ? rate : 1), displayCurrency);
    const grouped = new Map<string, number>();
    for (const item of selectedItems) {
      const code = (item.cost_currency || "EGP").toUpperCase();
      const value = field === "total" ? (Number(item.revenue) || 0) + (Number(item.af_value) || 0) : field === "gp_value" ? (Number(item.revenue) || 0) + (Number(item.af_value) || 0) - (Number(item.cost) || 0) : Number(item[field]) || 0;
      grouped.set(code, (grouped.get(code) || 0) + value);
    }
    return grouped.size ? [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([code, value]) => formatMoneyKpi(value, code)).join(" · ") : "—";
  };

  const forecast = computeCampaignForecastFromProfiles(
    quotationItemsToForecastProfiles(selectedItems)
  );

  const metrics: DocumentSelectionSummaryMetric[] = [
    {
      label: "Client cost",
      scope: "client",
      value: money(revenueEgp, "revenue"),
    },
    {
      label: "Agency fee",
      scope: "client",
      value: money(afEgp, "af_value"),
    },
    {
      label: "Total incl. AF",
      scope: "client",
      value: money(revenueEgp + afEgp, "total"),
    },
    {
      label: "Creator cost",
      scope: "internal",
      value: money(costEgp, "cost"),
    },
    {
      label: "Est. reach",
      value: formatCreatorCount(forecast.estimatedReach > 0 ? forecast.estimatedReach : null) || "—",
    },
  ];
  metrics.push({label: "Gross profit", value: money(gpEgp, "gp_value"), scope: "internal"},
    {label: "Margin", value: `${(revenueEgp + afEgp > 0 ? gpEgp / (revenueEgp + afEgp) * 100 : 0).toFixed(1)}%`, scope: "internal"});
  const er = formatEr(forecast.averageEngagementRate);
  if (er) metrics.push({ label: "Avg ER", value: er });

  return { selectedCreatorCount, totalCreatorCount, metrics };
}
