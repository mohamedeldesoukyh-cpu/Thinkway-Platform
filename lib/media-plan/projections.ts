import type {
  MediaPlanItem,
  MediaPlanPerformanceFact,
  MediaPlanProjectionDay,
  MediaPlanState,
  MediaPlanVersionRecord,
} from "./types";
import { getCurrentApprovedBaseline } from "./versioning";

function itemMatchKey(item: Pick<MediaPlanItem, "creatorId" | "platform" | "deliverable">): string {
  return [
    item.creatorId.trim().toLowerCase(),
    item.platform.trim().toLowerCase(),
    item.deliverable.trim().toLowerCase(),
  ].join("::");
}

function factMatchKey(fact: MediaPlanPerformanceFact): string {
  return itemMatchKey(fact);
}

function actualItemFromFact(fact: MediaPlanPerformanceFact): MediaPlanItem {
  const liveDate = fact.liveDate!;
  const key = factMatchKey(fact);
  return {
    id: `actual::${key}::${liveDate}`,
    creatorId: fact.creatorId,
    creatorName: fact.creatorName?.trim() || fact.creatorId,
    platform: fact.platform,
    deliverable: fact.deliverable,
    plannedDate: null,
    actualLiveDate: liveDate,
    status: "completed",
  };
}

/**
 * Actual Media Plan — Performance live dates, matched to the Current Approved
 * Baseline when possible. Unmatched live deliverables still appear (including
 * when the baseline has zero creators / empty schedule).
 * Never uses the Working Draft.
 */
export function projectActualMediaPlan(
  state: MediaPlanState,
  performance: MediaPlanPerformanceFact[]
): {
  baselineVersion: number | null;
  days: MediaPlanProjectionDay[];
  items: MediaPlanItem[];
} {
  const baseline = getCurrentApprovedBaseline(state);
  const factsWithLive = performance.filter((fact) => Boolean(fact.liveDate));

  const factsByKey = new Map<string, MediaPlanPerformanceFact>();
  for (const fact of factsWithLive) {
    factsByKey.set(factMatchKey(fact), fact);
  }

  const items: MediaPlanItem[] = [];
  const matchedKeys = new Set<string>();

  if (baseline) {
    for (const planned of baseline.items) {
      const key = itemMatchKey(planned);
      const fact = factsByKey.get(key);
      if (!fact?.liveDate) continue;
      matchedKeys.add(key);
      items.push({
        ...planned,
        actualLiveDate: fact.liveDate,
        plannedDate: planned.plannedDate,
        status: "completed",
      });
    }
  }

  // Include live Performance rows that have no matching planned baseline item.
  for (const fact of factsWithLive) {
    const key = factMatchKey(fact);
    if (matchedKeys.has(key)) continue;
    items.push(actualItemFromFact(fact));
    matchedKeys.add(key);
  }

  return {
    baselineVersion: baseline?.version ?? null,
    days: groupItemsByDate(items, "actualLiveDate"),
    items,
  };
}

/**
 * Remaining Media Plan — Current Approved Baseline minus completed deliverables.
 * Never uses the Working Draft.
 */
export function projectRemainingMediaPlan(
  state: MediaPlanState,
  performance: MediaPlanPerformanceFact[]
): {
  baselineVersion: number | null;
  days: MediaPlanProjectionDay[];
  items: MediaPlanItem[];
  unscheduled: MediaPlanItem[];
} {
  const baseline = getCurrentApprovedBaseline(state);
  if (!baseline) {
    return { baselineVersion: null, days: [], items: [], unscheduled: [] };
  }

  const completedKeys = new Set(
    performance.filter((fact) => fact.completed).map((fact) => factMatchKey(fact))
  );

  const remaining = baseline.items
    .filter((item) => !completedKeys.has(itemMatchKey(item)))
    .map((item) => ({ ...item, status: "remaining" as const, actualLiveDate: null }));

  const scheduled = remaining.filter((item) => item.plannedDate);
  const unscheduled = remaining.filter((item) => !item.plannedDate);

  return {
    baselineVersion: baseline.version,
    days: groupItemsByDate(scheduled, "plannedDate"),
    items: remaining,
    unscheduled,
  };
}

/** Original view items — working draft when present, else approved baseline. */
export function projectOriginalWorkingView(
  state: MediaPlanState
): MediaPlanVersionRecord | null {
  if (state.workingDraftVersion != null) {
    return state.versions.find((v) => v.version === state.workingDraftVersion) ?? null;
  }
  return getCurrentApprovedBaseline(state);
}

function groupItemsByDate(
  items: MediaPlanItem[],
  dateField: "plannedDate" | "actualLiveDate"
): MediaPlanProjectionDay[] {
  const byDate = new Map<string, MediaPlanItem[]>();
  for (const item of items) {
    const date = item[dateField];
    if (!date) continue;
    const list = byDate.get(date) ?? [];
    list.push(item);
    byDate.set(date, list);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayItems]) => {
      const byCreator = new Map<string, MediaPlanItem[]>();
      for (const item of dayItems) {
        const list = byCreator.get(item.creatorId) ?? [];
        list.push(item);
        byCreator.set(item.creatorId, list);
      }
      return {
        date,
        creators: [...byCreator.entries()].map(([creatorId, creatorItems]) => ({
          creatorId,
          creatorName: creatorItems[0]!.creatorName,
          deliverables: creatorItems.map((item) => ({
            platform: item.platform,
            deliverable: item.deliverable,
            itemId: item.id,
          })),
        })),
      };
    });
}
