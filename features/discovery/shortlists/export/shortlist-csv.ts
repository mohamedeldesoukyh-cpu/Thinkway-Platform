import type { ShortlistDocument } from "./shortlist-document";
import { formatShortlistPlatformLinksForExport } from "./shortlist-document";

import { csvEscapeCell } from "@/lib/security/csv-formula";

function csvCell(value: string | number): string {
  return csvEscapeCell(value);
}

export function buildShortlistCsv(doc: ShortlistDocument): string {
  const isDetailed = doc.template === "detailed";

  const headers = isDetailed
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
    : ["#", "Creator", "Handle", "Platform", "Followers", "Avg ER", "Country"];

  const rows = doc.rows.map((row) =>
    isDetailed
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
        ]
  );

  return [headers, ...rows].map((line) => line.map(csvCell).join(",")).join("\n");
}
