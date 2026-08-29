import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";

/** Worker-backed statuses: publication is actively being collected. */
export const IN_FLIGHT_SYNC_STATUSES = ["queued", "collecting"] as const;

export type InFlightSyncStatus = (typeof IN_FLIGHT_SYNC_STATUSES)[number];

const IN_FLIGHT_SYNC_STATUS_SET = new Set<string>(IN_FLIGHT_SYNC_STATUSES);

const METRICS_DONE_STATUSES = new Set(["completed", "partial"]);

const TERMINAL_METRICS_SYNC_STATUSES = new Set([
  "completed",
  "partial",
  "failed",
  "manual_required",
]);

/** Keep polling briefly after metrics finish while screenshot capture may still be running. */
export const SCREENSHOT_CAPTURE_POLL_WINDOW_MS = 10 * 60 * 1000;

/**
 * Slower interval for post-metrics screenshot capture — decoupled from in-flight metrics
 * polling so completed metrics stop the 4s refresh loop immediately.
 */
export const SCREENSHOT_CAPTURE_POLL_INTERVAL_MS = 30_000;

export function isSyncInFlight(status?: string | null): boolean {
  return status != null && IN_FLIGHT_SYNC_STATUS_SET.has(status);
}

export function isSyncPending(status?: string | null): boolean {
  return status === "pending";
}

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

/** Poll while screenshot capture may still be running after metrics reached a terminal state. */
export function publicationsNeedScreenshotCapturePoll(
  publications: PublicationSyncPollRow[]
): boolean {
  return publications.some((row) => publicationNeedsScreenshotCapturePoll(row));
}

/** Keep polling briefly after metrics finish while avatar sync may still be running. */
export const AVATAR_SYNC_POLL_WINDOW_MS = 2 * 60 * 1000;

export type PublicationAvatarPollRow = PublicationSyncPollRow & {
  influencer_id?: string | null;
  creator_avatar_url?: string | null;
  metrics_provider?: string | null;
  metrics_collection_source?: string | null;
};

function metricsCollectedViaApify(row: PublicationAvatarPollRow): boolean {
  return row.metrics_provider === "apify" || row.metrics_collection_source === "apify";
}

function publicationNeedsAvatarSyncPoll(
  row: PublicationAvatarPollRow,
  nowMs: number = Date.now()
): boolean {
  if (!row.influencer_id?.trim()) return false;
  if (row.creator_avatar_url?.trim()) return false;
  if (isSyncInFlight(row.metrics_refresh_status)) return false;

  const status = row.metrics_refresh_status;
  if (!status || !METRICS_DONE_STATUSES.has(status)) return false;
  if (!metricsCollectedViaApify(row)) return false;

  const anchor = row.metrics_refresh_attempted_at ?? row.created_at;
  if (!anchor) return false;

  return nowMs - new Date(anchor).getTime() < AVATAR_SYNC_POLL_WINDOW_MS;
}

/** Poll while Apify metrics finished recently but creator avatar is still unresolved. */
export function publicationsNeedAvatarSyncPoll(
  publications: PublicationAvatarPollRow[]
): boolean {
  return publications.some((row) => publicationNeedsAvatarSyncPoll(row));
}

/** Poll publications bundle while metrics collection jobs are in flight (queued/collecting only). */
export function publicationsNeedMetricsSyncPoll(
  publications: PublicationSyncPollRow[]
): boolean {
  return publications.some((row) => isSyncInFlight(row.metrics_refresh_status));
}

/** Show loading toast only when status transitions into an in-flight state. */
export function shouldShowMetricsSyncLoadingToast(
  priorStatus: string | null | undefined,
  nextStatus: string | null | undefined
): boolean {
  return isSyncInFlight(nextStatus) && !isSyncInFlight(priorStatus);
}

export function isMetricsSyncTerminalStatus(status?: string | null): boolean {
  return status != null && TERMINAL_METRICS_SYNC_STATUSES.has(status);
}

/**
 * Finish a loading toast when metrics reach a terminal status.
 * `toastWasShown` covers the race where Refresh metrics shows a spinner, then the
 * first observed row is already completed/manual/failed (hook remount or fast worker).
 * Do not complete on first page load of already-terminal rows (`toastWasShown` false
 * and no in-flight prior).
 */
export function shouldCompleteMetricsSyncToast(input: {
  priorStatus: string | null | undefined;
  nextStatus: string | null | undefined;
  toastWasShown: boolean;
}): boolean {
  if (!isMetricsSyncTerminalStatus(input.nextStatus)) return false;
  if (input.toastWasShown) return true;
  return input.priorStatus != null && isSyncInFlight(input.priorStatus);
}

/** Default client poll interval while metrics jobs are in flight. */
export const METRICS_SYNC_POLL_INTERVAL_MS = 4_000;
