const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

export type RefreshScheduleInput = {
  publicationStatus: string;
  publicationDate: string | null;
  createdAt: string;
  lastSyncedAt: string | null;
};

/** Published content: 1h first refresh, daily for 7 days, weekly after. */
export function computeNextRefreshAt(input: RefreshScheduleInput): Date | null {
  const publishedLike = ["published", "verified"].includes(input.publicationStatus);
  if (!publishedLike) return null;

  const anchorMs = Date.parse(
    input.publicationDate
      ? `${input.publicationDate.includes("T") ? input.publicationDate : `${input.publicationDate}T12:00:00Z`}`
      : input.createdAt
  );
  if (!Number.isFinite(anchorMs)) return null;

  const now = Date.now();
  const daysSincePublish = (now - anchorMs) / DAY_MS;

  if (!input.lastSyncedAt) {
    const firstDue = anchorMs + HOUR_MS;
    return new Date(Math.max(firstDue, now + 5 * 60 * 1000));
  }

  const lastSyncMs = Date.parse(input.lastSyncedAt);
  if (!Number.isFinite(lastSyncMs)) {
    return new Date(now + HOUR_MS);
  }

  if (daysSincePublish <= 7) {
    return new Date(lastSyncMs + DAY_MS);
  }

  return new Date(lastSyncMs + WEEK_MS);
}

export function isRefreshDue(
  nextRefreshAt: string | null | undefined,
  refreshStatus: string | null | undefined
): boolean {
  if (refreshStatus === "collecting") return false;
  if (!nextRefreshAt) return refreshStatus === "queued" || refreshStatus === "pending";
  return Date.parse(nextRefreshAt) <= Date.now();
}
