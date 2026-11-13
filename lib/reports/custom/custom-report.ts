import { plannedPostingDate, formatPlannedPostingDates } from "@/lib/campaigns/planned-posting-date";
import { buildRecognitionEvents } from "@/lib/analytics/queries/reporting-financials";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { readRevenueShare } from "@/lib/campaigns/revenue-share";
import { deliverableTypeLabel } from "@/lib/campaigns/deliverable-taxonomy";
import { buildOverviewReport, OVERVIEW_COLUMNS } from "@/lib/reports/overview/overview-report";
import { creatorFxAmount } from "@/lib/commercial/creator-fx";
import { resolveLineCostCurrency, resolveLineRevenueCurrency, requireReportingRate } from "@/lib/campaigns/campaign-display-financials";
import { roundMoney } from "@/lib/analytics/aggregations/round";

const keys = ["group", "client", "brand", "campaign", "revenue", "accruedRevenue", "cost", "accruedCost", "gp", "accruedGp", "totalRevenue", "totalCost", "totalGp", "revenueShare"] as const;
const CUSTOM_BASE_COLUMNS = OVERVIEW_COLUMNS.filter((c): c is Extract<typeof OVERVIEW_COLUMNS[number], { key: typeof keys[number] }> => (keys as readonly string[]).includes(c.key));
const DATE_COLUMNS = [{ key: "plannedDate", label: "Planned Date", numeric: false, accrued: false }, { key: "date", label: "Date", numeric: false, accrued: false }, { key: "wentLive", label: "Went live", numeric: false, accrued: false }, { key: "wentLiveDate", label: "Went live date", numeric: false, accrued: false }] as const;
export const CUSTOM_COLUMNS = [...DATE_COLUMNS, { key: "campaignNumber", label: "Campaign Number", numeric: false, accrued: false }, ...CUSTOM_BASE_COLUMNS, ...(["creator", "deliverables", "platform"] as const).map(key => ({ key, label: { creator: "Vendor / Creator Name", deliverables: "Deliverables", platform: "Platform" }[key], numeric: false as const, accrued: false })), { key: "vat", label: "VAT", numeric: true, accrued: false }] as const;
export type CustomColumn = typeof keys[number] | "vat" | "creator" | "deliverables" | "platform" | "campaignNumber" | "date" | "wentLive" | "wentLiveDate" | "plannedDate";
export const CUSTOM_CURRENCIES = ["EGP", "USD", "AED", "SAR", "Foreign"] as const;
export type CustomCurrency = typeof CUSTOM_CURRENCIES[number];
export type Money = Record<string, number>;
export type CustomRow = { id: string; creatorIdentities?: { name: string; username: string }[]; cells: Record<CustomColumn, string | Money | null> };
export type CustomReport = { rows: CustomRow[]; totals: CustomRow; currency: CustomCurrency; asOf: string; options: Record<keyof ReturnType<typeof buildOverviewReport>["options"] | "creatorId", { value: string; label: string; code?: string | null; username?: string }[]>; recordCurrency: string; filterLabels: string[]; campaignCount: number; creatorDetail: boolean };
type Input = Parameters<typeof buildOverviewReport>[0];
const profitKeys = new Set<CustomColumn>(["gp", "accruedGp", "totalGp"]);
const costKeys = new Set<CustomColumn>(["cost", "accruedCost", "totalCost"]);
function emptyRow(id: string): CustomRow {
  return { id, cells: Object.fromEntries(CUSTOM_COLUMNS.map(c => [c.key, c.numeric ? {} : ""])) as CustomRow["cells"] };
}
function add(row: CustomRow, key: CustomColumn, currency: string, value: number) {
  const cell = row.cells[key] as Money;
  cell[currency] = roundMoney((cell[currency] ?? 0) + value);
}
export function buildCustomReport(input: Omit<Input, "lines"> & { lines: (Input["lines"][number] & { revenue_vat_amount?: number | null; creatorNames?: string[]; creators?: { value: string; label: string; code?: string | null; username?: string }[] })[] }, currency: CustomCurrency, recordCurrency = "", creatorId = "", creatorDetail = false): CustomReport {
  const foreign = currency === "Foreign";
  const headers = input.headers.filter(h => !h.metadata?.signing_test);
  const realIds = new Set(headers.map(h => h.id));
  input = { ...input, headers, lines: input.lines.filter(l => realIds.has(l.campaign_header_id)) };
  const unfiltered = input;
  const originalCurrency = (line: typeof input.lines[number]) => resolveLineRevenueCurrency(line, input.headers.find(h => h.id === line.campaign_header_id)?.currency_code || "EGP");
  const options = { ...buildOverviewReport({ ...input, filters: { ...input.filters, currency: foreign ? "EGP" : currency } }).options,
    creatorId: [...new Map(input.lines.flatMap(l => l.creators ?? []).map(c => [c.value, c])).values()].sort((a, b) => a.label.localeCompare(b.label)) };
  for (const key of ["clientId", "brandId", "campaignId"] as const) {
    options[key] = options[key].map(option => {
      const h = headers.find(h => (key === "clientId" ? h.client_id : key === "brandId" ? h.brand_id : h.id) === option.value);
      return { ...option, code: key === "clientId" ? h?.client?.document_number : key === "brandId" ? h?.brand?.document_number : h?.document_number };
    });
  }
  options.currency = [...new Set(["EGP", "USD", "AED", "SAR", ...input.lines.map(originalCurrency)])].sort().map(value => ({ value, label: value }));
  if (recordCurrency || creatorId) {
    const lines = input.lines.filter(line => (!recordCurrency || originalCurrency(line) === recordCurrency) && (!creatorId || line.creators?.some(c => c.value === creatorId)));
    const ids = new Set(lines.map(line => line.campaign_header_id));
    input = { ...input, lines, headers: input.headers.filter(h => ids.has(h.id)) };
  }
  const base = buildOverviewReport({ ...input, filters: { ...input.filters, currency: foreign ? "EGP" : currency } });
  const liveEvents = buildRecognitionEvents({ ...input, campaignCurrencies: new Map(input.headers.map(h => [h.id, h.currency_code || "EGP"])), today: input.filters.asOf });
  let rows = base.rows.map(source => {
    const row = emptyRow(source.id);
    for (const c of CUSTOM_BASE_COLUMNS) {
      if (!c.numeric) row.cells[c.key] = source[c.key];
      else if (!foreign) add(row, c.key, currency, source[c.key]);
    }
    const header = input.headers.find(h => h.id === source.id)!;
    row.cells.campaignNumber = formatDocumentNumberForDisplay(header.document_number) || "—";
    const lines = input.lines.filter(l => l.campaign_header_id === source.id);
    const lineIds = new Set(lines.map(line => line.id));
    const liveDates = liveEvents.filter(event => event.campaign_header_id === source.id && (!event.campaign_line_id || lineIds.has(event.campaign_line_id))).map(event => event.date).sort();
    row.cells.date = header.start_date?.slice(0, 10) || "—";
    row.cells.wentLive = liveDates.length ? "Yes" : "No";
    row.cells.wentLiveDate = liveDates[0] || "—";
    const deliverables = input.deliverables.filter(d => lineIds.has(d.campaign_line_id));
    row.cells.plannedDate = formatPlannedPostingDates(deliverables.map(d => plannedPostingDate(d.metadata)));
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))].join("; ") || "—";
    row.creatorIdentities = [...new Map(lines.flatMap(line => line.creators ?? []).map(c => [c.value, { name: c.label, username: c.username || "" }])).values()];
    row.cells.creator = unique(lines.flatMap(line => line.creatorNames ?? []));
    row.cells.platform = unique(deliverables.map(d => d.platform || "").map(p => p === "tiktok" ? "TikTok" : p.charAt(0).toUpperCase() + p.slice(1)));
    const counts = new Map<string, number>();
    for (const d of deliverables) { const label = deliverableTypeLabel(d.deliverable_type || "other"); counts.set(label, (counts.get(label) ?? 0) + Number(d.quantity ?? 1)); }
    row.cells.deliverables = [...counts].map(([label, count]) => count + " × " + label).join("; ") || "—";
    const currencies = new Set<string>();
    for (const line of lines) {
      const revenueCurrency = resolveLineRevenueCurrency(line, header.currency_code || "EGP");
      const costCurrency = resolveLineCostCurrency(line, header.currency_code || "EGP");
      currencies.add(revenueCurrency); currencies.add(costCurrency);
      if (foreign) {
        // Unit rates and cleared overrides recover each side's original entered amounts.
        const native = buildOverviewReport({ ...input, headers: [header], lines: [{ ...line, currency_code: revenueCurrency, cost_received_currency: costCurrency, revenue_fx_override: null, cost_fx_override: null }],
          rates: new Map([...input.rates.keys()].map(c => [c, 1])), filters: { ...input.filters, currency: "EGP", activity: "" } }).rows[0];
        for (const c of CUSTOM_BASE_COLUMNS) if (c.numeric && c.key !== "revenueShare") add(row, c.key, costKeys.has(c.key) ? costCurrency : revenueCurrency, native[c.key]);
      }
      const vat = Number(line.revenue_vat_amount ?? 0);
      add(row, "vat", foreign ? revenueCurrency : currency, foreign ? vat : creatorFxAmount(vat, {
        from: revenueCurrency, to: currency, sourceRateToEgp: requireReportingRate(input.rates, revenueCurrency),
        targetRateToEgp: requireReportingRate(input.rates, currency), override: line.revenue_fx_override,
      }));
    }
    const share = readRevenueShare(header.metadata);
    if (share?.mode === "amount" && (recordCurrency || creatorId)) {
      const full = buildOverviewReport({ ...unfiltered, headers: [header], filters: { ...input.filters, currency: foreign ? "EGP" : currency, activity: "" } }).rows[0];
      const fraction = full?.totalRevenue > 0 ? Math.max(0, source.totalRevenue / full.totalRevenue) : 0;
      row.cells.revenueShare = { [foreign ? share.currency : currency]: roundMoney((foreign ? share.value : source.revenueShare) * fraction) };
    } else if (foreign) {
      row.cells.revenueShare = {};
      if (share?.mode === "amount") add(row, "revenueShare", share.currency, share.value);
      else if (share) for (const [code, value] of Object.entries(row.cells.totalRevenue as Money)) add(row, "revenueShare", code, Math.max(0, value) * share.value / 100);
    }
    // Profit cannot be subtracted across unlike original currencies.
    if (foreign && currencies.size > 1) for (const key of profitKeys) row.cells[key] = null;
    return row;
  });
  if (creatorDetail) rows = rows.flatMap(campaign => {
    const header = input.headers.find(h => h.id === campaign.id)!;
    const groups = new Map<string, typeof input.lines>();
    for (const line of input.lines.filter(l => l.campaign_header_id === campaign.id)) {
      const key = (line.creators ?? []).map(c => c.value).sort().join(",") || line.creatorNames?.join(",") || "unassigned";
      groups.set(key, [...groups.get(key) ?? [], line]);
    }
    if (!groups.size) return [campaign];
    const entries = [...groups];
    const detailRows = entries.map(([key, lines]) => {
      const report = buildCustomReport({ ...input, headers: [header], lines }, currency);
      return { ...report.rows[0], id: campaign.id + ":" + key };
    });
    // Allocate a campaign-level share once, proportional to each creator's revenue.
    const weights = entries.map(([, lines]) => Math.max(0, buildOverviewReport({ ...input, headers: [header], lines, filters: { ...input.filters, currency: "EGP" } }).rows[0]?.totalRevenue ?? 0));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const share = campaign.cells.revenueShare as Money;
    detailRows.forEach(row => { row.cells.revenueShare = {}; });
    for (const [code, amount] of Object.entries(share)) {
      let cumulative = 0, allocated = 0;
      detailRows.forEach((row, i) => {
        cumulative += weights[i];
        const target = i === detailRows.length - 1 ? amount : totalWeight ? roundMoney(amount * cumulative / totalWeight) : 0;
        add(row, "revenueShare", code, roundMoney(target - allocated)); allocated = target;
      });
    }
    return detailRows;
  });
  const totals = emptyRow("totals");
  for (const row of rows) for (const c of CUSTOM_COLUMNS) if (c.numeric) {
    const cell = row.cells[c.key];
    if (cell === null) totals.cells[c.key] = null;
    else if (totals.cells[c.key] !== null && typeof cell === "object") for (const [code, value] of Object.entries(cell)) add(totals, c.key, code, value);
  }
  return { rows, totals, currency, asOf: input.filters.asOf, options, recordCurrency, campaignCount: base.rows.length, creatorDetail, filterLabels: [
    ...(["clientId", "brandId", "campaignId"] as const).flatMap(key => input.filters[key] ? [options[key].find(o => o.value === input.filters[key])?.label ?? input.filters[key]] : []),
    ...(creatorId ? ["Vendor / Creator: " + (options.creatorId.find(o => o.value === creatorId)?.label ?? creatorId)] : []),
    ...(recordCurrency ? ["Original billing currency: " + recordCurrency] : []),
  ] };
}
export function formatCustomCell(value: string | Money | null): string {
  if (value === null) return "Mixed currencies";
  if (typeof value === "string") return value;
  return Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([code, n]) => `${code} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`).join(" / ") || "—";
}
