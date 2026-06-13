import type { StatementsReportData } from "@/lib/reports/statements/statement-types";
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

function formatDateLabel(value: string | null): string {
  if (!value) return "All dates";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statementTypeLabel(type: StatementsReportData["type"]): string {
  return type === "client" ? "Client Statement" : "Vendor Statement";
}

function entityTypeLabel(type: StatementsReportData["type"]): string {
  return type === "client" ? "Legal entity" : "Vendor";
}

function renderStatementLedgerTable(report: StatementsReportData): string {
  const debitLabel = report.type === "client" ? "Debit (Invoices)" : "Debit (Payments)";
  const creditLabel =
    report.type === "client" ? "Credit (Payments)" : "Credit (Vendor invoices)";

  const rows =
    report.lines.length === 0
      ? `<tr><td colspan="6" class="muted">No ledger entries for this scope.</td></tr>`
      : report.lines
          .map(
            (line) => `
        <tr>
          <td>${line.date}</td>
          <td>${line.document_number}</td>
          <td>${line.campaign_name ?? "—"}</td>
          <td class="num">${line.debit > 0 ? formatReportAmountAlways(line.debit) : "—"}</td>
          <td class="num">${line.credit > 0 ? formatReportAmountAlways(line.credit) : "—"}</td>
          <td class="num">${formatReportAmountAlways(line.balance)}</td>
        </tr>`
          )
          .join("");

  const totalsRow =
    report.lines.length > 0
      ? `
      <tr class="total-row">
        <td colspan="3">Totals</td>
        <td class="num">${formatReportAmountAlways(report.totals.total_debit)}</td>
        <td class="num">${formatReportAmountAlways(report.totals.total_credit)}</td>
        <td class="num">${formatReportAmountAlways(report.totals.closing_balance)}</td>
      </tr>`
      : "";

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Document</th>
          <th>Campaign</th>
          <th class="num">${debitLabel}</th>
          <th class="num">${creditLabel}</th>
          <th class="num">Balance</th>
        </tr>
      </thead>
      <tbody>${rows}${totalsRow}</tbody>
    </table>`;
}

function buildStatementTableSections(report: StatementsReportData): ReportTableSection[] {
  const dateRangeNote =
    report.from_date || report.to_date
      ? `Date range: ${formatDateLabel(report.from_date)} — ${formatDateLabel(report.to_date)}`
      : "All dates included.";

  return [
    {
      number: 1,
      title: "Ledger",
      notes: [dateRangeNote],
      tableHtml: renderStatementLedgerTable(report),
    },
  ];
}

export function buildStatementsReportHtml(report: StatementsReportData): string {
  const entityName = report.entity_name ?? "Not selected";
  const generatedAt = new Date();
  const groupName = report.type === "client" ? report.group_name : null;
  const entityScopeValue = formatEntityScopeLine(
    report.entity_code,
    groupName,
    entityName
  );
  const pageTitleName =
    report.type === "client"
      ? (formatGroupClientLabel(groupName, entityName) ?? entityName)
      : entityName;

  return renderThinkwayReportHtml({
    pageTitle: `${statementTypeLabel(report.type)} — ${pageTitleName}`,
    reportTypeLabel: statementTypeLabel(report.type),
    reportBadge: report.entity_code ?? report.entity_name ?? "Statement",
    generatedAt,
    footerBrand: "thinkway.SOA",
    scopeMeta: [
      { label: entityTypeLabel(report.type), value: entityScopeValue },
      ...(report.type === "client" && groupName
        ? [{ label: "Group", value: groupName }]
        : []),
      { label: "Currency", value: report.currency },
      { label: "From", value: formatDateLabel(report.from_date) },
      { label: "To", value: formatDateLabel(report.to_date) },
    ],
    tableSections: buildStatementTableSections(report),
  });
}

function buildStatementEntityLine(report: StatementsReportData): string {
  const entityName = report.entity_name ?? "Not selected";
  const groupName = report.type === "client" ? report.group_name : null;
  return formatEntityScopeLine(report.entity_code, groupName, entityName);
}

function buildStatementExcelSheet(report: StatementsReportData): StyledSheetConfig {
  const debitLabel = report.type === "client" ? "Debit (Invoices)" : "Debit (Payments)";
  const creditLabel =
    report.type === "client" ? "Credit (Payments)" : "Credit (Vendor invoices)";

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
        "Totals",
        "",
        "",
        report.totals.total_debit,
        report.totals.total_credit,
        report.totals.closing_balance,
      ],
      kind: "total",
    });
  }

  const reportTitle =
    report.type === "client"
      ? "Thinkway — Client Statement"
      : "Thinkway — Vendor Statement";

  return {
    name: "Statement",
    header: {
      title: reportTitle,
      entityLine: buildStatementEntityLine(report),
      meta: [
        { label: "Currency", value: report.currency },
        { label: "From", value: formatDateLabel(report.from_date) },
        { label: "To", value: formatDateLabel(report.to_date) },
      ],
      generatedAt: new Date(),
    },
    columnHeaders: [["Date", "Document", "Campaign", debitLabel, creditLabel, "Balance"]],
    rows,
    columnFormats: ["text", "text", "text", "money", "money", "money"],
  };
}

export async function buildStatementsReportExcelBuffer(
  report: StatementsReportData
): Promise<Buffer> {
  return buildStyledExcelBuffer([buildStatementExcelSheet(report)]);
}

export function buildStatementsReportFileBaseName(report: StatementsReportData): string {
  const typeSegment = report.type === "client" ? "client" : "vendor";
  const nameSegment = sanitizeFileNameSegment(report.entity_name ?? "statement");
  return `TW-Statement-${typeSegment}-${nameSegment}`;
}
