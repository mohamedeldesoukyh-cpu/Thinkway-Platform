import { filterClientProfitabilityRows } from "@/lib/analytics/client-profitability/build-client-profitability-report";
import type { ClientProfitabilityReportData } from "@/lib/analytics/client-profitability/client-profitability-types";
import type { StyledDataRow, StyledSheetConfig } from "@/lib/reports/document/excel-report-builder";
import { buildStyledExcelBuffer } from "@/lib/reports/document/thinkway-report-excel";
import {
  formatReportAmount,
  renderThinkwayReportHtml,
  type ReportTableSection,
} from "@/lib/reports/document/thinkway-report-html";
import { sanitizeFileNameSegment } from "@/lib/reports/document/report-document-response";

function formatMarginPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function renderClientProfitabilityTable(report: ClientProfitabilityReportData): string {
  const rows = filterClientProfitabilityRows(report);

  const bodyRows = rows
    .map(
      (row) => `
      <tr>
        <td>${row.client_code ?? "—"}</td>
        <td>${row.group_name ?? "—"}</td>
        <td>${row.client_name}</td>
        <td class="num">${formatReportAmount(row.revenue)}</td>
        <td class="num">${formatReportAmount(row.gp_after_vr)}</td>
        <td class="num">${formatMarginPercent(row.margin_percent)}</td>
      </tr>`
    )
    .join("");

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Group</th>
          <th>Legal entity</th>
          <th class="num">Revenue</th>
          <th class="num">GP</th>
          <th class="num">Margin %</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
}

function buildTableSections(report: ClientProfitabilityReportData): ReportTableSection[] {
  const comparisonNote =
    report.selected_client_ids.length > 0
      ? `Comparing ${report.selected_client_ids.length} selected legal entit${report.selected_client_ids.length === 1 ? "y" : "ies"}.`
      : "All legal entities sorted by GP (after VR) descending.";

  return [
    {
      number: 1,
      title: "Profitability by Client",
      notes: [comparisonNote, report.period_note, report.data_scope_note],
      tableHtml: renderClientProfitabilityTable(report),
    },
  ];
}

function selectedClientsLabel(report: ClientProfitabilityReportData): string | null {
  if (report.selected_client_ids.length === 0) return null;
  const names = filterClientProfitabilityRows(report).map((row) => row.client_name);
  return names.join(", ");
}

export function buildClientProfitabilityReportHtml(
  report: ClientProfitabilityReportData
): string {
  const generatedAt = new Date();
  const selectedLabel = selectedClientsLabel(report);

  const scopeMeta = [
    { label: "Year", value: String(report.year) },
    { label: "Period", value: report.period_label },
    { label: "Client type", value: report.client_type_label },
    { label: "Currency", value: report.display_currency },
  ];

  if (selectedLabel) {
    scopeMeta.push({ label: "Selected clients", value: selectedLabel });
  }

  return renderThinkwayReportHtml({
    pageTitle: `Profitability by Client ${report.year}`,
    reportTypeLabel: "Performance Report",
    reportBadge: `Profitability ${report.period_label} ${report.year}`,
    generatedAt,
    scopeMeta,
    tableSections: buildTableSections(report),
    footerBrand: "thinkway.Profitability",
  });
}

function profitabilityEntityLine(report: ClientProfitabilityReportData): string {
  if (report.selected_client_ids.length === 0) {
    return "All legal entities";
  }

  return filterClientProfitabilityRows(report)
    .map((row) =>
      row.client_code ? `${row.client_code} — ${row.client_name}` : row.client_name
    )
    .join("   |   ");
}

function buildClientProfitabilityExcelSheet(
  report: ClientProfitabilityReportData
): StyledSheetConfig {
  const rows: StyledDataRow[] = filterClientProfitabilityRows(report).map((row) => ({
    values: [
      row.client_code ?? "",
      row.group_name ?? "",
      row.client_name,
      row.revenue,
      row.gp_after_vr,
      row.margin_percent,
    ],
  }));

  return {
    name: "Profitability",
    header: {
      title: "Thinkway — Profitability by Client",
      entityLine: profitabilityEntityLine(report),
      meta: [
        { label: "Year", value: String(report.year) },
        { label: "Period", value: report.period_label },
        { label: "Client type", value: report.client_type_label },
        { label: "Currency", value: report.display_currency },
      ],
      generatedAt: new Date(),
      notes: [report.period_note, report.data_scope_note],
    },
    columnHeaders: [["Code", "Group", "Legal entity", "Revenue", "GP", "Margin %"]],
    rows,
    columnFormats: ["text", "text", "text", "money", "money", "percent"],
  };
}

export async function buildClientProfitabilityReportExcelBuffer(
  report: ClientProfitabilityReportData
): Promise<Buffer> {
  return buildStyledExcelBuffer([buildClientProfitabilityExcelSheet(report)]);
}

export function buildClientProfitabilityFileBaseName(
  report: ClientProfitabilityReportData
): string {
  const suffix =
    report.selected_client_ids.length > 0
      ? `-compare-${report.selected_client_ids.length}`
      : "";
  return `TW-Client-Profitability-${report.year}-${report.display_currency}${suffix}`;
}

export function buildClientProfitabilityFileBaseNameSafe(
  report: ClientProfitabilityReportData
): string {
  return sanitizeFileNameSegment(buildClientProfitabilityFileBaseName(report));
}
