import {
  projectContentReviewSchedule,
  reviewScheduleToday,
} from "./content-review-schedule";
import type { ClientCampaignPostRow } from "./campaign-execution";
import type { ClientContentReviewItem } from "./content-approval";

export const SCHEDULE_STATES = {
  ready_to_review: { label: "Ready to review", css: "u-rd" },
  ready_for_approval: { label: "Ready for approval", css: "u-ap" },
  changes_requested: { label: "Changes requested", css: "u-ch" },
  approved: { label: "Approved", css: "u-ok" },
  awaiting_content: { label: "Awaiting content", css: "u-tb" },
} as const;
export type ScheduleStatus = keyof typeof SCHEDULE_STATES;
export type ScheduleRow = {
  id: string;
  creator_name: string;
  handle: string;
  content_type: string;
  ref: string;
  status: ScheduleStatus;
  has_script: boolean;
  expected_review_date: string | null;
  owner: "client" | "creator";
  action_label: string;
  post: ClientCampaignPostRow;
  content: ClientContentReviewItem | null;
};
export type ScheduleData = {
  campaignId: string;
  name: string;
  client_name: string;
  start_date: string | null;
  end_date: string | null;
  rows: ScheduleRow[];
};
export type ScheduleView = "d" | "w" | "m" | "q";
export type SchedulePeriod = { key: string; label: string; year: string };

export function scheduleNeedsDecision(row: Pick<ScheduleRow, "status">) {
  return (
    row.status === "ready_to_review" || row.status === "ready_for_approval"
  );
}
export function scheduleReadableOnly(
  row: Pick<ScheduleRow, "status" | "has_script">,
) {
  return row.status === "awaiting_content" && row.has_script;
}
export function scheduleDate(date: string | null) {
  return date
    ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "To be confirmed";
}
// Use the actual receipt date only when there is no agreed review date.
// Keep the saved expected date unchanged for reporting and editing.
export function scheduleCalendarDate(row: Pick<ScheduleRow, "expected_review_date" | "content">) {
  return row.expected_review_date || row.content?.uploadedAt?.slice(0, 10) || null;
}
export function scheduleRows(
  posts: ClientCampaignPostRow[],
  items: ClientContentReviewItem[],
  scripts: ReadonlySet<string>,
): ScheduleRow[] {
  return projectContentReviewSchedule(
    posts,
    items,
    scripts,
    reviewScheduleToday(),
  )
    // An attached script is reference material for the deliverable. Script
    // presence alone is not a client review request or an extra deliverable.
    .filter((row) => row.kind === "draft")
    .map((row): ScheduleRow => {
      const status: ScheduleStatus =
        row.status === "script_ready"
          ? "ready_to_review"
          : row.status === "ready"
            ? "ready_for_approval"
            : row.status === "approved" || row.status === "published"
              ? "approved"
              : row.status === "changes_requested"
                ? "changes_requested"
                : "awaiting_content";
      return {
        id: row.id,
        creator_name: row.post.creatorName,
        handle: row.post.creatorName,
        content_type: row.kind === "script" ? "Script" : row.post.deliverable,
        ref: row.post.sequenceNumber ? `#${row.post.sequenceNumber}` : "—",
        status,
        has_script: row.hasScript,
        expected_review_date: row.expectedDate,
        owner:
          status === "ready_to_review" || status === "ready_for_approval"
            ? "client"
            : "creator",
        action_label: row.content
          ? "Open content"
          : row.hasScript
            ? "Open script"
            : "—",
        post: row.post,
        content: row.content,
      };
    })
    .sort(
      (a, b) =>
        a.handle.localeCompare(b.handle) ||
        a.content_type.localeCompare(b.content_type) ||
        a.ref.localeCompare(b.ref, undefined, { numeric: true }),
    );
}
export function scheduleGroups(rows: ScheduleRow[]) {
  const groups = new Map<string, ScheduleRow[]>();
  rows.forEach((row) =>
    groups.set(row.handle, [...(groups.get(row.handle) ?? []), row]),
  );
  return [...groups.entries()].map(([name, rows]) => ({ name, rows }));
}
function utc(date: string) {
  return new Date(`${date}T12:00:00Z`);
}
function day(date: Date) {
  return date.toISOString().slice(0, 10);
}
export function schedulePeriodKey(date: string, view: ScheduleView): string {
  if (view === "d") return date;
  const d = utc(date);
  if (view === "m") return date.slice(0, 7);
  if (view === "q")
    return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const week = Math.ceil(
    ((d.getTime() - utc(`${year}-01-01`).getTime()) / 86400000 + 1) / 7,
  );
  return `${year}-W${String(week).padStart(2, "0")}`;
}
export function scheduleAxis(
  data: Pick<ScheduleData, "start_date" | "end_date" | "rows">,
) {
  const dates = [
    data.start_date,
    data.end_date,
    ...data.rows.map(scheduleCalendarDate),
  ]
    .filter((d): d is string => Boolean(d))
    .sort();
  // With no campaign boundaries, show whole calendar months around the known
  // review dates, not a single oversized week. This is a display window only.
  const first = dates[0] ?? reviewScheduleToday();
  const last = dates.at(-1) ?? first;
  const start = data.start_date ? first : `${first.slice(0, 7)}-01`;
  const monthEnd = utc(last);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  const end = data.end_date ? last : day(monthEnd);
  const months =
    (utc(end).getUTCFullYear() - utc(start).getUTCFullYear()) * 12 +
    utc(end).getUTCMonth() -
    utc(start).getUTCMonth() +
    1;
  const periods = (view: ScheduleView): SchedulePeriod[] => {
    const result: SchedulePeriod[] = [];
    const d = utc(start),
      last = utc(end);
    // Iterate calendar days to include partial boundary weeks and correct ISO year rollover.
    let previous = "";
    while (d <= last) {
      const key = schedulePeriodKey(day(d), view);
      if (key !== previous) {
        result.push({
          key,
          label:
            view === "d"
              ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
              : view === "w"
              ? key.split("-")[1]
              : view === "q"
                ? key.split("-")[1]
                : d.toLocaleDateString("en-GB", {
                    month: "short",
                    timeZone: "UTC",
                  }),
          year: key.slice(0, 4),
        });
        previous = key;
      }
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return result;
  };
  return {
    start,
    end,
    months,
    defaultView: (months <= 3 ? "w" : months <= 12 ? "m" : "q") as ScheduleView,
    views: { d: periods("d"), w: periods("w"), m: periods("m"), q: periods("q") },
  };
}
export function scheduleFinding(rows: ScheduleRow[]) {
  const missing = rows.filter((r) => !scheduleCalendarDate(r)).length;
  return missing
    ? `${missing} of ${rows.length} deliverables have neither an expected review date nor delivered content. They remain in Not scheduled. Delivered content without an expected date appears on its delivery date.`
    : "All deliverables appear on their expected review date, or their delivery date when no expected date was set.";
}
