import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import type { AnalyticsFactsSnapshot } from "./load-facts";
import { applyFactFilters } from "@/lib/analytics/aggregations/rollup-engine";
import { emptyFinancialMetrics, computeMarginPercent } from "@/lib/analytics/metrics/financial";
import { roundMoney } from "@/lib/analytics/aggregations/round";
import { aggregateCampaignDisplayFinancials, requireReportingRate } from "@/lib/campaigns/campaign-display-financials";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import { getCampaignPoFxTotals } from "@/lib/finance/po/fx-totals";
import { isActiveInvoiceForFinancialTotals } from "@/lib/finance/status/invoice-status";
import { isCancelledCampaignStatus } from "@/lib/domains/groups/campaign-status";
import { resolveFactCountryCode } from "@/lib/analytics/schema-safe";
import { homeCreatorOutstanding } from "@/features/home/finance-summary";
import { buildRecognitionEvents, type RecognitionLine, type RecognitionDeliverable, type RecognitionPost, type RecognitionPublication } from "./reporting-financials";

type Row<K extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][K]["Row"];
type Header = Row<"campaign_headers"> & { client: { name: string; country?: string } | null; brand: { name: string; country_code?: string } | null; team: { name: string } | null };
type Payment = { assignment_id: string; status: string; cleared_at: string | null; original_amount: number };

export async function readReportingRows<T>(query: { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await query.range(offset, offset + 499);
    if (result.error) throw new Error(result.error.message);
    rows.push(...result.data ?? []);
    if ((result.data?.length ?? 0) < 500) return rows;
  }
}

