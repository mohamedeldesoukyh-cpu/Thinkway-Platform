/**
 * Media Plan Edit History — productivity audit (not Business Versions).
 * Spec: docs/architecture/PRODUCTIVITY_NAVIGATION_UX_SPRINT.md
 * SSOT: must never bump versionLabel / push business history.
 */

import type { MediaPlanData } from "./generators/media-plan";
import type {
  CampaignOutputActorKind,
  CampaignOutputContent,
  CampaignOutputRecord,
  MediaPlanEditFieldChange,
  MediaPlanEditHistoryEntry,
} from "./output-types";

export type MediaPlanEditDiffSummary = {
  summary: string;
  detailLines: string[];
  fieldChanges: MediaPlanEditFieldChange[];
  affectedCreatorCount: number;
  addedCreatorIds: string[];
  removedCreatorIds: string[];
};

function asMediaPlanData(data: unknown): MediaPlanData | null {
  if (!data || typeof data !== "object") return null;
  const weeks = (data as MediaPlanData).weeks;
  if (!Array.isArray(weeks)) return null;
  return data as MediaPlanData;
}

function collectCreators(data: MediaPlanData | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!data) return map;
  const add = (creatorId?: string, creator?: string, shortName?: string) => {
    const id = (creatorId ?? creator ?? "").trim();
    if (!id) return;
    map.set(id.toLowerCase(), shortName ?? creator ?? id);
  };
  for (const week of data.weeks ?? []) {
    for (const day of week.days ?? []) {
      add(day.creatorId, day.creator, day.shortName);
      for (const extra of day.additionalDeliverables ?? []) {
        add(extra.creatorId, extra.creator, extra.shortName);
      }
    }
  }
  for (const deadline of data.deadlines ?? []) {
    add(deadline.creatorId, deadline.creator, deadline.shortName);
  }
  return map;
}

function collectBudget(data: MediaPlanData | null): number | null {
  if (!data) return null;
  const n = Number(
    (data as { totalBudget?: number; budget?: number }).totalBudget ??
      (data as { budget?: number }).budget
  );
  return Number.isFinite(n) ? n : null;
}

