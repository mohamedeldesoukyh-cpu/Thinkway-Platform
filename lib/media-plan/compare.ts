import type { MediaPlanDiffEntry, MediaPlanItem, MediaPlanVersionRecord } from "./types";

function itemKey(item: MediaPlanItem): string {
  return item.id;
}

/**
 * Future-ready Comparison Mode: Approved Baseline vs Working Draft.
 * Highlights date / creator / deliverable / platform / add / remove.
 */
export function compareMediaPlanVersions(
  baseline: MediaPlanVersionRecord,
  draft: MediaPlanVersionRecord
): MediaPlanDiffEntry[] {
  const beforeById = new Map(baseline.items.map((item) => [itemKey(item), item]));
  const afterById = new Map(draft.items.map((item) => [itemKey(item), item]));
  const diffs: MediaPlanDiffEntry[] = [];

  for (const [id, before] of beforeById) {
    const after = afterById.get(id);
    if (!after) {
      diffs.push({ changeType: "item_removed", itemId: id, before, after: null });
      continue;
    }
    if (before.plannedDate !== after.plannedDate) {
      diffs.push({
        changeType: "date_changed",
        itemId: id,
        before: { plannedDate: before.plannedDate },
        after: { plannedDate: after.plannedDate },
      });
    }
    if (before.creatorId !== after.creatorId) {
      diffs.push({
        changeType: "creator_changed",
        itemId: id,
        before: { creatorId: before.creatorId, creatorName: before.creatorName },
        after: { creatorId: after.creatorId, creatorName: after.creatorName },
      });
    }
    if (before.deliverable !== after.deliverable) {
      diffs.push({
        changeType: "deliverable_changed",
        itemId: id,
        before: { deliverable: before.deliverable },
        after: { deliverable: after.deliverable },
      });
    }
    if (before.platform !== after.platform) {
      diffs.push({
        changeType: "platform_changed",
        itemId: id,
        before: { platform: before.platform },
        after: { platform: after.platform },
      });
    }
  }

  for (const [id, after] of afterById) {
    if (!beforeById.has(id)) {
      diffs.push({ changeType: "item_added", itemId: id, before: null, after });
    }
  }

  return diffs;
}
