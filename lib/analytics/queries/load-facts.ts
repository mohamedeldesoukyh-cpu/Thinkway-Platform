import type { SupabaseClient } from "@supabase/supabase-js";

import { loadCampaignInvoiceLineRollups } from "@/lib/billing/invoice-operational-aggregation";
import {
  buildAnalyticsCacheKey,
  withAnalyticsCache,
} from "@/lib/analytics/aggregations/memo";
import {
  applyInvoiceCollectionMetrics,
  mergeFinancialMetrics,
  metricsFromCampaignLines,
  type LineFinancialInput,
} from "@/lib/analytics/metrics/financial";
import { roundMoney } from "@/lib/analytics/aggregations/round";
import {
  isMissingColumnError,
  resolveFactCountryCode,
} from "@/lib/analytics/schema-safe";
import { devLog } from "@/lib/dev-log";
import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import type { CampaignAnalyticsFact } from "@/lib/analytics/types/metrics";
import type { CampaignLineBillingStatus } from "@/features/billing/types";

type HeaderRow = {
  id: string;
  document_number: string;
  name: string;
  client_id: string;
  brand_id: string;
  team_id: string | null;
  currency_code: string;
  start_date: string | null;
  client: Record<string, unknown> | null;
  brand: Record<string, unknown> | null;
  team: { id: string; name: string } | null;
};

type LineRow = {
  id: string;
  campaign_header_id: string;
  billing_status: CampaignLineBillingStatus;
  revenue: number;
  cost: number;
  profit: number;
  po_amount: number;
  po_consumed: number;
  currency_code: string;
};

type InvoiceRow = {
  id: string;
  campaign_header_id: string | null;
  total: number;
  amount_paid: number;
  currency: string;
  status: string;
  issue_date: string | null;
  due_date: string | null;
};

type VendorRow = {
  campaign_header_id: string;
  agreed_fee: number;
  vendor_payment_status: string;
};

export type AnalyticsFactsSnapshot = {
  facts: CampaignAnalyticsFact[];
  invoices: InvoiceRow[];
  loaded_at: string;
};

export function emptyAnalyticsFactsSnapshot(): AnalyticsFactsSnapshot {
  return {
    facts: [],
    invoices: [],
    loaded_at: new Date().toISOString(),
  };
}

const HEADER_SELECT_CANDIDATES = [
  `
    id, document_number, name, client_id, brand_id, team_id, currency_code, start_date,
    client:clients(id, name, country),
    brand:brands(id, name, country_code),
    team:md_teams(id, name)
  `,
  `
    id, document_number, name, client_id, brand_id, team_id, currency_code, start_date,
    client:clients(id, name, country),
    brand:brands(id, name),
    team:md_teams(id, name)
  `,
  `
    id, document_number, name, client_id, brand_id, team_id, currency_code, start_date,
    client:clients(id, name),
    brand:brands(id, name),
    team:md_teams(id, name)
  `,
  `
    id, document_number, name, client_id, brand_id, team_id, currency_code, start_date,
    client:clients(id, name),
    brand:brands(id, name)
  `,
] as const;

async function fetchCampaignHeaders(supabase: SupabaseClient): Promise<HeaderRow[]> {
  let lastError: string | null = null;

  for (const headerSelect of HEADER_SELECT_CANDIDATES) {
    const result = await supabase
      .from("campaign_headers")
      .select(headerSelect)
      .not("status", "eq", "cancelled")
      .limit(500);

    if (!result.error) {
      if (lastError && process.env.NODE_ENV === "development") {
        devLog("[analytics-schema] header select recovered after fallback", {
          previousError: lastError,
        });
      }
      return (result.data ?? []) as unknown as HeaderRow[];
    }

    lastError = result.error.message;
    if (!isMissingColumnError(lastError)) {
      throw new Error(lastError);
    }

    if (process.env.NODE_ENV === "development") {
      devLog("[analytics-schema] header select fallback", { error: lastError });
    }
  }

  throw new Error(lastError ?? "Failed to load campaign headers for analytics");
}

function passesDateRange(
  issueDate: string | null,
  range?: AnalyticsQueryFilters["dateRange"]
): boolean {
  if (!range?.from && !range?.to) return true;
  if (!issueDate) return true;
  const ts = new Date(issueDate).getTime();
  if (range.from && ts < new Date(range.from).getTime()) return false;
  if (range.to && ts > new Date(range.to).getTime()) return false;
  return true;
}

