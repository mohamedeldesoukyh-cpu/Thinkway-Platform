import { roundMoney } from "@/lib/analytics/aggregations/round";
import { computeMarginPercent } from "@/lib/analytics/metrics/financial";
import {
  monthsForScope,
  periodScopeLabel,
  type PnlPeriodScope,
} from "@/lib/analytics/pnl/pnl-periods";
import {
  getClientCategoryLabel,
  getClientSubcategoryLabel,
} from "@/lib/clients/client-category-taxonomy";
import type {
  SpendingByCategoryCampaignDetail,
  SpendingByCategoryClientDetail,
  SpendingByCategoryDetailGroup,
  SpendingByCategoryGroupBy,
  SpendingByCategoryKpis,
  SpendingByCategoryLineFact,
  SpendingByCategoryReportData,
  SpendingByCategorySummaryRow,
  SpendingByCategoryView,
} from "@/lib/analytics/spending-by-category/spending-by-category-types";
import {
  UNCATEGORIZED_CATEGORY_LABEL,
  UNCATEGORIZED_CATEGORY_SLUG,
} from "@/lib/analytics/spending-by-category/spending-by-category-types";

type BucketKey = string;

type BucketAccumulator = {
  category_slug: string;
  category_label: string;
  subcategory_slug: string | null;
  subcategory_label: string | null;
  client_ids: Set<string>;
  campaign_ids: Set<string>;
  total_spending: number;
  vr_amount: number;
  gp_after_vr: number;
  facts: SpendingByCategoryLineFact[];
};

function resolveCategorySlug(fact: SpendingByCategoryLineFact): string {
  return fact.client_category?.trim() || UNCATEGORIZED_CATEGORY_SLUG;
}

function resolveCategoryLabel(categorySlug: string): string {
  if (categorySlug === UNCATEGORIZED_CATEGORY_SLUG) {
    return UNCATEGORIZED_CATEGORY_LABEL;
  }
  return getClientCategoryLabel(categorySlug);
}

function resolveSubcategorySlug(fact: SpendingByCategoryLineFact): string | null {
  if (!fact.client_subcategory?.trim()) {
    return null;
  }
  return fact.client_subcategory.trim();
}

function resolveSubcategoryLabel(
  categorySlug: string,
  subcategorySlug: string | null
): string | null {
  if (!subcategorySlug) {
    return null;
  }
  return getClientSubcategoryLabel(categorySlug, subcategorySlug);
}

function bucketKey(
  fact: SpendingByCategoryLineFact,
  groupBy: SpendingByCategoryGroupBy
): BucketKey {
  const categorySlug = resolveCategorySlug(fact);
  if (groupBy === "category") {
    return categorySlug;
  }
  const subcategorySlug = resolveSubcategorySlug(fact) ?? `${categorySlug}__none`;
  return `${categorySlug}::${subcategorySlug}`;
}

function campaignLabel(fact: SpendingByCategoryLineFact): string {
  return fact.campaign_code ?? fact.campaign_name ?? fact.campaign_header_id;
}

function buildBuckets(
  facts: SpendingByCategoryLineFact[],
  groupBy: SpendingByCategoryGroupBy
): Map<BucketKey, BucketAccumulator> {
  const buckets = new Map<BucketKey, BucketAccumulator>();

  for (const fact of facts) {
    const key = bucketKey(fact, groupBy);
    const categorySlug = resolveCategorySlug(fact);
    const subcategorySlug = groupBy === "subcategory" ? resolveSubcategorySlug(fact) : null;

    const bucket =
      buckets.get(key) ??
      {
        category_slug: categorySlug,
        category_label: resolveCategoryLabel(categorySlug),
        subcategory_slug: subcategorySlug,
        subcategory_label:
          groupBy === "subcategory"
            ? resolveSubcategoryLabel(categorySlug, subcategorySlug) ?? "—"
            : null,
        client_ids: new Set<string>(),
        campaign_ids: new Set<string>(),
        total_spending: 0,
        vr_amount: 0,
        gp_after_vr: 0,
        facts: [],
      };

    bucket.client_ids.add(fact.client_id);
    bucket.campaign_ids.add(fact.campaign_header_id);
    bucket.total_spending = roundMoney(bucket.total_spending + fact.billable_revenue);
    bucket.vr_amount = roundMoney(bucket.vr_amount + fact.vr_refund);
    bucket.gp_after_vr = roundMoney(bucket.gp_after_vr + fact.gp_after_vr);
    bucket.facts.push(fact);
    buckets.set(key, bucket);
  }

  return buckets;
}

