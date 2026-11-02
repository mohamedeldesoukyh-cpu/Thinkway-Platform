import { renderStatementHtml } from "./statement-a4-html";
import type { StatementsReportData } from "@/lib/reports/statements/statement-types";
import {
  formatEntityScopeLine,
} from "@/lib/reports/statements/entity-label";
import type { StyledDataRow, StyledSheetConfig } from "@/lib/reports/document/excel-report-builder";
import { buildStyledExcelBuffer } from "@/lib/reports/document/thinkway-report-excel";
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

export function buildStatementsReportHtml(report: StatementsReportData): string {
  return renderStatementHtml(report);
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
