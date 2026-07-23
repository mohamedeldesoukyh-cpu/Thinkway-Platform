import {
  buildStyledExcelBuffer,
  type StyledDataRow,
  type StyledSheetConfig,
} from "@/lib/reports/document/excel-report-builder";

import type { ShortlistDocument } from "./shortlist-document";
import { formatShortlistPlatformLinksForExport } from "./shortlist-document";

export async function buildShortlistExcel(doc: ShortlistDocument): Promise<Buffer> {
  const isDetailed = doc.template === "detailed";
  const isShowcase = doc.template === "showcase";
  const useDetailedColumns = isDetailed;

  const rows: StyledDataRow[] = doc.rows.map((row) => ({
    kind: "data",
    values: useDetailedColumns
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

  const templateLabel =
    doc.template === "detailed"
      ? "Detailed"
      : doc.template === "showcase"
        ? "Showcase"
        : doc.template === "pitch"
          ? "Pitch presentation"
          : "Summary";

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
        { label: "Template", value: templateLabel },
        { label: "Creators", value: String(doc.creatorCount) },
      ],
      generatedAt: doc.generatedAt,
      notes: doc.description ? [doc.description] : undefined,
    },
    columnHeaders: [
      useDetailedColumns
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
    columnFormats: useDetailedColumns
      ? ["text", "text", "text", "text", "text", "text", "text", "text", "text", "text", "text", "text"]
      : ["text", "text", "text", "text", "text", "text", "text"],
  };

  if (isShowcase && doc.creatorGroups.length > 0) {
    const showcaseSheet: StyledSheetConfig = {
      name: "Showcase",
      header: {
        title: `Thinkway — Shortlist Showcase ${doc.serial}`,
        entityLine: [doc.clientName, doc.brandName].filter((v) => v && v !== "—").join(" · ") || doc.name,
        meta: [
          { label: "Creators", value: String(doc.creatorCount) },
          { label: "Audience size", value: doc.summary.totalFollowersLabel },
          { label: "Est. reach", value: doc.summary.estimatedReachLabel },
          { label: "Avg ER", value: doc.summary.avgEngagementRateLabel },
        ],
        generatedAt: doc.generatedAt,
      },
      columnHeaders: [
        ["#", "Creator", "Handle", "Tier", "Followers", "Avg ER", "Country", "Categories", "Match", "Brand safety"],
      ],
      rows: doc.creatorGroups.map((group) => ({
        kind: "data",
        values: [
          group.rank,
          group.creator,
          group.handle,
          group.tier,
          group.followers,
          group.engagementRate,
          group.country,
          group.categories.join(", ") || group.interests,
          group.matchScore,
          group.brandSafety,
        ],
      })),
      columnFormats: ["text", "text", "text", "text", "text", "text", "text", "text", "text", "text"],
    };
    return buildStyledExcelBuffer([sheet, showcaseSheet]);
  }

  return buildStyledExcelBuffer([sheet]);
}