function buildSummaryRows(
  buckets: Map<BucketKey, BucketAccumulator>,
  totalSpending: number
): SpendingByCategorySummaryRow[] {
  const rows: SpendingByCategorySummaryRow[] = [];

  for (const bucket of buckets.values()) {
    const percentOfTotal =
      totalSpending > 0
        ? roundMoney((bucket.total_spending / totalSpending) * 10000) / 100
        : 0;

    rows.push({
      category_slug: bucket.category_slug,
      category_label: bucket.category_label,
      subcategory_slug: bucket.subcategory_slug,
      subcategory_label: bucket.subcategory_label,
      client_count: bucket.client_ids.size,
      campaign_count: bucket.campaign_ids.size,
      total_spending: bucket.total_spending,
      percent_of_total: percentOfTotal,
      vr_amount: bucket.vr_amount,
      avg_margin_percent: computeMarginPercent(
        bucket.total_spending,
        bucket.gp_after_vr
      ),
    });
  }

  rows.sort((a, b) => {
    if (b.total_spending !== a.total_spending) {
      return b.total_spending - a.total_spending;
    }
    return a.category_label.localeCompare(b.category_label);
  });

  return rows;
}

function buildClientDetails(facts: SpendingByCategoryLineFact[]): SpendingByCategoryClientDetail[] {
  const byClient = new Map<
    string,
    {
      client_name: string;
      spending: number;
      vr_amount: number;
      gp_after_vr: number;
      campaigns: Map<string, SpendingByCategoryCampaignDetail>;
    }
  >();

  for (const fact of facts) {
    const clientBucket =
      byClient.get(fact.client_id) ??
      {
        client_name: fact.client_name,
        spending: 0,
        vr_amount: 0,
        gp_after_vr: 0,
        campaigns: new Map<string, SpendingByCategoryCampaignDetail>(),
      };

    clientBucket.spending = roundMoney(clientBucket.spending + fact.billable_revenue);
    clientBucket.vr_amount = roundMoney(clientBucket.vr_amount + fact.vr_refund);
    clientBucket.gp_after_vr = roundMoney(clientBucket.gp_after_vr + fact.gp_after_vr);

    const campaignBucket =
      clientBucket.campaigns.get(fact.campaign_header_id) ??
      {
        campaign_header_id: fact.campaign_header_id,
        campaign_label: campaignLabel(fact),
        brand_name: fact.brand_name,
        spending: 0,
        vr_amount: 0,
        margin_percent: 0,
      };

    campaignBucket.spending = roundMoney(campaignBucket.spending + fact.billable_revenue);
    campaignBucket.vr_amount = roundMoney(campaignBucket.vr_amount + fact.vr_refund);
    clientBucket.campaigns.set(fact.campaign_header_id, campaignBucket);
    byClient.set(fact.client_id, clientBucket);
  }

  const clients: SpendingByCategoryClientDetail[] = [];

  for (const [clientId, bucket] of byClient) {
    const campaigns = [...bucket.campaigns.values()]
      .map((campaign) => ({
        ...campaign,
        margin_percent: computeMarginPercent(campaign.spending, 0),
      }))
      .sort((a, b) => b.spending - a.spending);

    for (const campaign of campaigns) {
      const campaignFacts = facts.filter(
        (fact) =>
          fact.client_id === clientId &&
          fact.campaign_header_id === campaign.campaign_header_id
      );
      const campaignSpending = campaignFacts.reduce(
        (sum, fact) => roundMoney(sum + fact.billable_revenue),
        0
      );
      const campaignGp = campaignFacts.reduce(
        (sum, fact) => roundMoney(sum + fact.gp_after_vr),
        0
      );
      campaign.margin_percent = computeMarginPercent(campaignSpending, campaignGp);
    }

    clients.push({
      client_id: clientId,
      client_name: bucket.client_name,
      spending: bucket.spending,
      vr_amount: bucket.vr_amount,
      margin_percent: computeMarginPercent(bucket.spending, bucket.gp_after_vr),
      campaigns,
    });
  }

  clients.sort((a, b) => {
    if (b.spending !== a.spending) return b.spending - a.spending;
    return a.client_name.localeCompare(b.client_name);
  });

  return clients;
}

