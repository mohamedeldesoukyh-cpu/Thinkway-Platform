import type { TopClientsReportData } from "@/lib/analytics/top-clients/top-clients-types";
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

function renderTopClientsTable(report: TopClientsReportData): string {
  const bodyRows = report.rows
    .map(
      (row) => `
      <tr>
        <td class="num">${row.rank}</td>
        <td>${row.client_name}</td>
        <td class="num">${formatReportAmount(row.revenue)}</td>
        <td class="num">${formatReportAmount(row.gp)}</td>
        <td class="num">${formatGpPercent(row.gp_percent)}</td>
      </tr>`
    )
    .join("");

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Client name</th>
          <th class="num">Revenue</th>
          <th class="num">GP</th>
          <th class="num">GP %</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
}

function buildTableSections(report: TopClientsReportData): ReportTableSection[] {
  const rankingNote = `Top ${report.limit} clients ranked by ${report.metric_label} (${report.client_type_label} clients).`;

  return [
    {
      number: 1,
      title: "Top Clients",
      notes: [rankingNote, report.period_note, report.data_scope_note],
      tableHtml: renderTopClientsTable(report),
    },
  ];
}

function buildScopeMeta(report: TopClientsReportData) {
  return [
    { label: "Year", value: String(report.year) },
    { label: "Period", value: report.period_label },
    { label: "Rank by", value: report.metric_label },
    { label: "Top", value: String(report.limit) },
    { label: "Client type", value: report.client_type_label },
    { label: "Currency", value: report.display_currency },
  ];
}

export function buildTopClientsReportHtml(report: TopClientsReportData): string {
  const generatedAt = new Date();

  return renderThinkwayReportHtml({
    pageTitle: `Top Clients ${report.year}`,
    reportTypeLabel: "Performance Report",
    reportBadge: `Top ${report.limit} Clients ${report.period_label} ${report.year}`,
    generatedAt,
    scopeMeta: buildScopeMeta(report),
    tableSections: buildTableSections(report),
    footerBrand: "thinkway.TopClients",
  });
}

function buildTopClientsExcelSheet(report: TopClientsReportData): StyledSheetConfig {
  const rows: StyledDataRow[] = report.rows.map((row) => ({
    values: [row.rank, row.client_name, row.revenue, row.gp, row.gp_percent],
  }));

  return {
    name: "Top Clients",
    header: {
      title: "Thinkway — Top Clients",
      entityLine: `Top ${report.limit} clients by ${report.metric_label}`,
      meta: buildScopeMeta(report),
      generatedAt: new Date(),
      notes: [report.period_note, report.data_scope_note],
    },
    columnHeaders: [["#", "Client name", "Revenue", "GP", "GP %"]],
    rows,
    columnFormats: ["text", "text", "money", "money", "percent"],
  };
}

export async function buildTopClientsReportExcelBuffer(
  report: TopClientsReportData
): Promise<Buffer> {
  return buildStyledExcelBuffer([buildTopClientsExcelSheet(report)]);
}

export function buildTopClientsFileBaseName(report: TopClientsReportData): string {
  const periodSuffix = report.period_scope === "fy" ? "" : `-${report.period_scope}`;
  return `TW-Top-Clients-${report.year}${periodSuffix}-${report.metric}-${report.limit}-${report.client_type}-${report.display_currency}`;
}

export function buildTopClientsFileBaseNameSafe(report: TopClientsReportData): string {
  return sanitizeFileNameSegment(buildTopClientsFileBaseName(report));
}
