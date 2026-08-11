import { operationalMatchKey } from "./operational-refs";
import type {
  MediaPlanItem,
  MediaPlanPerformanceFact,
  MediaPlanProjectionDay,
  MediaPlanState,
  MediaPlanVersionRecord,
} from "./types";
import { getCurrentApprovedBaseline, getWorkingDraft } from "./versioning";

function matchForItem(
  item: Pick<
    MediaPlanItem,
    | "creatorId"
    | "platform"
    | "deliverable"
    | "campaignLineId"
    | "assignmentDeliverableId"
    | "assignmentPostScheduleId"
  >
) {
  return operationalMatchKey(item);
}

function matchForFact(fact: MediaPlanPerformanceFact) {
  return operationalMatchKey(fact);
}

function actualItemFromFact(fact: MediaPlanPerformanceFact): MediaPlanItem {
  const liveDate = fact.liveDate!;
  const { key, mode } = matchForFact(fact);
  return {
    id: `actual::${key}::${liveDate}`,
    creatorId: fact.creatorId,
    creatorName: fact.creatorName?.trim() || fact.creatorId,
    platform: fact.platform,
    deliverable: fact.deliverable,
    plannedDate: null,
    actualLiveDate: liveDate,
    status: "completed",
    campaignLineId: fact.campaignLineId ?? null,
    assignmentDeliverableId: fact.assignmentDeliverableId ?? null,
    assignmentPostScheduleId: fact.assignmentPostScheduleId ?? null,
    usedLegacyMatch: mode === "legacy_label",
  };
}

/**
 * Actual Media Plan — Performance live dates, matched to the Current Approved
 * Baseline when possible. Unmatched live deliverables still appear (including
 * when the baseline has zero creators / empty schedule).
 * Never uses the Working Draft.
 *
 * Release 2.1: ID-first matching (Assignment / Deliverable / Post).
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
    factsByKey.set(matchForFact(fact).key, fact);
  }

  const items: MediaPlanItem[] = [];
  const matchedKeys = new Set<string>();

  if (baseline) {
    for (const planned of baseline.items) {
      const { key, mode } = matchForItem(planned);
      const fact = factsByKey.get(key);
      if (!fact?.liveDate) continue;
      matchedKeys.add(key);
      items.push({
        ...planned,
        actualLiveDate: fact.liveDate,
        plannedDate: planned.plannedDate,
        status: "completed",
        campaignLineId: planned.campaignLineId ?? fact.campaignLineId ?? null,
        assignmentDeliverableId:
          planned.assignmentDeliverableId ?? fact.assignmentDeliverableId ?? null,
        assignmentPostScheduleId:
          planned.assignmentPostScheduleId ?? fact.assignmentPostScheduleId ?? null,
        usedLegacyMatch: mode === "legacy_label",
      });
    }
  }

  // Include live Performance rows that have no matching planned baseline item.
  for (const fact of factsWithLive) {
    const key = matchForFact(fact).key;
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
 * Remaining Media Plan — tip schedule minus completed deliverables.
 *
 * Uses the Working Draft when open (so Remaining reschedules stick), otherwise
 * the Current Approved Baseline. Completed Performance grains are always excluded.
 * Actual still matches against the approved baseline separately.
 *
 * Release 2.1: ID-first matching (Assignment / Deliverable / Post).
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
  const tip = getWorkingDraft(state) ?? baseline;
  if (!tip) {
    return { baselineVersion: null, days: [], items: [], unscheduled: [] };
  }

  const completedKeys = new Set(
    performance
      .filter((fact) => fact.completed)
      .map((fact) => matchForFact(fact).key)
  );

  const remaining = tip.items
    .filter((item) => !completedKeys.has(matchForItem(item).key))
    .map((item) => ({
      ...item,
      status: "remaining" as const,
      actualLiveDate: null,
      usedLegacyMatch: matchForItem(item).mode === "legacy_label",
    }));

  const scheduled = remaining.filter((item) => item.plannedDate);
  const unscheduled = remaining.filter((item) => !item.plannedDate);

  return {
    baselineVersion: baseline?.version ?? null,
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
    .map(([date, dayItems]) => ({
      date,
      creators: groupCreators(dayItems),
    }));
}

function groupCreators(items: MediaPlanItem[]): MediaPlanProjectionDay["creators"] {
  const byCreator = new Map<string, MediaPlanProjectionDay["creators"][number]>();
  for (const item of items) {
    const key = item.campaignLineId?.trim() || item.creatorId;
    const existing = byCreator.get(key);
    const deliverable = {
      platform: item.platform,
      deliverable: item.deliverable,
      itemId: item.id,
    };
    if (existing) {
      existing.deliverables.push(deliverable);
      continue;
    }
    byCreator.set(key, {
      creatorId: item.creatorId,
      creatorName: item.creatorName,
      deliverables: [deliverable],
    });
  }
  return [...byCreator.values()];
}
