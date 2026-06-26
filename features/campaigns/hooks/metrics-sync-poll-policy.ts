import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";

const ACTIVE_METRICS_SYNC_STATUSES = new Set(["pending", "queued", "collecting"]);

const METRICS_DONE_STATUSES = new Set(["completed", "partial"]);

/** Keep polling briefly after metrics finish while screenshot capture may still be running. */
export const SCREENSHOT_CAPTURE_POLL_WINDOW_MS = 10 * 60 * 1000;

export type PublicationSyncPollRow = Pick<
  CampaignPublicationRow,
  | "metrics_refresh_status"
  | "content_url"
  | "screenshot_captured_at"
  | "metrics_refresh_attempted_at"
  | "created_at"
>;

function publicationNeedsScreenshotCapturePoll(
  row: PublicationSyncPollRow,
  nowMs: number = Date.now()
): boolean {
  if (!row.content_url?.trim()) return false;
  if (row.screenshot_captured_at) return false;

  const status = row.metrics_refresh_status;
  if (!status || !METRICS_DONE_STATUSES.has(status)) return false;

  const anchor = row.metrics_refresh_attempted_at ?? row.created_at;
  if (!anchor) return false;

  return nowMs - new Date(anchor).getTime() < SCREENSHOT_CAPTURE_POLL_WINDOW_MS;
}

/** Poll publications bundle while metrics or post-screenshot capture jobs are in flight. */
export function publicationsNeedMetricsSyncPoll(
  publications: PublicationSyncPollRow[]
): boolean {
  return publications.some((row) => {
    const status = row.metrics_refresh_status;
    if (status != null && ACTIVE_METRICS_SYNC_STATUSES.has(status)) return true;
    return publicationNeedsScreenshotCapturePoll(row);
  });
}

/** Default client poll interval while metrics jobs are in flight. */
export const METRICS_SYNC_POLL_INTERVAL_MS = 4_000;
