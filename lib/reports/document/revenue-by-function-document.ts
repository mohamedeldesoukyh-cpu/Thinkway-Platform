import type { RevenueByFunctionReportData } from "@/lib/analytics/revenue-by-function/revenue-by-function-types";
import type { StyledDataRow, StyledSheetConfig } from "@/lib/reports/document/excel-report-builder";
import { buildStyledExcelBuffer } from "@/lib/reports/document/thinkway-report-excel";
import {
  formatReportAmount,
  renderThinkwayReportHtml,
  type ReportTableSection,
} from "@/lib/reports/document/thinkway-report-html";
import { sanitizeFileNameSegment } from "@/lib/reports/document/report-document-response";

function formatGpPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function renderRevenueByFunctionTable(report: RevenueByFunctionReportData): string {
  const detailRows = report.rows
    .map(
      (row) => `
      <tr>
        <td>${row.user_name}</td>
        <td>${row.business_function_label}</td>
        <td class="num">${formatReportAmount(row.revenue)}</td>
        <td class="num">${formatReportAmount(row.gp)}</td>
        <td class="num">${formatGpPercent(row.gp_percent)}</td>
      </tr>`
    )
    .join("");

  const summaryRows = report.summary_rows
    .map(
      (row) => `
      <tr class="summary-row">
        <td><strong>${row.user_name}</strong></td>
        <td>${row.business_function_label}</td>
        <td class="num"><strong>${formatReportAmount(row.revenue)}</strong></td>
        <td class="num"><strong>${formatReportAmount(row.gp)}</strong></td>
        <td class="num"><strong>${formatGpPercent(row.gp_percent)}</strong></td>
      </tr>`
    )
    .join("");

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Function</th>
          <th class="num">Revenue</th>
          <th class="num">GP</th>
          <th class="num">GP %</th>
        </tr>
      </thead>
      <tbody>${detailRows}${summaryRows}</tbody>
    </table>`;
}

function buildTableSections(report: RevenueByFunctionReportData): ReportTableSection[] {
  return [
    {
      number: 1,
      title: "Revenue by Function",
      notes: [report.period_note, report.data_scope_note],
      tableHtml: renderRevenueByFunctionTable(report),
    },
  ];
}

function buildScopeMeta(report: RevenueByFunctionReportData) {
  return [
    { label: "Year", value: String(report.year) },
    { label: "Period", value: report.period_label },
    { label: "Function", value: report.function_filter_label },
    { label: "User", value: report.user_filter_label },
    { label: "Client type", value: report.client_type_label },
    { label: "Currency", value: report.display_currency },
  ];
}

export function buildRevenueByFunctionReportHtml(
  report: RevenueByFunctionReportData
): string {
  const generatedAt = new Date();

  return renderThinkwayReportHtml({
    pageTitle: `Revenue by Function ${report.year}`,
    reportTypeLabel: "Performance Report",
    reportBadge: `Revenue by Function ${report.period_label} ${report.year}`,
    generatedAt,
    scopeMeta: buildScopeMeta(report),
    tableSections: buildTableSections(report),
    footerBrand: "thinkway.RevenueFunction",
  });
}

function buildRevenueByFunctionExcelSheet(
  report: RevenueByFunctionReportData
): StyledSheetConfig {
  const rows: StyledDataRow[] = [
    ...report.rows.map((row) => ({
      values: [
        row.user_name,
        row.business_function_label,
        row.revenue,
        row.gp,
        row.gp_percent,
      ],
    })),
    ...report.summary_rows.map((row) => ({
      values: [
        row.user_name,
        row.business_function_label,
        row.revenue,
        row.gp,
        row.gp_percent,
      ],
      kind: "total" as const,
    })),
  ];

  return {
    name: "Revenue by Function",
    header: {
      title: "Thinkway — Revenue by Function",
      entityLine: `${report.function_filter_label} · ${report.user_filter_label}`,
      meta: buildScopeMeta(report),
      generatedAt: new Date(),
      notes: [report.period_note, report.data_scope_note],
    },
    columnHeaders: [["User", "Function", "Revenue", "GP", "GP %"]],
    rows,
    columnFormats: ["text", "text", "money", "money", "percent"],
  };
}

export async function buildRevenueByFunctionReportExcelBuffer(
  report: RevenueByFunctionReportData
): Promise<Buffer> {
  return buildStyledExcelBuffer([buildRevenueByFunctionExcelSheet(report)]);
}

export function buildRevenueByFunctionFileBaseName(
  report: RevenueByFunctionReportData
): string {
  const periodSuffix = report.period_scope === "fy" ? "" : `-${report.period_scope}`;
  const userSuffix =
    report.user_filter !== "all" ? `-user-${report.user_filter.slice(0, 8)}` : "";
  return `TW-Revenue-By-Function-${report.year}${periodSuffix}-${report.function_filter}${userSuffix}-${report.client_type}-${report.display_currency}`;
}

export function buildRevenueByFunctionFileBaseNameSafe(
  report: RevenueByFunctionReportData
): string {
  return sanitizeFileNameSegment(buildRevenueByFunctionFileBaseName(report));
}
