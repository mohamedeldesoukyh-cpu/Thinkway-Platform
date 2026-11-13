import { buildOverviewReport, OVERVIEW_COLUMNS } from "@/lib/reports/overview/overview-report";
import { creatorFxAmount } from "@/lib/commercial/creator-fx";
import { resolveLineCostCurrency, resolveLineRevenueCurrency, requireReportingRate } from "@/lib/campaigns/campaign-display-financials";
import { roundMoney } from "@/lib/analytics/aggregations/round";

const keys = ["group", "client", "brand", "campaign", "revenue", "accruedRevenue", "cost", "accruedCost", "gp", "accruedGp", "totalRevenue", "totalCost", "totalGp"] as const;
const CUSTOM_BASE_COLUMNS = OVERVIEW_COLUMNS.filter((c): c is Extract<typeof OVERVIEW_COLUMNS[number], { key: typeof keys[number] }> => (keys as readonly string[]).includes(c.key));
export const CUSTOM_COLUMNS = [...CUSTOM_BASE_COLUMNS, { key: "vat", label: "VAT", numeric: true, accrued: false }] as const;
export type CustomColumn = typeof keys[number] | "vat";
export const CUSTOM_CURRENCIES = ["EGP", "USD", "AED", "SAR", "Foreign"] as const;
export type CustomCurrency = typeof CUSTOM_CURRENCIES[number];
export type Money = Record<string, number>;
export type CustomRow = { id: string; cells: Record<CustomColumn, string | Money | null> };
export type CustomReport = { rows: CustomRow[]; totals: CustomRow; currency: CustomCurrency; asOf: string };
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
export function buildCustomReport(input: Input & { lines: (Input["lines"][number] & { revenue_vat_amount?: number | null })[] }, currency: CustomCurrency): CustomReport {
  const foreign = currency === "Foreign";
  const base = buildOverviewReport({ ...input, filters: { ...input.filters, currency: foreign ? "EGP" : currency } });
  const rows = base.rows.map(source => {
    const row = emptyRow(source.id);
    for (const c of CUSTOM_BASE_COLUMNS) {
      if (!c.numeric) row.cells[c.key] = source[c.key];
      else if (!foreign) add(row, c.key, currency, source[c.key]);
    }
    const header = input.headers.find(h => h.id === source.id)!;
    const lines = input.lines.filter(l => l.campaign_header_id === source.id);
    const currencies = new Set<string>();
    for (const line of lines) {
      const revenueCurrency = resolveLineRevenueCurrency(line, header.currency_code || "EGP");
      const costCurrency = resolveLineCostCurrency(line, header.currency_code || "EGP");
      currencies.add(revenueCurrency); currencies.add(costCurrency);
      if (foreign) {
        // Unit rates and cleared overrides recover each side's original entered amounts.
        const native = buildOverviewReport({ ...input, headers: [header], lines: [{ ...line, currency_code: revenueCurrency, cost_received_currency: costCurrency, revenue_fx_override: null, cost_fx_override: null }],
          rates: new Map([...input.rates.keys()].map(c => [c, 1])), filters: { ...input.filters, currency: "EGP", activity: "" } }).rows[0];
        for (const c of CUSTOM_BASE_COLUMNS) if (c.numeric) add(row, c.key, costKeys.has(c.key) ? costCurrency : revenueCurrency, native[c.key]);
      }
      const vat = Number(line.revenue_vat_amount ?? 0);
      add(row, "vat", foreign ? revenueCurrency : currency, foreign ? vat : creatorFxAmount(vat, {
        from: revenueCurrency, to: currency, sourceRateToEgp: requireReportingRate(input.rates, revenueCurrency),
        targetRateToEgp: requireReportingRate(input.rates, currency), override: line.revenue_fx_override,
      }));
    }
    // Profit cannot be subtracted across unlike original currencies.
    if (foreign && currencies.size > 1) for (const key of profitKeys) row.cells[key] = null;
    return row;
  });
  const totals = emptyRow("totals");
  for (const row of rows) for (const c of CUSTOM_COLUMNS) if (c.numeric) {
    const cell = row.cells[c.key];
    if (cell === null) totals.cells[c.key] = null;
    else if (totals.cells[c.key] !== null && typeof cell === "object") for (const [code, value] of Object.entries(cell)) add(totals, c.key, code, value);
  }
  return { rows, totals, currency, asOf: input.filters.asOf };
}
export function formatCustomCell(value: string | Money | null): string {
  if (value === null) return "Mixed currencies";
  if (typeof value === "string") return value;
  return Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([code, n]) => `${code} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`).join(" / ") || "—";
}
