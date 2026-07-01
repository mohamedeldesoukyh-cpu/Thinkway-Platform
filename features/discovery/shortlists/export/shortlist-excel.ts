import {
  buildStyledExcelBuffer,
  type StyledDataRow,
  type StyledSheetConfig,
} from "@/lib/reports/document/excel-report-builder";

import type { ShortlistDocument } from "./shortlist-document";
import { formatShortlistPlatformLinksForExport } from "./shortlist-document";

export async function buildShortlistExcel(doc: ShortlistDocument): Promise<Buffer> {
  const isDetailed = doc.template === "detailed";

  const rows: StyledDataRow[] = doc.rows.map((row) => ({
    kind: "data",
    values: isDetailed
      ? [
          row.rank,
          row.creator,
          row.handle,
          formatShortlistPlatformLinksForExport(row.platformLinks),
          row.followers,
          row.engagementRate,
          row.country,
          row.interests,
          row.brandSafety,
          row.status,
          row.notes,
          row.matchScore,
        ]
      : [
          row.rank,
          row.creator,
          row.handle,
          formatShortlistPlatformLinksForExport(row.platformLinks),
          row.followers,
          row.engagementRate,
          row.country,
        ],
  }));

  const sheet: StyledSheetConfig = {
    name: "Shortlist",
    header: {
      title: `Thinkway — Shortlist ${doc.serial}`,
      entityLine: [doc.clientName, doc.brandName].filter((v) => v && v !== "—").join(" · ") || doc.name,
      meta: [
        { label: "Shortlist", value: doc.name },
        { label: "Status", value: doc.statusLabel },
        { label: "Visibility", value: doc.visibilityLabel },
        { label: "Owner", value: doc.ownerName },
        { label: "Template", value: doc.template === "detailed" ? "Detailed" : "Summary" },
        { label: "Creators", value: String(doc.creatorCount) },
      ],
      generatedAt: doc.generatedAt,
      notes: doc.description ? [doc.description] : undefined,
    },
    columnHeaders: [
      isDetailed
        ? [
            "#",
            "Creator",
            "Handle",
            "Platform",
            "Followers",
            "Avg ER",
            "Country",
            "Audience interests",
            "Brand safety",
            "Status",
            "Notes",
            "Match",
          ]
        : ["#", "Creator", "Handle", "Platform", "Followers", "Avg ER", "Country"],
    ],
    rows,
    columnFormats: isDetailed
      ? ["text", "text", "text", "text", "text", "text", "text", "text", "text", "text", "text", "text"]
      : ["text", "text", "text", "text", "text", "text", "text"],
  };

  return buildStyledExcelBuffer([sheet]);
}
