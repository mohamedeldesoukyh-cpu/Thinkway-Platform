type LiveEvidence = {
  live_date?: string | null;
  workflow_status?: string | null;
};

/** Live dates are execution evidence even when legacy workflow statuses remain draft. */
export function assignmentHasGoneLive(
  line: { went_live_date?: string | null },
  deliverables: Array<LiveEvidence & { posts?: LiveEvidence[] }>,
  today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date()),
): boolean {
  const recordedLiveDate = (value?: string | null) => {
    const date = value?.trim().slice(0, 10);
    return Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && date <= today);
  };
  const isLive = (row: LiveEvidence) =>
    row.workflow_status === "posted" || row.workflow_status === "verified" || recordedLiveDate(row.live_date);
  return recordedLiveDate(line.went_live_date) || deliverables.some(d => isLive(d) || d.posts?.some(isLive));
}