export async function loadAnalyticsFactsUncached(
  supabase: SupabaseClient,
  filters: AnalyticsQueryFilters
): Promise<AnalyticsFactsSnapshot> {
  const [headers, linesResult, invoicesResult, vendorResult] = await Promise.all([
    fetchCampaignHeaders(supabase),
    supabase
      .from("campaign_lines")
      .select(
        "id, campaign_header_id, billing_status, revenue, cost, profit, po_amount, po_consumed, currency_code"
      )
      .limit(5000),
    supabase
      .from("invoices")
      .select(
        "id, campaign_header_id, total, amount_paid, currency, status, issue_date, due_date"
      )
      .not("status", "eq", "void")
      .limit(2000),
    supabase
      .from("campaign_influencers")
      .select("campaign_header_id, agreed_fee, vendor_payment_status")
      .neq("vendor_payment_status", "paid")
      .limit(5000),
  ]);

  if (linesResult.error) throw new Error(linesResult.error.message);
  if (invoicesResult.error) throw new Error(invoicesResult.error.message);

  const lines = (linesResult.data ?? []) as unknown as LineRow[];
  const invoices = ((invoicesResult.data ?? []) as unknown as InvoiceRow[]).filter(
    (inv) => passesDateRange(inv.issue_date, filters.dateRange)
  );
  const vendors = (vendorResult.data ?? []) as unknown as VendorRow[];

  const linesByCampaign = new Map<string, LineFinancialInput[]>();
  for (const line of lines) {
    const list = linesByCampaign.get(line.campaign_header_id) ?? [];
    list.push({
      revenue: Number(line.revenue),
      cost: Number(line.cost),
      profit: Number(line.profit),
      billing_status: line.billing_status,
      po_amount: Number(line.po_amount),
      po_consumed: Number(line.po_consumed ?? line.cost),
    });
    linesByCampaign.set(line.campaign_header_id, list);
  }

  const headerIds = headers.map((h) => h.id);
  const lineRollups = await loadCampaignInvoiceLineRollups(supabase, headerIds);

  const collectedByCampaign = new Map<string, number>();
  const outstandingByCampaign = new Map<string, number>();

  for (const inv of invoices) {
    if (!inv.campaign_header_id) continue;
    const paid = roundMoney(Number(inv.amount_paid));
    const outstanding = roundMoney(Math.max(0, Number(inv.total) - paid));
    collectedByCampaign.set(
      inv.campaign_header_id,
      roundMoney((collectedByCampaign.get(inv.campaign_header_id) ?? 0) + paid)
    );
    outstandingByCampaign.set(
      inv.campaign_header_id,
      roundMoney((outstandingByCampaign.get(inv.campaign_header_id) ?? 0) + outstanding)
    );
  }

  const vendorByCampaign = new Map<string, number>();
  for (const row of vendors) {
    if (!["unpaid", "pending"].includes(row.vendor_payment_status)) continue;
    vendorByCampaign.set(
      row.campaign_header_id,
      roundMoney((vendorByCampaign.get(row.campaign_header_id) ?? 0) + Number(row.agreed_fee))
    );
  }

  const facts: CampaignAnalyticsFact[] = [];

  for (const header of headers) {
    const campaignLines = linesByCampaign.get(header.id) ?? [];
    const lineInvoiced = lineRollups.get(header.id)?.invoiced_subtotal ?? 0;

    let metrics = metricsFromCampaignLines(campaignLines, lineInvoiced);
    metrics = applyInvoiceCollectionMetrics(metrics, {
      collected: collectedByCampaign.get(header.id) ?? 0,
      outstanding: outstandingByCampaign.get(header.id) ?? 0,
    });
    metrics = mergeFinancialMetrics(metrics, {
      vendor_payable: vendorByCampaign.get(header.id) ?? 0,
    });

    const country_code = resolveFactCountryCode({
      client: header.client,
      brand: header.brand,
    });

    facts.push({
      campaign_header_id: header.id,
      campaign_document_number: header.document_number,
      campaign_name: header.name,
      client_id: header.client_id,
      client_name: String(header.client?.name ?? ""),
      brand_id: header.brand_id,
      brand_name: header.brand?.name != null ? String(header.brand.name) : null,
      team_id: header.team_id,
      team_name: header.team?.name ?? null,
      country_code,
      currency_code: header.currency_code,
      line_count: campaignLines.length,
      period_month: header.start_date ? header.start_date.slice(0, 7) : null,
      metrics,
    });
  }

  if (process.env.NODE_ENV === "development") {
    devLog("[dashboard-query] analytics facts loaded", {
      campaigns: facts.length,
      lines: lines.length,
      invoices: invoices.length,
      filter: filters.billingFilter ?? "all",
    });
  }

  return {
    facts,
    invoices,
    loaded_at: new Date().toISOString(),
  };
}

/**
 * Never throws — returns empty snapshot when analytics cannot load.
 */
export async function safeLoadAnalyticsFacts(
  supabase: SupabaseClient,
  filters: AnalyticsQueryFilters = {}
): Promise<AnalyticsFactsSnapshot> {
  const cacheKey = buildAnalyticsCacheKey("facts-safe", {
    billing: filters.billingFilter ?? "all",
    operational: filters.operationalFilter ?? "all",
    invoice: filters.invoiceFilter ?? "all",
    from: filters.dateRange?.from,
    to: filters.dateRange?.to,
  });

  return withAnalyticsCache(cacheKey, async () => {
    try {
      return await loadAnalyticsFactsUncached(supabase, filters);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (process.env.NODE_ENV === "development") {
        devLog("[analytics-fallback] safeLoadAnalyticsFacts failed", { message });
      }
      return emptyAnalyticsFactsSnapshot();
    }
  });
}

export async function loadAnalyticsFacts(
  supabase: SupabaseClient,
  filters: AnalyticsQueryFilters = {}
): Promise<AnalyticsFactsSnapshot> {
  return safeLoadAnalyticsFacts(supabase, filters);
}
