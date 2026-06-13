import type { PnlComparisonReportData, PnlMetricKey } from "@/lib/analytics/pnl/pnl-report-types";
import type { ColumnFormat, HeaderMerge, StyledDataRow, StyledSheetConfig } from "@/lib/reports/document/excel-report-builder";
import { buildStyledExcelBuffer } from "@/lib/reports/document/thinkway-report-excel";
import {
  formatReportAmount,
  formatVariancePercent,
  renderThinkwayReportHtml,
  type ReportTableSection,
} from "@/lib/reports/document/thinkway-report-html";
import { sanitizeFileNameSegment } from "@/lib/reports/document/report-document-response";

const EMPHASIS_ROWS = new Set<PnlMetricKey>(["gp", "gp_after_vr"]);

function buildComparisonHeaderRow(report: PnlComparisonReportData): string {
  const periodHeaders = report.columns
    .map(
      (col) =>
        `<th colspan="4" class="num">${col.label}</th>`
    )
    .join("");
  return `<tr><th>P&amp;L</th>${periodHeaders}<th colspan="4" class="num">Total</th></tr>`;
}

function buildSubHeaderRow(report: PnlComparisonReportData): string {
  const subHeaders = (year: number) =>
    `<th class="num">${year}</th><th class="num">${report.prior_year === year ? report.prior_year : report.current_year}</th><th class="num">Var $</th><th class="num">Var %</th>`;

  const periodSubHeaders = report.columns
    .map(() => {
      const current = report.current_year;
      const prior = report.prior_year;
      return `<th class="num">${current}</th><th class="num">${prior}</th><th class="num">Var $</th><th class="num">Var %</th>`;
    })
    .join("");

  return `<tr><th></th>${periodSubHeaders}<th class="num">${report.current_year}</th><th class="num">${report.prior_year}</th><th class="num">Var $</th><th class="num">Var %</th></tr>`;
}

function renderComparisonCells(
  cell: { current: number; prior: number; variance_amount: number; variance_percent: number | null }
): string {
  return `
    <td class="num">${formatReportAmount(cell.current)}</td>
    <td class="num">${formatReportAmount(cell.prior)}</td>
    <td class="num muted">${formatReportAmount(cell.variance_amount)}</td>
    <td class="num muted">${formatVariancePercent(cell.variance_percent)}</td>`;
}