function buildDetailGroups(
  buckets: Map<BucketKey, BucketAccumulator>
): SpendingByCategoryDetailGroup[] {
  const groups: SpendingByCategoryDetailGroup[] = [];

  for (const bucket of buckets.values()) {
    groups.push({
      category_slug: bucket.category_slug,
      category_label: bucket.category_label,
      subcategory_slug: bucket.subcategory_slug,
      subcategory_label: bucket.subcategory_label,
      total_spending: bucket.total_spending,
      clients: buildClientDetails(bucket.facts),
    });
  }

  groups.sort((a, b) => {
    if (b.total_spending !== a.total_spending) {
      return b.total_spending - a.total_spending;
    }
    return a.category_label.localeCompare(b.category_label);
  });

  return groups;
}

function buildKpis(
  summaryRows: SpendingByCategorySummaryRow[],
  groupBy: SpendingByCategoryGroupBy
): SpendingByCategoryKpis {
  const totalSpending = roundMoney(
    summaryRows.reduce((sum, row) => roundMoney(sum + row.total_spending), 0)
  );

  const categorySlugs = new Set(
    summaryRows.map((row) => row.category_slug)
  );

  const topRow = summaryRows[0] ?? null;
  const topCategoryLabel =
    topRow == null
      ? null
      : groupBy === "subcategory" && topRow.subcategory_label
        ? `${topRow.category_label} · ${topRow.subcategory_label}`
        : topRow.category_label;

  return {
    total_spending: totalSpending,
    category_count: categorySlugs.size,
    top_category_label: topCategoryLabel,
    top_category_share_percent: topRow?.percent_of_total ?? 0,
  };
}

export function buildSpendingByCategoryReport(
  lineFacts: SpendingByCategoryLineFact[],
  year: number,
  periodScope: PnlPeriodScope,
  displayCurrency: string,
  availableCurrencies: string[],
  groupBy: SpendingByCategoryGroupBy,
  view: SpendingByCategoryView,
  hasMixedSourceCurrencies: boolean,
  mixedCurrencyCodes: string[]
): SpendingByCategoryReportData {
  const scopeMonths = monthsForScope(year, periodScope);
  const scopedFacts = lineFacts.filter(
    (fact) => fact.period_month && scopeMonths.includes(fact.period_month)
  );

  const buckets = buildBuckets(scopedFacts, groupBy);
  const provisionalTotal = roundMoney(
    [...buckets.values()].reduce((sum, bucket) => roundMoney(sum + bucket.total_spending), 0)
  );
  const summaryRows = buildSummaryRows(buckets, provisionalTotal);
  const detailGroups = buildDetailGroups(buckets);
  const kpis = buildKpis(summaryRows, groupBy);

  return {
    year,
    period_scope: periodScope,
    period_label: periodScopeLabel(periodScope),
    display_currency: displayCurrency,
    available_currencies: availableCurrencies,
    group_by: groupBy,
    view,
    has_mixed_source_currencies: hasMixedSourceCurrencies,
    mixed_currency_codes: mixedCurrencyCodes,
    kpis,
    summary_rows: summaryRows,
    detail_groups: detailGroups,
    period_note: `All amounts shown in ${displayCurrency} using effective exchange rates. Spending is billable revenue (deliverable + UR + agency fees). VR amount is vendor rebate refund credited against cost.`,
    data_scope_note:
      "Includes active, paused, and completed campaigns only. Cancelled campaigns and lines are excluded. Client category comes from legal entity intelligence fields; uncategorized clients roll into Uncategorized. Months use campaign start date, or created date when start is unset.",
  };
}
