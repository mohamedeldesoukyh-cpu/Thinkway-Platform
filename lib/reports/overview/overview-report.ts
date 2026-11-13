import { aggregateCampaignDisplayFinancials, requireReportingRate } from "@/lib/campaigns/campaign-display-financials";
import { buildRecognitionEvents } from "@/lib/analytics/queries/reporting-financials";
import { readRevenueShare, revenueShareAmount } from "@/lib/campaigns/revenue-share";
import { roundMoney } from "@/lib/analytics/aggregations/round";

export const OVERVIEW_COLUMNS = [
  { key: "group", label: "Group Name", numeric: false, accrued: false, total: false },
  { key: "client", label: "Client Name", numeric: false, accrued: false, total: false },
  { key: "brand", label: "Brand", numeric: false, accrued: false, total: false },
  { key: "campaign", label: "Campaign Name", numeric: false, accrued: false, total: false },
  { key: "revenue", label: "Rev.", numeric: true, accrued: false, total: false },
  { key: "accruedRevenue", label: "Acc. Rev.", numeric: true, accrued: true, total: false },
  { key: "totalRevenue", label: "Total Rev.", numeric: true, accrued: false, total: true },
  { key: "cost", label: "Cost", numeric: true, accrued: false, total: false },
  { key: "accruedCost", label: "Acc. Cost", numeric: true, accrued: true, total: false },
  { key: "totalCost", label: "Total Cost", numeric: true, accrued: false, total: true },
  { key: "gp", label: "GP", numeric: true, accrued: false, total: false },
  { key: "accruedGp", label: "Acc. GP", numeric: true, accrued: true, total: false },
  { key: "totalGp", label: "Total GP", numeric: true, accrued: false, total: true },
  { key: "revenueShare", label: "Rev. Share", numeric: true, accrued: false, total: false },
  { key: "gpAfterShare", label: "GP after RS", numeric: true, accrued: false, total: true },
] as const;
export type OverviewColumn = typeof OVERVIEW_COLUMNS[number]["key"];
export const DEFAULT_OVERVIEW_COLUMNS = OVERVIEW_COLUMNS.filter(c => !c.total || c.key === "gpAfterShare").map(c => c.key);
/** Keep totals beside their related amounts, including links saved with the old order. */
export function orderOverviewColumns(columns: OverviewColumn[]): OverviewColumn[] {
  const result = [...columns];
  for (const [total, actual, accrued] of [
    ["totalRevenue", "revenue", "accruedRevenue"],
    ["totalCost", "cost", "accruedCost"],
    ["totalGp", "gp", "accruedGp"],
  ] as const) {
    if (!result.includes(total) || (!result.includes(actual) && !result.includes(accrued))) continue;
    result.splice(result.indexOf(total), 1);
    const index = Math.max(result.indexOf(actual), result.indexOf(accrued));
    result.splice(index + 1, 0, total);
  }
  for (const key of ["revenueShare", "gpAfterShare"] as const) {
    const anchors = key === "revenueShare" ? ["gp", "accruedGp", "totalGp"] : ["gp", "accruedGp", "totalGp", "revenueShare"];
    if (!result.includes(key) || !anchors.some(anchor => result.includes(anchor as OverviewColumn))) continue;
    result.splice(result.indexOf(key), 1);
    const index = Math.max(...anchors.map(anchor => result.indexOf(anchor as OverviewColumn)));
    result.splice(index + 1, 0, key);
  }
  return result;
}
export type OverviewFilters = {
  q: string; groupId: string; clientId: string; brandId: string; campaignId: string;
  status: string; from: string; to: string; asOf: string; currency: string;
  activity: string; clientType: string; columns: OverviewColumn[];
};
export type OverviewHeader = {
  id: string; document_number?: string | null; name: string; status: string; start_date: string | null; currency_code: string | null;
  metadata?: Record<string, unknown> | null;
  client_id: string | null; brand_id: string | null;
  client: { name: string; group_id: string | null; agency_or_direct: string | null; group: { name: string } | null } | null;
  brand: { name: string } | null;
};
export type OverviewRow = { id: string } & Record<"group" | "client" | "brand" | "campaign", string> &
  Record<Exclude<OverviewColumn, "group" | "client" | "brand" | "campaign">, number>;
