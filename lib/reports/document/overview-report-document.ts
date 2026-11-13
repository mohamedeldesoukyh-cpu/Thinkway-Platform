import { OVERVIEW_COLUMNS, orderOverviewColumns, type OverviewReport, type OverviewRow } from "@/lib/reports/overview/overview-report";
import { buildStyledExcelBuffer } from "./thinkway-report-excel";
import { formatReportAmountAlways, renderThinkwayReportHtml } from "./thinkway-report-html";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const notes = ["Actual = went-live activity; highlighted Acc. columns = activity not yet live. Blue Total columns = actual + accrued.", "GP = revenue − cost. Rev. Share = campaign revenue share; GP after RS = Total GP − Rev. Share. Amounts exclude VAT. Campaign dates filter start dates. As-of uses current commercial values, not a historical accounting snapshot."];
function metadata(report: OverviewReport) {
  const f = report.filters;
  const result = [{ label: "Currency", value: f.currency }, { label: "Went live as of", value: f.asOf }, { label: "Campaigns", value: String(report.rows.length) }];
  for (const [key, label] of [["groupId", "Group"], ["clientId", "Client"], ["brandId", "Brand"], ["campaignId", "Campaign"], ["status", "Status"]] as const) {
    if (f[key]) result.push({ label, value: report.options[key].find(o => o.value === f[key])?.label ?? f[key] });
  }
  for (const [key,label] of [["from", "Campaign start from"], ["to", "Campaign start to"], ["q", "Search"], ["clientType", "Client type"], ["activity", "Activity"]] as const) if (f[key]) result.push({ label, value: f[key] });
  return result;
}
export function buildOverviewReportHtml(report: OverviewReport) {
  const columns = orderOverviewColumns(report.filters.columns).map(key => OVERVIEW_COLUMNS.find(c => c.key === key)!);
  const firstText = columns.findIndex(c => !c.numeric);
  const row = (r: OverviewRow, total = false) => `<tr${total ? ' class="total-row"' : ""}>${columns.map((c,i) => `<td class="${c.numeric ? "num" : ""} ${c.accrued ? "accrued" : c.total ? "combined-total" : ""}">${c.numeric ? formatReportAmountAlways(r[c.key]) : escape(total ? i === firstText ? "Totals" : "" : r[c.key])}</td>`).join("")}</tr>`;
  const table = `<style>@page{size:A4 landscape} :root{--page-w:297mm;--page-h:210mm} @media print{.page{width:297mm!important;min-height:210mm!important;overflow:visible}.section{page-break-inside:auto;break-inside:auto}.doc-footer{position:relative!important}} .data-table{table-layout:fixed;width:100%}.data-table th,.data-table td{padding:8px 6px;font-size:10px;overflow-wrap:anywhere}.data-table .accrued{background:#fffbeb!important;color:#451a03!important}.data-table th.accrued{background:#fde68a!important} .data-table .combined-total{background:#f0f9ff!important;color:#082f49!important;font-weight:600}.data-table th.combined-total{background:#e0f2fe!important} thead{display:table-header-group} tfoot{display:table-row-group} tr{break-inside:avoid}</style>
    <table class="data-table"><thead><tr>${columns.map(c => `<th class="${c.numeric ? "num" : ""} ${c.accrued ? "accrued" : c.total ? "combined-total" : ""}">${escape(c.label)}</th>`).join("")}</tr></thead><tbody>${report.rows.length ? report.rows.map(r => row(r)).join("") : `<tr><td colspan="${columns.length}">No campaigns match these filters.</td></tr>`}</tbody><tfoot>${row(report.totals, true)}</tfoot></table>`;
  return renderThinkwayReportHtml({ pageTitle: "Overview Report", reportTypeLabel: "Overview Report", reportBadge: "Actual & Accrued", generatedAt: new Date(), footerBrand: "thinkway.Overview", scopeMeta: metadata(report), tableSections: [{ number: 1, title: "Campaign overview", notes, tableHtml: table }] });
}
export async function buildOverviewReportExcelBuffer(report: OverviewReport) {
  const columns = orderOverviewColumns(report.filters.columns).map(key => OVERVIEW_COLUMNS.find(c => c.key === key)!);
  const firstText = columns.findIndex(c => !c.numeric);
  return buildStyledExcelBuffer([{
    name: "Overview", header: { title: "Thinkway — Overview Report", meta: metadata(report), generatedAt: new Date(), notes },
    columnHeaders: [columns.map(c => c.label)], columnFormats: columns.map(c => c.numeric ? "money" : "text"),
    totalColumns: columns.flatMap((c,i) => c.total ? [i] : []),
    accruedColumns: columns.flatMap((c,i) => c.accrued ? [i] : []),
    rows: [...report.rows.map(r => ({ values: columns.map(c => r[c.key]) })), { kind: "total", values: columns.map((c,i) => c.numeric ? report.totals[c.key] : i === firstText ? "Totals" : "") }],
  }]);
}

