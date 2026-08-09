/**
 * Quotation → styled Excel workbook (spreadsheet-optimized layout).
 * Excel is internal-facing: includes Cost/GP plus AF columns.
 */
import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import {
  buildStyledExcelBuffer,
  type StyledDataRow,
  type StyledSheetConfig,
} from "@/lib/reports/document/excel-report-builder";
import { buildQuotationDocument } from "./quotation-document";

function breakdownRows(
  title: string,
  rows: Array<{ label: string; count: number; sharePct: string }>
): StyledDataRow[] {
  return [
    { kind: "emphasis", values: [title, "", ""] },
    ...rows.map((row) => ({
      kind: "data" as const,
      values: [row.label, row.count, row.sharePct],
    })),
  ];
}

export async function buildQuotationExcel(
  detail: import("../types").QuotationDetail,
  options?: { itemIds?: string[]; platforms?: string[] | null }
): Promise<Buffer> {
  const doc = buildQuotationDocument(detail, {
    audience: "internal",
    itemIds: options?.itemIds,
    platforms: options?.platforms,
  });

  const rows: StyledDataRow[] = doc.rows.map((r) => ({
    kind: "data",
    values: [
      r.creator,
      r.option,
      r.platform,
      r.followers,
      r.engagementRate,
      r.country,
      r.serviceDescription,
      r.tier,
      r.type,
      r.unitCost ?? "",
      r.clientCost,
      r.gp ?? "",
      r.gpPct ?? "",
      r.af,
      r.afPct,
    ],
  }));

  rows.push({
    kind: "total",
    values: [
      "Totals (EGP)",
      "",
      "",
      "",
      doc.summary.estimatedEngagement,
      "",
      `${doc.summary.creatorCount} creators`,
      "",
      "",
      doc.summary.totalCost ?? "",
      doc.summary.totalClientCost,
      doc.summary.totalGpValue ?? "",
      doc.summary.totalGpPct ?? "",
      doc.summary.totalAf,
      "",
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
        "Option",
        "Platform",
        "Followers",
        "ER",
        "Country",
        "Service",
        "Tier",
        "Type",
        "Unit Cost",
        QUOTATION_CLIENT_LABELS.clientCost,
        "GP",
        "GP%",
        QUOTATION_CLIENT_LABELS.agencyFee,
        QUOTATION_CLIENT_LABELS.agencyFeePct,
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
      "text",
      "text",
      "text",
      "text",
      "text",
    ],
  };

  const summaryRows: StyledDataRow[] = [
    { kind: "emphasis", values: ["Campaign mix insight", "", ""] },
    ...doc.summary.insightBullets.map((bullet) => ({
      kind: "data" as const,
      values: [bullet, "", ""],
    })),
    ...breakdownRows("Creators by Category", doc.summary.categoryBreakdown),
    ...breakdownRows("Creators by Tier", doc.summary.tierBreakdown),
    {
      kind: "total",
      values: ["Total unique creators", doc.summary.creatorCount, "100%"],
    },
  ];

  const summarySheet: StyledSheetConfig = {
    name: "Creator Summary",
    header: {
      title: `Thinkway — Creator Summary ${doc.serial}`,
      entityLine: `${doc.clientName} · ${doc.brandName}`,
      meta: [
        { label: "Quotation", value: doc.name },
        { label: "Campaign", value: doc.campaignName },
        { label: "Estimated engagement", value: doc.summary.estimatedEngagement },
      ],
      generatedAt: new Date(),
      notes: [
        "Categories are counted once per creator. Creators with multiple category tags are included in each relevant category.",
      ],
    },
    columnHeaders: [["Summary", "Creators", "Share"]],
    rows: summaryRows,
    columnFormats: ["text", "text", "text"],
  };

  return buildStyledExcelBuffer([sheet, summarySheet]);
}