export async function loadReportingSnapshot(supabase: SupabaseClient, filters: AnalyticsQueryFilters): Promise<AnalyticsFactsSnapshot> {
  const [headerRows, lineRows, invoiceRows, vendors, payments, deliverables, posts, publications] = await Promise.all([
    readReportingRows(supabase.from("campaign_headers").select("id, document_number, name, client_id, brand_id, team_id, currency_code, start_date, status, client:clients(name, country), brand:brands(name)").order("id")) as unknown as Promise<Header[]>,
    readReportingRows(supabase.from("campaign_lines").select("id, campaign_header_id, billing_status, revenue, cost, revenue_before_vat, usage_rights_amount, usage_rights_cost, agency_fee_percent, agency_fee_amount, cost_before_vat, currency_code, cost_received, cost_received_currency, cost_fx_override, revenue_fx_override").order("id")) as Promise<(RecognitionLine & { billing_status: string })[]>,
    readReportingRows(supabase.from("invoices").select("id, campaign_header_id, total, amount_paid, currency, status, regeneration_status, issue_date, due_date, revenue_before_vat, subtotal").order("id")) as Promise<Row<"invoices">[]>,
    readReportingRows(supabase.from("campaign_influencers").select("id, campaign_header_id, currency, cost_after_vat, vendor_payment_status").order("id")) as Promise<Row<"campaign_influencers">[]>,
    readReportingRows(supabase.from("creator_payment_entries").select("id, assignment_id, status, cleared_at, original_amount").order("id")) as Promise<Payment[]>,
    readReportingRows(supabase.from("assignment_deliverables").select("id, campaign_line_id, quantity, live_date, revenue_before_vat, cost_before_vat, usage_rights_amount, usage_rights_cost, agency_fee_amount, metadata").order("id")) as Promise<RecognitionDeliverable[]>,
    readReportingRows(supabase.from("assignment_post_schedule").select("id, assignment_deliverable_id, live_date, status, revenue_before_vat, cost_before_vat").order("id")) as Promise<RecognitionPost[]>,
    readReportingRows(supabase.from("campaign_publications").select("id, assignment_deliverable_id, assignment_post_schedule_id, publication_date, status").order("id")) as Promise<RecognitionPublication[]>,
  ]);
  const headers = headerRows.filter(h => !isCancelledCampaignStatus(h.status));
  const ids = new Set(headers.map(h => h.id));
  const lines = lineRows.filter(l => ids.has(l.campaign_header_id));
  const code = (currency?: string | null) => (currency || "EGP").trim().toUpperCase();
  const campaignCurrencies = new Map(headers.map(h => [h.id, code(h.currency_code)]));
  const codes = new Set<string>(["EGP", ...campaignCurrencies.values()]);
  lines.forEach(l => { codes.add(code(l.currency_code)); codes.add(code(l.cost_received_currency || l.currency_code)); });
  invoiceRows.forEach(i => codes.add(code(i.currency)));
  vendors.forEach(v => codes.add(code(v.currency)));
  const rates = new Map(await Promise.all([...codes].map(async c => [c, await resolveRateToEgp(supabase, c)] as const)));
  const convert = (amount: number, currency: string) => roundMoney(Number(amount) * requireReportingRate(rates, code(currency)));
  const poTotals = await getCampaignPoFxTotals(supabase, [...ids]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const allEvents = buildRecognitionEvents({ lines, deliverables, posts, publications, rates, campaignCurrencies, today });
  const inRange = (date: string) => (!filters.dateRange?.from || date >= filters.dateRange.from) && (!filters.dateRange?.to || date <= filters.dateRange.to);
  const events = allEvents.filter(e => inRange(e.date));
  const invoices = invoiceRows.filter(i => i.campaign_header_id && ids.has(i.campaign_header_id) && i.issue_date && isActiveInvoiceForFinancialTotals(i))
    .map(i => ({ ...i, currency: "EGP", total: convert(i.total, i.currency), amount_paid: convert(i.amount_paid, i.currency),
      revenue_before_vat: convert(Number(i.revenue_before_vat ?? i.subtotal ?? 0), i.currency) }));
  const facts = headers.map(header => {
    const campaignLines = lines.filter(l => l.campaign_header_id === header.id);
    const recognized = events.filter(e => e.campaign_header_id === header.id);
    const sumEvent = (key: "revenue" | "cost" | "gp") => roundMoney(recognized.reduce((n, e) => n + e[key], 0));
    const campaignInvoices = invoices.filter(i => i.campaign_header_id === header.id);
    const sumInvoice = (pick: (i: typeof invoices[number]) => number) => roundMoney(campaignInvoices.reduce((n, i) => n + pick(i), 0));
    const revenue = sumEvent("revenue"), gp = sumEvent("gp");
    const totalRecognized = roundMoney(allEvents.filter(e => e.campaign_header_id === header.id).reduce((n, e) => n + e.revenue, 0));
    const invoicedAll = sumInvoice(i => i.revenue_before_vat);
    const payable = roundMoney(vendors.filter(v => v.campaign_header_id === header.id).reduce((n, v) => n + convert(homeCreatorOutstanding(Number(v.cost_after_vat ?? 0), v.vendor_payment_status, payments.filter(p => p.assignment_id === v.id)), v.currency), 0));
    const po = poTotals.get(header.id);
    if (!po) throw new Error(`PO totals unavailable for campaign ${header.id}`);
    const planned = aggregateCampaignDisplayFinancials({ lines: campaignLines.map(l => ({ ...l, currency_code: l.currency_code || header.currency_code })), displayCurrency: "EGP", rateToEgpByCurrency: rates });
    const budget = convert(po.po_amount, header.currency_code), consumed = convert(po.po_consumed, header.currency_code);
    return {
      campaign_header_id: header.id, campaign_document_number: header.document_number, campaign_name: header.name,
      client_id: header.client_id, client_name: header.client?.name ?? "", brand_id: header.brand_id, brand_name: header.brand?.name ?? null,
      team_id: header.team_id, team_name: header.team?.name ?? null,
      country_code: resolveFactCountryCode({ client: header.client, brand: header.brand }),
      currency_code: "EGP", source_currency_code: code(header.currency_code), campaign_status: header.status,
      line_count: campaignLines.length, period_month: header.start_date?.slice(0, 7) ?? null,
      metrics: { ...emptyFinancialMetrics(), revenue, cost: sumEvent("cost"), gp, margin_percent: computeMarginPercent(revenue, gp),
        achieved_revenue: revenue, unachieved_revenue: roundMoney(Math.max(0, planned.revenue - totalRecognized)),
        planned_revenue: planned.revenue, planned_gp: planned.gp,
        invoiced_revenue: sumInvoice(i => inRange(i.issue_date!) ? i.revenue_before_vat : 0),
        collected_revenue: sumInvoice(i => i.amount_paid), outstanding_revenue: sumInvoice(i => Math.max(0, i.total - i.amount_paid)),
        vendor_payable: payable, remaining_to_invoice: roundMoney(Math.max(0, totalRecognized - invoicedAll)),
        budget_amount: budget, actual_amount: consumed, budget_variance: roundMoney(budget - consumed) },
    };
  });
  const selected = applyFactFilters(facts, filters);
  const selectedIds = new Set(selected.map(f => f.campaign_header_id));
  return { facts: selected, invoices: invoices.filter(i => selectedIds.has(i.campaign_header_id!)),
    source_currencies: [...new Set(lines.filter(l => selectedIds.has(l.campaign_header_id)).flatMap(l => [code(l.currency_code || campaignCurrencies.get(l.campaign_header_id)), code(l.cost_received_currency || l.currency_code || campaignCurrencies.get(l.campaign_header_id))]))].sort(),
    recognition_events: events.filter(e => selectedIds.has(e.campaign_header_id)),
    date_range: filters.dateRange, loaded_at: new Date().toISOString() };
}
