import type { TopInfluencersReportData } from "@/lib/analytics/top-influencers/top-influencers-types";
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

function renderTopInfluencersTable(report: TopInfluencersReportData): string {
  const bodyRows = report.rows
    .map(
      (row) => `
      <tr>
        <td class="num">${row.rank}</td>
        <td>${row.influencer_name}</td>
        <td>${row.document_number || "—"}</td>
        <td class="num">${formatReportAmount(row.spending)}</td>
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
          <th>Influencer name</th>
          <th>Code</th>
          <th class="num">Spending</th>
          <th class="num">Revenue</th>
          <th class="num">GP</th>
          <th class="num">GP %</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
}

function buildTableSections(report: TopInfluencersReportData): ReportTableSection[] {
  const rankingNote = `Top ${report.limit} influencers ranked by ${report.metric_label} (${report.client_type_label} clients).`;

  return [
    {
      number: 1,
      title: "Top Influencers",
      notes: [rankingNote, report.period_note, report.data_scope_note],
      tableHtml: renderTopInfluencersTable(report),
    },
  ];
}

function buildScopeMeta(report: TopInfluencersReportData) {
  return [
    { label: "Year", value: String(report.year) },
    { label: "Period", value: report.period_label },
    { label: "Rank by", value: report.metric_label },
    { label: "Top", value: String(report.limit) },
    { label: "Client type", value: report.client_type_label },
    { label: "Currency", value: report.display_currency },
  ];
}

export function buildTopInfluencersReportHtml(report: TopInfluencersReportData): string {
  const generatedAt = new Date();

  return renderThinkwayReportHtml({
    pageTitle: `Top Influencers ${report.year}`,
    reportTypeLabel: "Performance Report",
    reportBadge: `Top ${report.limit} Influencers ${report.period_label} ${report.year}`,
    generatedAt,
    scopeMeta: buildScopeMeta(report),
    tableSections: buildTableSections(report),
    footerBrand: "thinkway.TopInfluencers",
  });
}

function buildTopInfluencersExcelSheet(report: TopInfluencersReportData): StyledSheetConfig {
  const rows: StyledDataRow[] = report.rows.map((row) => ({
    values: [
      row.rank,
      row.influencer_name,
      row.document_number,
      row.spending,
      row.revenue,
      row.gp,
      row.gp_percent,
    ],
  }));

  return {
    name: "Top Influencers",
    header: {
      title: "Thinkway — Top Influencers",
      entityLine: `Top ${report.limit} influencers by ${report.metric_label}`,
      meta: buildScopeMeta(report),
      generatedAt: new Date(),
      notes: [report.period_note, report.data_scope_note],
    },
    columnHeaders: [["#", "Influencer name", "Code", "Spending", "Revenue", "GP", "GP %"]],
    rows,
    columnFormats: ["text", "text", "text", "money", "money", "money", "percent"],
  };
}

export async function buildTopInfluencersReportExcelBuffer(
  report: TopInfluencersReportData
): Promise<Buffer> {
  return buildStyledExcelBuffer([buildTopInfluencersExcelSheet(report)]);
}

export function buildTopInfluencersFileBaseName(report: TopInfluencersReportData): string {
  const periodSuffix = report.period_scope === "fy" ? "" : `-${report.period_scope}`;
  return `TW-Top-Influencers-${report.year}${periodSuffix}-${report.metric}-${report.limit}-${report.client_type}-${report.display_currency}`;
}

export function buildTopInfluencersFileBaseNameSafe(report: TopInfluencersReportData): string {
  return sanitizeFileNameSegment(buildTopInfluencersFileBaseName(report));
}
