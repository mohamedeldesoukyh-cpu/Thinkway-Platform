import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import { requirePermission } from "@/lib/auth/permissions-server";
import { buildOverviewReport, parseOverviewFilters, type OverviewHeader } from "@/lib/reports/overview/overview-report";
import type { RecognitionLine, RecognitionDeliverable, RecognitionPost, RecognitionPublication } from "@/lib/analytics/queries/reporting-financials";

async function readRows<T>(query: { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await query.range(offset, offset + 499);
    if (result.error) throw new Error(result.error.message);
    rows.push(...result.data ?? []);
    if ((result.data?.length ?? 0) < 500) return rows;
  }
}
export async function getOverviewReport(params: Record<string, string | string[] | undefined>, client?: SupabaseClient) {
  const supabase = client ?? await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "analytics.read");
  if ("error" in auth) throw new Error(auth.error);
  const filters = parseOverviewFilters(params);
  const [headers, allLines, deliverables, posts, publications] = await Promise.all([
    readRows(supabase.from("campaign_headers").select("id, name, status, start_date, currency_code, client_id, brand_id, client:clients(name, group_id, agency_or_direct, group:groups(name)), brand:brands(name)").order("id")) as unknown as Promise<OverviewHeader[]>,
    readRows(supabase.from("campaign_lines").select("id, campaign_header_id, status, metadata, revenue, cost, revenue_before_vat, usage_rights_amount, usage_rights_cost, agency_fee_percent, agency_fee_amount, cost_before_vat, currency_code, cost_received, cost_received_currency, cost_fx_override, revenue_fx_override").order("id")) as Promise<(RecognitionLine & { status: string })[]>,
    readRows(supabase.from("assignment_deliverables").select("id, campaign_line_id, quantity, live_date, revenue_before_vat, cost_before_vat, usage_rights_amount, usage_rights_cost, agency_fee_amount, metadata").order("id")) as Promise<RecognitionDeliverable[]>,
    readRows(supabase.from("assignment_post_schedule").select("id, assignment_deliverable_id, live_date, status, revenue_before_vat, cost_before_vat").order("id")) as Promise<RecognitionPost[]>,
    readRows(supabase.from("campaign_publications").select("id, assignment_deliverable_id, assignment_post_schedule_id, publication_date, status").order("id")) as Promise<RecognitionPublication[]>,
  ]);
  const activeIds = new Set(headers.filter(h => h.status !== "cancelled").map(h => h.id));
  const lines = allLines.filter(l => l.status !== "cancelled" && activeIds.has(l.campaign_header_id));
  const code = (c?: string | null) => (c || "EGP").trim().toUpperCase();
  const currencies = new Set(["EGP", filters.currency, ...headers.map(h => code(h.currency_code))]);
  lines.forEach(l => { currencies.add(code(l.currency_code)); currencies.add(code(l.cost_received_currency || l.currency_code)); });
  const rates = new Map(await Promise.all([...currencies].map(async c => [c, await resolveRateToEgp(supabase, c, filters.asOf)] as const)));
  return buildOverviewReport({ headers, lines, deliverables, posts, publications, rates, filters });
}

