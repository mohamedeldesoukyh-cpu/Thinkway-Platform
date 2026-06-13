import type { VrReportData } from "@/lib/analytics/vr-report/vr-report-types";
import type { StyledDataRow, StyledSheetConfig } from "@/lib/reports/document/excel-report-builder";
import { buildStyledExcelBuffer } from "@/lib/reports/document/thinkway-report-excel";
import {
  formatReportAmount,
  renderThinkwayReportHtml,
  type ReportTableSection,
} from "@/lib/reports/document/thinkway-report-html";
import { sanitizeFileNameSegment } from "@/lib/reports/document/report-document-response";

function formatVrPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function renderVrReportTable(report: VrReportData): string {
  const monthHeaders = report.columns
    .map((column) => `<th class="num">${column.label} VR</th>`)
    .join("");

  const bodyRows = report.rows
    .map((row) => {
      const monthCells = report.columns
        .map((column) => {
          const value = row.monthly_vr[column.key] ?? 0;
          return `<td class="num">${value === 0 ? "—" : formatReportAmount(value)}</td>`;
        })
        .join("");

      return `
      <tr>
        <td>${row.group_name}</td>
        <td>${row.client_name}</td>
        <td class="num">${row.revenue === 0 ? "—" : formatReportAmount(row.revenue)}</td>
        <td class="num">${formatVrPercent(row.vr_rate_percent)}</td>
        ${monthCells}
        <td class="num">${row.total_vr === 0 ? "—" : formatReportAmount(row.total_vr)}</td>
      </tr>`;
    })
    .join("");

  const totalsMonthCells = report.columns
    .map((column) => {
      const value = report.totals.monthly_vr[column.key] ?? 0;
      return `<td class="num"><strong>${value === 0 ? "—" : formatReportAmount(value)}</strong></td>`;
    })
    .join("");

  const totalsRow = `
    <tr class="totals-row">
      <td colspan="2"><strong>Total</strong></td>
      <td class="num"><strong>${formatReportAmount(report.totals.revenue)}</strong></td>
      <td class="num">—</td>
      ${totalsMonthCells}
      <td class="num"><strong>${formatReportAmount(report.totals.total_vr)}</strong></td>
    </tr>`;

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Group</th>
          <th>Client</th>
          <th class="num">Revenue</th>
          <th class="num">VR %</th>
          ${monthHeaders}
          <th class="num">Total VR</th>
        </tr>
      </thead>
      <tbody>${bodyRows}${totalsRow}</tbody>
    </table>`;
}

function buildTableSections(report: VrReportData): ReportTableSection[] {
  return [
    {
      number: 1,
      title: "VR Report",
      notes: [report.period_note, report.data_scope_note],
      tableHtml: renderVrReportTable(report),
    },
  ];
}

function buildScopeMeta(report: VrReportData) {
  return [
    { label: "Year", value: String(report.year) },
    { label: "Period", value: report.period_label },
    { label: "Client type", value: report.client_type_label },
    { label: "Currency", value: report.display_currency },
  ];
}

export function buildVrReportHtml(report: VrReportData): string {
  const generatedAt = new Date();

  return renderThinkwayReportHtml({
    pageTitle: `VR Report ${report.year}`,
    reportTypeLabel: "VR Report",
    reportBadge: `VR ${report.period_label} ${report.year}`,
    generatedAt,
    scopeMeta: buildScopeMeta(report),
    tableSections: buildTableSections(report),
    footerBrand: "thinkway.VR",
  });
}

function buildVrReportExcelSheet(report: VrReportData): StyledSheetConfig {
  const monthHeaders = report.columns.map((column) => `${column.label} VR`);

  const rows: StyledDataRow[] = report.rows.map((row) => ({
    values: [
      row.group_name,
      row.client_name,
      row.revenue,
      row.vr_rate_percent / 100,
      ...report.columns.map((column) => row.monthly_vr[column.key] ?? 0),
      row.total_vr,
    ],
  }));

  rows.push({
    values: [
      "Total",
      "",
      report.totals.revenue,
      null,
      ...report.columns.map((column) => report.totals.monthly_vr[column.key] ?? 0),
      report.totals.total_vr,
    ],
    kind: "total",
  });

  return {
    name: "VR Report",
    header: {
      title: "Thinkway — VR Report",
      entityLine: `VR amounts by legal entity — ${report.period_label} ${report.year}`,
      meta: buildScopeMeta(report),
      generatedAt: new Date(),
      notes: [report.period_note, report.data_scope_note],
    },
    columnHeaders: [["Group", "Client", "Revenue", "VR %", ...monthHeaders, "Total VR"]],
    rows,
    columnFormats: [
      "text",
      "text",
      "money",
      "percent",
      ...report.columns.map(() => "money" as const),
      "money",
    ],
  };
}

export async function buildVrReportExcelBuffer(report: VrReportData): Promise<Buffer> {
  return buildStyledExcelBuffer([buildVrReportExcelSheet(report)]);
}

export function buildVrReportFileBaseName(report: VrReportData): string {
  const periodSuffix = report.period_scope === "fy" ? "" : `-${report.period_scope}`;
  return `TW-VR-${report.year}${periodSuffix}-${report.display_currency}`;
}

export function buildVrReportFileBaseNameSafe(report: VrReportData): string {
  return sanitizeFileNameSegment(buildVrReportFileBaseName(report));
}