/** Diff two tip payloads into a human summary + field changes. */
export function summarizeMediaPlanEditDiff(
  beforeContent: CampaignOutputContent | undefined,
  afterContent: CampaignOutputContent | undefined
): MediaPlanEditDiffSummary {
  const before = asMediaPlanData(beforeContent?.data);
  const after = asMediaPlanData(afterContent?.data);
  const beforeCreators = collectCreators(before);
  const afterCreators = collectCreators(after);

  const addedCreatorIds: string[] = [];
  const removedCreatorIds: string[] = [];
  for (const id of afterCreators.keys()) {
    if (!beforeCreators.has(id)) addedCreatorIds.push(id);
  }
  for (const id of beforeCreators.keys()) {
    if (!afterCreators.has(id)) removedCreatorIds.push(id);
  }

  const fieldChanges: MediaPlanEditFieldChange[] = [];
  const detailLines: string[] = [];

  if (addedCreatorIds.length) {
    detailLines.push(`Added ${addedCreatorIds.length} creator(s)`);
    fieldChanges.push({
      field: "creators_added",
      label: "Creators added",
      oldValue: null,
      newValue: addedCreatorIds.length,
      changeKind: "added",
    });
  }
  if (removedCreatorIds.length) {
    detailLines.push(`Removed ${removedCreatorIds.length} creator(s)`);
    fieldChanges.push({
      field: "creators_removed",
      label: "Creators removed",
      oldValue: removedCreatorIds.length,
      newValue: null,
      changeKind: "removed",
    });
  }

  const beforeWeeks = before?.durationWeeks ?? null;
  const afterWeeks = after?.durationWeeks ?? null;
  if (beforeWeeks !== afterWeeks && (beforeWeeks != null || afterWeeks != null)) {
    detailLines.push(`Duration weeks: ${beforeWeeks ?? "—"} → ${afterWeeks ?? "—"}`);
    fieldChanges.push({
      field: "durationWeeks",
      label: "Duration weeks",
      oldValue: beforeWeeks,
      newValue: afterWeeks,
      changeKind: "modified",
    });
  }

  const beforeEnd = before?.campaignEndDate ?? null;
  const afterEnd = after?.campaignEndDate ?? null;
  if (beforeEnd !== afterEnd) {
    detailLines.push(`End date: ${beforeEnd ?? "—"} → ${afterEnd ?? "—"}`);
    fieldChanges.push({
      field: "campaignEndDate",
      label: "Campaign end date",
      oldValue: beforeEnd,
      newValue: afterEnd,
      changeKind: "modified",
    });
  }

  const beforeBudget = collectBudget(before);
  const afterBudget = collectBudget(after);
  if (beforeBudget !== afterBudget && (beforeBudget != null || afterBudget != null)) {
    detailLines.push(`Budget: ${beforeBudget ?? "—"} → ${afterBudget ?? "—"}`);
    fieldChanges.push({
      field: "budget",
      label: "Budget",
      oldValue: beforeBudget,
      newValue: afterBudget,
      changeKind: "modified",
    });
  }

  const beforeTitle = beforeContent?.title ?? null;
  const afterTitle = afterContent?.title ?? null;
  if (beforeTitle !== afterTitle && (beforeTitle || afterTitle)) {
    detailLines.push(`Title: ${beforeTitle ?? "—"} → ${afterTitle ?? "—"}`);
    fieldChanges.push({
      field: "title",
      label: "Title",
      oldValue: beforeTitle,
      newValue: afterTitle,
      changeKind: "modified",
    });
  }

  if (detailLines.length === 0) {
    detailLines.push("Updated Media Plan schedule / content");
    fieldChanges.push({
      field: "content",
      label: "Content",
      changeKind: "modified",
    });
  }

  const summaryParts: string[] = [];
  if (addedCreatorIds.length) summaryParts.push(`Added ${addedCreatorIds.length} creator(s)`);
  if (removedCreatorIds.length)
    summaryParts.push(`Removed ${removedCreatorIds.length} creator(s)`);
  if (summaryParts.length === 0) summaryParts.push("Edited Media Plan");

  return {
    summary: summaryParts.join(" · "),
    detailLines,
    fieldChanges,
    affectedCreatorCount: addedCreatorIds.length + removedCreatorIds.length,
    addedCreatorIds,
    removedCreatorIds,
  };
}

/** Append-only — never truncate (product: keep all edit history). */
export function appendMediaPlanEditHistoryEntry(
  record: CampaignOutputRecord,
  entry: Omit<MediaPlanEditHistoryEntry, "editNumber"> & { editNumber?: number }
): MediaPlanEditHistoryEntry[] {
  const prev = record.editHistory ?? [];
  const editNumber =
    entry.editNumber ??
    (prev.length ? Math.max(...prev.map((e) => e.editNumber)) + 1 : 1);
  return [...prev, { ...entry, editNumber }];
}

export function buildMediaPlanEditHistoryEntry(input: {
  record: CampaignOutputRecord;
  beforeContent?: CampaignOutputContent;
  afterContent?: CampaignOutputContent;
  actorKind: CampaignOutputActorKind;
  actorUserId?: string | null;
  actorLabel?: string | null;
  operationClass?: string;
  restoredFromEditNumber?: number | null;
  at?: string;
}): MediaPlanEditHistoryEntry {
  const diff = summarizeMediaPlanEditDiff(input.beforeContent, input.afterContent);
  const prev = input.record.editHistory ?? [];
  const editNumber = prev.length
    ? Math.max(...prev.map((e) => e.editNumber)) + 1
    : 1;

  const summary = input.restoredFromEditNumber
    ? `Restored from Edit ${input.restoredFromEditNumber}`
    : diff.summary;

  return {
    editNumber,
    at: input.at ?? new Date().toISOString(),
    actorKind: input.actorKind,
    actorUserId: input.actorUserId,
    actorLabel: input.actorLabel,
    summary,
    detailLines: input.restoredFromEditNumber
      ? [`Restored from Edit ${input.restoredFromEditNumber}`, ...diff.detailLines]
      : diff.detailLines,
    fieldChanges: diff.fieldChanges,
    affectedCreatorCount: diff.affectedCreatorCount,
    addedCreatorIds: diff.addedCreatorIds,
    removedCreatorIds: diff.removedCreatorIds,
    contentSnapshot: input.afterContent
      ? structuredClone(input.afterContent)
      : undefined,
    restoredFromEditNumber: input.restoredFromEditNumber ?? null,
    operationClass: input.operationClass,
  };
}