function renderPnlComparisonTable(report: PnlComparisonReportData): string {
  const bodyRows = report.metric_rows
    .map((row) => {
      const rowClass = EMPHASIS_ROWS.has(row.key) ? "emphasis" : "";
      const periodCells = report.columns
        .map((col) => renderComparisonCells(row.cells[col.key]!))
        .join("");
      const totalCells = renderComparisonCells(row.total);
      return `<tr class="${rowClass}"><td>${row.label}</td>${periodCells}${totalCells}</tr>`;
    })
    .join("");

  return `
    <table class="data-table">
      <thead>
        ${buildComparisonHeaderRow(report)}
        ${buildSubHeaderRow(report)}
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
}

function renderClientBreakdownTable(report: PnlComparisonReportData): string | null {
  const breakdownKey = `${report.current_year}:gp_after_vr:total`;
  const clients = report.client_breakdowns[breakdownKey];
  if (!clients || clients.length === 0) return null;

  const rows = clients
    .map(
      (client) => `
      <tr>
        <td>${client.client_name}</td>
        <td class="num">${formatReportAmount(client.revenue)}</td>
        <td class="num">${formatReportAmount(client.ur_rev)}</td>
        <td class="num">${formatReportAmount(client.agency_fees)}</td>
        <td class="num">${formatReportAmount(client.billable_revenue)}</td>
        <td class="num">${formatReportAmount(client.cost)}</td>
        <td class="num">${formatReportAmount(client.gp)}</td>
        <td class="num">${formatReportAmount(client.vr_refund)}</td>
        <td class="num">${formatReportAmount(client.gp_after_vr)}</td>
        <td class="num">${client.margin_percent.toFixed(1)}%</td>
      </tr>`
    )
    .join("");

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Client</th>
          <th class="num">Rev</th>
          <th class="num">UR Rev</th>
          <th class="num">AF</th>
          <th class="num">Total Rev</th>
          <th class="num">Cost</th>
          <th class="num">GP</th>
          <th class="num">VR Refund</th>
          <th class="num">GP after VR</th>
          <th class="num">Margin</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function buildPnlTableSections(report: PnlComparisonReportData): ReportTableSection[] {
  const sections: ReportTableSection[] = [
    {
      number: 1,
      title: "P&L Comparison",
      notes: [report.period_note, report.data_scope_note],
      tableHtml: renderPnlComparisonTable(report),
    },
  ];

  const clientTable = renderClientBreakdownTable(report);
  if (clientTable) {
    sections.push({
      number: 2,
      title: "Client Breakdown",
      notes: [`Full-year ${report.current_year} client totals (GP after VR).`],
      tableHtml: clientTable,
    });
  }

  return sections;
}

export function buildPnlReportHtml(report: PnlComparisonReportData): string {
  const generatedAt = new Date();
  return renderThinkwayReportHtml({
    pageTitle: `P&L ${report.current_year}`,
    reportTypeLabel: "Performance Report",
    reportBadge: `P&L ${report.period_label} ${report.current_year}`,
    generatedAt,
    footerBrand: "thinkway.PnL",
    scopeMeta: [
      { label: "Current year", value: String(report.current_year) },
      { label: "Compare year", value: String(report.prior_year) },
      { label: "Period", value: report.period_label },
      { label: "Client type", value: report.client_type_label },
      { label: "Currency", value: report.display_currency },
    ],
    tableSections: buildPnlTableSections(report),
  });
}

const PNL_PERIOD_COLUMN_FORMATS: ColumnFormat[] = ["money", "money", "money", "percent"];

function buildPnlComparisonColumnFormats(report: PnlComparisonReportData): ColumnFormat[] {
  const formats: ColumnFormat[] = ["text"];
  for (let i = 0; i < report.columns.length + 1; i += 1) {
    formats.push(...PNL_PERIOD_COLUMN_FORMATS);
  }
  return formats;
}

function buildPnlComparisonHeaderMerges(report: PnlComparisonReportData): HeaderMerge[] {
  const merges: HeaderMerge[] = [];
  let col = 1;

  for (let i = 0; i < report.columns.length; i += 1) {
    merges.push({ row: 0, col, rowSpan: 1, colSpan: 4 });
    col += 4;
  }

  merges.push({ row: 0, col, rowSpan: 1, colSpan: 4 });
  return merges;
}

function buildPnlComparisonSheet(report: PnlComparisonReportData): StyledSheetConfig {
  const headerRow1: (string | number)[] = ["P&L"];
  for (const col of report.columns) {
    headerRow1.push(col.label, "", "", "");
  }
  headerRow1.push("Total", "", "", "");

  const headerRow2: (string | number)[] = [""];
  for (let i = 0; i < report.columns.length + 1; i += 1) {
    headerRow2.push(report.current_year, report.prior_year, "Var $", "Var %");
  }

  const rows: StyledDataRow[] = report.metric_rows.map((row) => ({
    values: [
      row.label,
      ...report.columns.flatMap((col) => {
        const cell = row.cells[col.key]!;
        return [cell.current, cell.prior, cell.variance_amount, cell.variance_percent ?? ""];
      }),
      row.total.current,
      row.total.prior,
      row.total.variance_amount,
      row.total.variance_percent ?? "",
    ],
    kind: EMPHASIS_ROWS.has(row.key) ? "emphasis" : "data",
  }));

  return {
    name: "P&L Comparison",
    header: {
      title: "Thinkway — P&L Report",
      meta: [
        { label: "Year", value: String(report.current_year) },
        { label: "Compare year", value: String(report.prior_year) },
        { label: "Period", value: report.period_label },
        { label: "Client type", value: report.client_type_label },
        { label: "Currency", value: report.display_currency },
      ],
      generatedAt: new Date(),
      notes: [report.period_note, report.data_scope_note],
    },
    columnHeaders: [headerRow1, headerRow2],
    headerMerges: buildPnlComparisonHeaderMerges(report),
    rows,
    columnFormats: buildPnlComparisonColumnFormats(report),
  };
}

function buildPnlClientBreakdownSheet(
  report: PnlComparisonReportData
): StyledSheetConfig | null {
  const breakdownKey = `${report.current_year}:gp_after_vr:total`;
  const clients = report.client_breakdowns[breakdownKey];
  if (!clients || clients.length === 0) return null;

  const rows: StyledDataRow[] = clients.map((client) => ({
    values: [
      client.client_name,
      client.revenue,
      client.ur_rev,
      client.agency_fees,
      client.billable_revenue,
      client.cost,
      client.gp,
      client.vr_refund,
      client.gp_after_vr,
      client.margin_percent,
    ],
  }));

  return {
    name: "Client breakdown",
    header: {
      title: "Thinkway — Client Breakdown",
      meta: [
        { label: "Year", value: String(report.current_year) },
        { label: "Currency", value: report.display_currency },
      ],
      generatedAt: new Date(),
      notes: [`Full-year ${report.current_year} client totals (GP after VR).`],
    },
    columnHeaders: [
      [
        "Client",
        "Rev",
        "UR Rev",
        "AF",
        "Total Rev",
        "Cost",
        "GP",
        "VR Refund",
        "GP after VR",
        "Margin %",
      ],
    ],
    rows,
    columnFormats: ["text", "money", "money", "money", "money", "money", "money", "money", "money", "percent"],
  };
}

export async function buildPnlReportExcelBuffer(report: PnlComparisonReportData): Promise<Buffer> {
  const sheets: StyledSheetConfig[] = [buildPnlComparisonSheet(report)];

  const clientSheet = buildPnlClientBreakdownSheet(report);
  if (clientSheet) {
    sheets.push(clientSheet);
  }

  return buildStyledExcelBuffer(sheets);
}

export function buildPnlReportFileBaseName(report: PnlComparisonReportData): string {
  return `TW-PnL-${report.current_year}-${report.display_currency}`;
}

export function buildPnlReportFileBaseNameSafe(report: PnlComparisonReportData): string {
  return sanitizeFileNameSegment(buildPnlReportFileBaseName(report));
}
