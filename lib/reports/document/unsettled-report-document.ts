import type { UnsettledReportData } from "@/lib/reports/statements/unsettled-types";
import {
  formatEntityScopeLine,
  formatGroupClientLabel,
} from "@/lib/reports/statements/entity-label";
import type { StyledDataRow, StyledSheetConfig } from "@/lib/reports/document/excel-report-builder";
import { buildStyledExcelBuffer } from "@/lib/reports/document/thinkway-report-excel";
import {
  formatReportAmountAlways,
  renderThinkwayReportHtml,
  type ReportTableSection,
} from "@/lib/reports/document/thinkway-report-html";
import { sanitizeFileNameSegment } from "@/lib/reports/document/report-document-response";

function renderUnsettledLedgerTable(report: UnsettledReportData): string {
  const rows =
    report.lines.length === 0
      ? `<tr><td colspan="6" class="muted">No unsettled invoices for this client.</td></tr>`
      : report.lines
          .map(
            (line) => `
        <tr>
          <td>${line.date}</td>
          <td>${line.document_number}</td>
          <td>${line.campaign_name ?? "—"}</td>
          <td class="num">${line.debit > 0 ? formatReportAmountAlways(line.debit) : "—"}</td>
          <td class="num">—</td>
          <td class="num">${formatReportAmountAlways(line.balance)}</td>
        </tr>`
          )
          .join("");

  const totalsRow =
    report.lines.length > 0
      ? `
      <tr class="total-row">
        <td colspan="3">Total outstanding</td>
        <td class="num">${formatReportAmountAlways(report.totals.total_debit)}</td>
        <td class="num">—</td>
        <td class="num">${formatReportAmountAlways(report.totals.closing_balance)}</td>
      </tr>`
      : "";

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Invoice</th>
          <th>Campaign</th>
          <th class="num">Outstanding</th>
          <th class="num">Credit</th>
          <th class="num">Balance</th>
        </tr>
      </thead>
      <tbody>${rows}${totalsRow}</tbody>
    </table>`;
}

function buildUnsettledTableSections(report: UnsettledReportData): ReportTableSection[] {
  return [
    {
      number: 1,
      title: "Unsettled invoices",
      notes: ["Open invoices with outstanding balance. Payment credits are not included."],
      tableHtml: renderUnsettledLedgerTable(report),
    },
  ];
}

export function buildUnsettledReportHtml(report: UnsettledReportData): string {
  const entityName = report.entity_name ?? "Not selected";
  const generatedAt = new Date();
  const entityScopeValue = formatEntityScopeLine(
    report.entity_code,
    report.group_name,
    entityName
  );
  const pageTitleName =
    formatGroupClientLabel(report.group_name, entityName) ?? entityName;

  return renderThinkwayReportHtml({
    pageTitle: `Statement of Unsettled — ${pageTitleName}`,
    reportTypeLabel: "Statement of Unsettled",
    reportBadge: report.entity_code ?? report.entity_name ?? "Unsettled",
    generatedAt,
    footerBrand: "thinkway.SOA",
    scopeMeta: [
      { label: "Legal entity", value: entityScopeValue },
      ...(report.group_name ? [{ label: "Group", value: report.group_name }] : []),
      { label: "Currency", value: report.currency },
    ],
    tableSections: buildUnsettledTableSections(report),
  });
}

function buildUnsettledEntityLine(report: UnsettledReportData): string {
  const entityName = report.entity_name ?? "Not selected";
  return formatEntityScopeLine(report.entity_code, report.group_name, entityName);
}

function buildUnsettledExcelSheet(report: UnsettledReportData): StyledSheetConfig {
  const rows: StyledDataRow[] = report.lines.map((line) => ({
    values: [
      line.date,
      line.document_number,
      line.campaign_name ?? "",
      line.debit,
      line.credit,
      line.balance,
    ],
  }));

  if (report.lines.length > 0) {
    rows.push({
      values: [
        "Total outstanding",
        "",
        "",
        report.totals.total_debit,
        report.totals.total_credit,
        report.totals.closing_balance,
      ],
      kind: "total",
    });
  }

  return {
    name: "Unsettled",
    header: {
      title: "Thinkway — Statement of Unsettled",
      entityLine: buildUnsettledEntityLine(report),
      meta: [{ label: "Currency", value: report.currency }],
      generatedAt: new Date(),
    },
    columnHeaders: [["Date", "Invoice", "Campaign", "Outstanding", "Credit", "Balance"]],
    rows,
    columnFormats: ["text", "text", "text", "money", "money", "money"],
  };
}

export async function buildUnsettledReportExcelBuffer(
  report: UnsettledReportData
): Promise<Buffer> {
  return buildStyledExcelBuffer([buildUnsettledExcelSheet(report)]);
}

export function buildUnsettledReportFileBaseName(report: UnsettledReportData): string {
  const nameSegment = sanitizeFileNameSegment(report.entity_name ?? "unsettled");
  return `TW-Unsettled-${nameSegment}`;
}
