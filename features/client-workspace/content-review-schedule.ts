import { clientPostDocumentationScriptUnit } from "@/lib/campaign-script/documentation-unit-ui";
import type { ClientCampaignPostRow } from "./campaign-execution";
import type { ClientContentReviewItem } from "./content-approval";

export type ReviewScheduleStatus = "ready" | "script_ready" | "changes_requested" | "delayed" | "due_today" | "upcoming" | "unconfirmed" | "approved" | "published";
export const REVIEW_SCHEDULE_LABELS: Record<ReviewScheduleStatus, string> = {
  ready: "Ready for approval", script_ready: "Ready to review", changes_requested: "Changes requested",
  delayed: "Delayed", due_today: "Due today", upcoming: "Upcoming", unconfirmed: "Date to be confirmed",
  approved: "Approved", published: "Published",
};
export type ContentReviewScheduleRow = {
  id: string; post: ClientCampaignPostRow; kind: "script" | "draft"; expectedDate: string | null;
  status: ReviewScheduleStatus; content: ClientContentReviewItem | null; hasScript: boolean;
};
const priority: Record<ReviewScheduleStatus, number> = { ready: 0, script_ready: 0, changes_requested: 1, delayed: 2, due_today: 3, upcoming: 4, unconfirmed: 5, approved: 6, published: 7 };
export function reviewScheduleToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
function expectedStatus(date: string | null, today: string): ReviewScheduleStatus {
  return !date ? "unconfirmed" : date < today ? "delayed" : date === today ? "due_today" : "upcoming";
}
export function projectContentReviewSchedule(posts: ClientCampaignPostRow[], content: ClientContentReviewItem[], scriptKeys: ReadonlySet<string>, today: string): ContentReviewScheduleRow[] {
  const rows: ContentReviewScheduleRow[] = [];
  const seen = new Set<string>();
  for (const post of posts) {
    if (!post.assignmentDeliverableId || post.valueScope === "added_value") continue;
    const unit = clientPostDocumentationScriptUnit(post);
    const key = unit?.unitKey ?? post.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const matches = content.filter(item => item.assignmentDeliverableId === post.assignmentDeliverableId &&
      (item.assignmentPostScheduleId === (post.assignmentPostScheduleId ?? null) || ((post.quantity ?? 1) === 1 && item.assignmentPostScheduleId === null)));
    // Ignore older approved versions when a new version of the same asset awaits review.
    const newest = new Map<string, ClientContentReviewItem>();
    for (const item of matches) {
      if ((newest.get(item.assetId)?.versionNumber ?? -1) < item.versionNumber) newest.set(item.assetId, item);
    }
    const items = [...newest.values()].sort((a, b) => Number(a.status === "approved") - Number(b.status === "approved") || b.uploadedAt.localeCompare(a.uploadedAt));
    const asset = items[0] ?? null;
    const hasScript = Boolean(unit && scriptKeys.has(unit.unitKey));
    if (post.expectedScriptDate || hasScript) rows.push({ id: `${key}:script`, post, kind: "script", expectedDate: post.expectedScriptDate ?? null,
      status: hasScript ? "script_ready" : expectedStatus(post.expectedScriptDate ?? null, today), content: null, hasScript });
    rows.push({ id: `${key}:draft`, post, kind: "draft", expectedDate: post.expectedDraftDate ?? null,
      status: asset ? (asset.status === "approved" ? "approved" : asset.status === "changes_requested" ? "changes_requested" : "ready") : post.live ? "published" : expectedStatus(post.expectedDraftDate ?? null, today), content: asset, hasScript });
  }
  return rows.sort((a, b) => priority[a.status] - priority[b.status] || (a.expectedDate ?? "9999").localeCompare(b.expectedDate ?? "9999") || a.post.creatorName.localeCompare(b.post.creatorName));
}

export function nextContentExpectation(rows: ContentReviewScheduleRow[], today: string) {
  const pending = rows.filter(row => (row.status === "upcoming" || row.status === "due_today") && row.expectedDate && row.expectedDate >= today);
  const date = pending.map(row => row.expectedDate!).sort()[0] ?? null;
  return { date, count: date ? pending.filter(row => row.expectedDate === date).length : 0 };
}