export type OverviewOption = { value: string; label: string };
export type OverviewReport = {
  filters: OverviewFilters; rows: OverviewRow[]; totals: OverviewRow;
  options: Record<"groupId" | "clientId" | "brandId" | "campaignId" | "status" | "currency", OverviewOption[]>;
};
export function cairoToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function parseOverviewFilters(params: Record<string, string | string[] | undefined>, today = cairoToday()): OverviewFilters {
  const read = (key: string) => { const v = params[key]; return (Array.isArray(v) ? v[0] : v)?.trim() ?? ""; };
  const date = (key: string) => { const v = read(key); return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v ? v : ""; };
  const requested = read("columns").split(",");
  const columns = [...new Set(requested)].filter((key): key is OverviewColumn => OVERVIEW_COLUMNS.some(c => c.key === key));
  const from = date("from"), to = date("to");
  return { q: read("q"), groupId: read("groupId"), clientId: read("clientId"), brandId: read("brandId"), campaignId: read("campaignId"),
    status: read("status"), from: from && to && from > to ? to : from, to: from && to && from > to ? from : to,
    asOf: date("asOf") && date("asOf") <= today ? date("asOf") : today,
    currency: /^[A-Z]{3}$/.test(read("currency").toUpperCase()) ? read("currency").toUpperCase() : "EGP",
    activity: ["actual", "accrued", "both"].includes(read("activity")) ? read("activity") : "",
    clientType: ["agency", "direct"].includes(read("clientType")) ? read("clientType") : "",
    columns: columns.length ? orderOverviewColumns(columns) : [...DEFAULT_OVERVIEW_COLUMNS] };
}
export function emptyOverviewTotals(): OverviewRow {
  return { id: "total", group: "", client: "", brand: "", campaign: "", revenue: 0, accruedRevenue: 0, cost: 0, accruedCost: 0, gp: 0, accruedGp: 0, totalRevenue: 0, totalCost: 0, totalGp: 0, revenueShare: 0, gpAfterShare: 0 };
}
type RecognitionInput = Parameters<typeof buildRecognitionEvents>[0];
export function buildOverviewReport(input: Omit<RecognitionInput, "today" | "campaignCurrencies"> & {
  headers: OverviewHeader[]; filters: OverviewFilters;
}): OverviewReport {
  const { filters } = input;
  const headers = input.headers.filter(h => h.status !== "cancelled");
  const option = (items: OverviewOption[]) => [...new Map(items.filter(i => i.value).map(i => [i.value, i])).values()].sort((a,b) => a.label.localeCompare(b.label));
  const clients = headers.filter(h => !filters.groupId || h.client?.group_id === filters.groupId);
  const brands = clients.filter(h => !filters.clientId || h.client_id === filters.clientId);
  const campaigns = brands.filter(h => !filters.brandId || h.brand_id === filters.brandId);
  const options: OverviewReport["options"] = {
    groupId: option(headers.map(h => ({ value: h.client?.group_id ?? "", label: h.client?.group?.name ?? "Unassigned" }))),
    clientId: option(headers.map(h => ({ value: h.client_id ?? "", label: h.client?.name ?? "Unassigned" }))),
    brandId: option(headers.map(h => ({ value: h.brand_id ?? "", label: h.brand?.name ?? "Unassigned" }))),
    campaignId: option(headers.map(h => ({ value: h.id, label: h.name }))),
    status: option(headers.map(h => ({ value: h.status, label: h.status }))),
    currency: option([...input.rates.keys()].map(c => ({ value: c, label: c }))),
  };
  const campaignCurrencies = new Map(headers.map(h => [h.id, h.currency_code || "EGP"]));
  const events = buildRecognitionEvents({ ...input, campaignCurrencies, today: filters.asOf });
  const rate = requireReportingRate(input.rates, filters.currency);
  const rows: OverviewRow[] = [];
  for (const header of campaigns) {
    if (filters.campaignId && header.id !== filters.campaignId || filters.status && header.status !== filters.status) continue;
    if (filters.clientType && header.client?.agency_or_direct?.toLowerCase() !== filters.clientType) continue;
    if (filters.from && (!header.start_date || header.start_date < filters.from) || filters.to && (!header.start_date || header.start_date > filters.to)) continue;
    const labels = { group: header.client?.group?.name ?? "—", client: header.client?.name ?? "—", brand: header.brand?.name ?? "—", campaign: header.name };
    if (filters.q && !Object.values(labels).join(" ").toLowerCase().includes(filters.q.toLowerCase())) continue;
    const lines = input.lines.filter(l => l.campaign_header_id === header.id).map(l => ({ ...l, currency_code: l.currency_code || header.currency_code || "EGP" }));
    const total = aggregateCampaignDisplayFinancials({ lines, displayCurrency: "EGP", rateToEgpByCurrency: input.rates });
    const actual = events.filter(e => e.campaign_header_id === header.id);
    const revenue = roundMoney(actual.reduce((n,e) => n + e.revenue, 0) / rate);
    const cost = roundMoney(actual.reduce((n,e) => n + e.cost, 0) / rate);
    const totalRevenue = roundMoney(total.revenue / rate), totalCost = roundMoney((total.revenue - total.gp) / rate);
    const accruedRevenue = roundMoney(totalRevenue - revenue), accruedCost = roundMoney(totalCost - cost);
    const hasActual = actual.length > 0, hasAccrued = accruedRevenue !== 0 || accruedCost !== 0;
    if (filters.activity === "actual" && !hasActual || filters.activity === "accrued" && !hasAccrued || filters.activity === "both" && !(hasActual && hasAccrued)) continue;
    const totalGp = roundMoney(totalRevenue - totalCost);
    const revenueShare = revenueShareAmount(readRevenueShare(header.metadata), totalRevenue, filters.currency, input.rates);
    rows.push({ id: header.id, ...labels, revenue, cost, accruedRevenue, accruedCost, gp: roundMoney(revenue - cost), accruedGp: roundMoney(accruedRevenue - accruedCost), totalRevenue, totalCost, totalGp, revenueShare, gpAfterShare: roundMoney(totalGp - revenueShare) });
  }
  rows.sort((a,b) => a.group.localeCompare(b.group) || a.client.localeCompare(b.client) || a.brand.localeCompare(b.brand) || a.campaign.localeCompare(b.campaign));
  const totals = emptyOverviewTotals();
  for (const row of rows) for (const c of OVERVIEW_COLUMNS) if (c.numeric) totals[c.key] = roundMoney(totals[c.key] + row[c.key]);
  return { filters, rows, totals, options };
}
