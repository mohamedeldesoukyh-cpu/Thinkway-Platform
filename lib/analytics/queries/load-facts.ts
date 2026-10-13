import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import type { CampaignAnalyticsFact } from "@/lib/analytics/types/metrics";
import type { RecognitionEvent } from "./reporting-financials";
import { loadReportingSnapshot } from "./load-reporting-snapshot";
import { analyticsRequestKey, withAnalyticsCache } from "@/lib/analytics/aggregations/memo";
type InvoiceRow = {
  id: string;
  campaign_header_id: string | null;
  revenue_before_vat?: number;
  total: number;
  amount_paid: number;
  currency: string;
  status: string;
  issue_date: string | null;
  due_date: string | null;
};


export type AnalyticsFactsSnapshot = {
  facts: CampaignAnalyticsFact[]; invoices: InvoiceRow[]; loaded_at: string;
  recognition_events?: RecognitionEvent[]; date_range?: AnalyticsQueryFilters["dateRange"];
  source_currencies?: string[];
};
export function emptyAnalyticsFactsSnapshot(): AnalyticsFactsSnapshot {
  return { facts: [], invoices: [], loaded_at: new Date().toISOString() };
}
export const loadAnalyticsFactsUncached = loadReportingSnapshot;
/** Fail visibly rather than displaying unavailable balances as zero. */
export function safeLoadAnalyticsFacts(supabase: SupabaseClient, filters: AnalyticsQueryFilters = {}) {
  return withAnalyticsCache("facts:" + analyticsRequestKey(supabase, filters), () => loadReportingSnapshot(supabase, filters));
}
export const loadAnalyticsFacts = safeLoadAnalyticsFacts;