export function withMediaPlanEditHistoryAppend(
  record: CampaignOutputRecord,
  entry: MediaPlanEditHistoryEntry
): CampaignOutputRecord {
  return {
    ...record,
    editHistory: appendMediaPlanEditHistoryEntry(record, entry),
  };
}

/** Latest N for UI default page (older via Load More). */
export function pageMediaPlanEditHistory(
  entries: MediaPlanEditHistoryEntry[] | undefined,
  options?: { offset?: number; limit?: number }
): { items: MediaPlanEditHistoryEntry[]; total: number; hasMore: boolean } {
  const all = [...(entries ?? [])].sort((a, b) => b.editNumber - a.editNumber);
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 50;
  const items = all.slice(offset, offset + limit);
  return {
    items,
    total: all.length,
    hasMore: offset + items.length < all.length,
  };
}

export function findEditHistoryEntry(
  record: CampaignOutputRecord,
  editNumber: number
): MediaPlanEditHistoryEntry | null {
  return record.editHistory?.find((e) => e.editNumber === editNumber) ?? null;
}

/**
 * Side-by-side / inline compare between two tip contents (or edit snapshots).
 */
export function compareMediaPlanEditContents(
  left: CampaignOutputContent | undefined,
  right: CampaignOutputContent | undefined
): MediaPlanEditFieldChange[] {
  return summarizeMediaPlanEditDiff(left, right).fieldChanges;
}

export type RestoreMediaPlanEditResult = {
  record: CampaignOutputRecord;
  /** Content applied from the restored edit. */
  content: CampaignOutputContent;
};

/**
 * Restore tip content from an Edit History entry.
 * Append-only: creates a new edit entry; never rewrites history.
 * Does NOT bump business version — caller must fork Approved tip first
 * via ensureWorkingDraft when needed.
 */
export function restoreMediaPlanEditOnRecord(
  record: CampaignOutputRecord,
  editNumber: number,
  options?: {
    at?: string;
    actorKind?: CampaignOutputActorKind;
    actorUserId?: string | null;
    actorLabel?: string | null;
  }
): RestoreMediaPlanEditResult | null {
  const target = findEditHistoryEntry(record, editNumber);
  if (!target?.contentSnapshot) return null;

  const now = options?.at ?? new Date().toISOString();
  const beforeContent = record.content;
  const afterContent = structuredClone(target.contentSnapshot);

  let next: CampaignOutputRecord = {
    ...record,
    content: afterContent,
    updatedAt: now,
    changeReason: `Restored Edit ${editNumber}.`,
    changeSummary: `Restored from Edit ${editNumber} (append-only; business version unchanged).`,
    actorKind: options?.actorKind ?? record.actorKind,
    actorUserId: options?.actorUserId ?? record.actorUserId,
  };

  const editEntry = buildMediaPlanEditHistoryEntry({
    record: next,
    beforeContent,
    afterContent,
    actorKind: options?.actorKind ?? "user",
    actorUserId: options?.actorUserId,
    actorLabel: options?.actorLabel,
    operationClass: "edit_restore",
    restoredFromEditNumber: editNumber,
    at: now,
  });
  next = withMediaPlanEditHistoryAppend(next, editEntry);

  return { record: next, content: afterContent };
}
