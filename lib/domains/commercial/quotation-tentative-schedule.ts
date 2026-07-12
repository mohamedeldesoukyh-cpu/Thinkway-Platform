import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

import {
  normalizeCreatorScheduleKey,
  type CreatorTentativeScheduleBundle,
  type ScheduleByCreatorKey,
} from "./campaign-plan-tentative-schedule";
import type {
  QuotationDeliverable,
  QuotationItemSeed,
  QuotationTentativeScheduleFields,
} from "./quotation-types";

const TENTATIVE_SCHEDULE_KEYS: (keyof QuotationTentativeScheduleFields)[] = [
  "tentative_posting_date",
  "tentative_posting_label",
  "planned_week",
  "planned_day",
  "schedule_source",
];

export function readTentativeScheduleFromDeliverable(
  deliverable: QuotationDeliverable
): QuotationTentativeScheduleFields {
  return {
    tentative_posting_date: deliverable.tentative_posting_date ?? null,
    tentative_posting_label: deliverable.tentative_posting_label ?? null,
    planned_week: deliverable.planned_week ?? null,
    planned_day: deliverable.planned_day ?? null,
    schedule_source: deliverable.schedule_source ?? null,
  };
}

export function hasTentativeSchedule(
  deliverable: QuotationDeliverable
): boolean {
  const schedule = readTentativeScheduleFromDeliverable(deliverable);
  return Boolean(
    schedule.tentative_posting_label ||
      schedule.tentative_posting_date ||
      schedule.planned_week != null
  );
}

function resolveCreatorBundle(
  item: Pick<QuotationItemSeed, "unified_id" | "creator_name">,
  scheduleByCreatorKey: ScheduleByCreatorKey
): CreatorTentativeScheduleBundle | null {
  const unifiedKey = item.unified_id
    ? normalizeCreatorScheduleKey(item.unified_id)
    : null;
  if (unifiedKey && scheduleByCreatorKey.has(unifiedKey)) {
    return scheduleByCreatorKey.get(unifiedKey)!;
  }

  const nameKey = item.creator_name
    ? normalizeCreatorScheduleKey(item.creator_name)
    : null;
  if (nameKey && scheduleByCreatorKey.has(nameKey)) {
    return scheduleByCreatorKey.get(nameKey)!;
  }

  return null;
}

function scheduleForDeliverable(
  deliverable: QuotationDeliverable,
  bundle: CreatorTentativeScheduleBundle
): QuotationTentativeScheduleFields {
  const platformKey = canonicalPlatformKey(deliverable.platform);
  return bundle.byPlatform[platformKey] ?? bundle.primary;
}

export function mergeTentativeScheduleIntoDeliverable(
  deliverable: QuotationDeliverable,
  schedule: QuotationTentativeScheduleFields
): QuotationDeliverable {
  return {
    ...deliverable,
    ...schedule,
  };
}

export function applyTentativeScheduleToDeliverables(
  deliverables: QuotationDeliverable[],
  bundle: CreatorTentativeScheduleBundle
): QuotationDeliverable[] {
  if (deliverables.length === 0) return deliverables;
  return deliverables.map((deliverable) =>
    mergeTentativeScheduleIntoDeliverable(
      deliverable,
      scheduleForDeliverable(deliverable, bundle)
    )
  );
}

export type QuotationItemWithDeliverables = Pick<
  QuotationItemSeed,
  "unified_id" | "creator_name" | "deliverables"
> & { id?: string };

export type ApplyTentativeScheduleResult<T extends QuotationItemWithDeliverables> = {
  items: T[];
  matchedItemCount: number;
  updatedDeliverableCount: number;
};

/** Merge tentative schedule into quotation item deliverables without wiping commercial fields. */
export function applyTentativeScheduleToQuotationItems<
  T extends QuotationItemWithDeliverables,
>(items: T[], scheduleByCreatorKey: ScheduleByCreatorKey): ApplyTentativeScheduleResult<T> {
  let matchedItemCount = 0;
  let updatedDeliverableCount = 0;

  const nextItems = items.map((item) => {
    const bundle = resolveCreatorBundle(item, scheduleByCreatorKey);
    if (!bundle) return item;

    const deliverables = item.deliverables ?? [];
    if (deliverables.length === 0) return item;

    matchedItemCount += 1;
    const nextDeliverables = applyTentativeScheduleToDeliverables(deliverables, bundle);
    updatedDeliverableCount += nextDeliverables.length;

    return {
      ...item,
      deliverables: nextDeliverables,
    };
  });

  return {
    items: nextItems,
    matchedItemCount,
    updatedDeliverableCount,
  };
}

export function stripTentativeScheduleFromDeliverable(
  deliverable: QuotationDeliverable
): QuotationDeliverable {
  const next = { ...deliverable };
  for (const key of TENTATIVE_SCHEDULE_KEYS) {
    delete next[key];
  }
  return next;
}
