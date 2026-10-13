import type { CampaignPublicationRow } from "@/lib/domains/campaign/types";

/** Additional read-only overview values from the already loaded publication rows. */
export function publicationOverviewMetrics(rows: CampaignPublicationRow[]) {
  const recordedPlays = rows.map(row => row.plays).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return {
    plays: recordedPlays.length ? recordedPlays.reduce((sum,value) => sum + value,0) : null,
    missingMetrics: rows.filter(row => ![
      row.views, row.unique_views, row.reach, row.actual_reach, row.impressions,
      row.actual_impressions, row.plays, row.likes, row.comments, row.shares,
      row.saves, row.clicks, row.stored_engagements, row.watch_time_seconds
    ].some(value => typeof value === "number" && Number.isFinite(value))).length
  };
}
