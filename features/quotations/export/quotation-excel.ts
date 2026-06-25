/**
 * Quotation → styled Excel workbook, reusing the shared Thinkway report builder
 * (`lib/reports/document/excel-report-builder.ts`) for consistent branding.
 */
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
      r.cost,
      r.revenue,
    ],
  }));

  rows.push({
    kind: "total",
    values: [
      "Totals (EGP)",
      "",
      "",
      "",
      "",
      "",
      doc.summary.totalCost,
      doc.summary.totalRevenue,
    ],
  });
  rows.push({
    kind: "emphasis",
    values: ["Gross profit", "", "", "", "", "", doc.summary.totalGpValue, doc.summary.totalGpPct],
  });

  const sheet: StyledSheetConfig = {
    name: "Quotation",
    header: {
      title: `Thinkway — Client Quotation ${doc.serial}`,
      entityLine: `${doc.clientName} · ${doc.brandName}`,
      meta: [
        { label: "Quotation", value: doc.name },
        { label: "Campaign", value: doc.campaignName },
        { label: "Status", value: doc.status },
        { label: "Date", value: doc.dateLabel },
      ],
      generatedAt: new Date(),
      notes: doc.notes ? [doc.notes] : undefined,
    },
    columnHeaders: [
      ["Creator", "Platform", "Followers", "ER", "Country", "Deliverables", "Cost", "Revenue"],
    ],
    rows,
    columnFormats: ["text", "text", "text", "text", "text", "text", "text", "text"],
  };

  return buildStyledExcelBuffer([sheet]);
}
