/**
 * Quotation → styled Excel workbook (spreadsheet-optimized layout).
 */
import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import {
  buildStyledExcelBuffer,
  type StyledDataRow,
  type StyledSheetConfig,
} from "@/lib/reports/document/excel-report-builder";
import type { QuotationDocument } from "./quotation-document";

export async function buildQuotationExcel(doc: QuotationDocument): Promise<Buffer> {
  const rows: StyledDataRow[] = doc.rows.map((r) => ({
    kind: "data",
    values: [
      r.creator,
      r.platform,
      r.followers,
      r.engagementRate,
      r.country,
      r.deliverables,
      r.unitCost,
      r.revenue,
      r.gp,
      r.gpPct,
    ],
  }));

  rows.push({
    kind: "total",
    values: [
      "Totals (EGP)",
      "",
      doc.summary.estimatedReach,
      doc.summary.estimatedEngagement,
      "",
      `${doc.summary.creatorCount} creators`,
      doc.summary.totalCost,
      doc.summary.totalRevenue,
      doc.summary.totalGpValue,
      doc.summary.totalGpPct,
    ],
  });

  const sheet: StyledSheetConfig = {
    name: "Quotation",
    header: {
      title: `Thinkway — Client Quotation ${doc.serial}`,
      entityLine: `${doc.clientName} · ${doc.brandName}`,
      meta: [
        { label: "Quotation", value: doc.name },
        { label: "Campaign", value: doc.campaignName },
        { label: "Issue / Valid", value: `${doc.issueDateLabel} → ${doc.validityDateLabel}` },
        { label: "Version / Status", value: `${doc.version} · ${doc.statusLabel}` },
        { label: "Prepared for", value: doc.preparedForLine },
        { label: "Department", value: doc.department },
      ],
      generatedAt: new Date(),
      notes: doc.notes ? [doc.notes] : undefined,
    },
    columnHeaders: [
      [
        "Creator",
        "Platform",
        "Followers",
        "ER",
        "Country",
        "Deliverables",
        "Unit Cost",
        QUOTATION_CLIENT_LABELS.clientCost,
        "GP",
        "GP%",
      ],
    ],
    rows,
    columnFormats: [
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
    ],
  };

  return buildStyledExcelBuffer([sheet]);
}
