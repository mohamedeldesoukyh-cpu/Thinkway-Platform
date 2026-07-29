/**
 * Overlay Performance live dates onto Media Plan calendar cards.
 * Same annotation for Studio tip and Campaign Original so published creators
 * share one visual language.
 */

import type {
  MediaPlanAdditionalDeliverable,
  MediaPlanData,
  MediaPlanDay,
  MediaPlanExecutionStatus,
} from "@/features/campaign-outputs/generators/media-plan";

import type { MediaPlanPerformanceFact } from "./types";

function normId(id: string): string {
  return id.trim().toLowerCase();
}

function normLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

function baseDeliverableLabel(label: string): string {
  const match = label.trim().match(/^(\d+)\s*×\s*(.+)$/i);
  return normLabel(match?.[2] ?? label);
}

function deliverableLabelsMatch(cardType: string, factDeliverable: string): boolean {
  const cardFull = normLabel(cardType);
  const factFull = normLabel(factDeliverable);
  if (cardFull === factFull) return true;
  return baseDeliverableLabel(cardType) === baseDeliverableLabel(factDeliverable);
}

function creatorKeys(creatorId?: string | null, creatorName?: string | null): string[] {
  const keys: string[] = [];
  if (creatorId?.trim()) keys.push(`id:${normId(creatorId)}`);
  if (creatorName?.trim()) keys.push(`name:${normLabel(creatorName)}`);
  return keys;
}

type CompletedFact = MediaPlanPerformanceFact & { liveDate: string };

function indexCompletedFacts(facts: MediaPlanPerformanceFact[]): Map<string, CompletedFact[]> {
  const byKey = new Map<string, CompletedFact[]>();
  for (const fact of facts) {
    if (!fact.completed || !fact.liveDate) continue;
    const completed = fact as CompletedFact;
    for (const key of creatorKeys(fact.creatorId, fact.creatorName)) {
      const list = byKey.get(key) ?? [];
      list.push(completed);
      byKey.set(key, list);
    }
  }
  return byKey;
}

function factsForCreator(
  index: Map<string, CompletedFact[]>,
  creatorId?: string,
  creatorName?: string
): CompletedFact[] {
  const seen = new Set<CompletedFact>();
  const out: CompletedFact[] = [];
  for (const key of creatorKeys(creatorId, creatorName)) {
    for (const fact of index.get(key) ?? []) {
      if (seen.has(fact)) continue;
      seen.add(fact);
      out.push(fact);
    }
  }
  return out;
}

function resolveCardExecution(
  types: string[],
  creatorFacts: CompletedFact[]
): { executionStatus: MediaPlanExecutionStatus; actualLiveDate: string | null } {
  if (!creatorFacts.length) {
    return { executionStatus: "planned", actualLiveDate: null };
  }

  const liveDates = creatorFacts.map((fact) => fact.liveDate).sort();
  const earliest = liveDates[0] ?? null;

  if (!types.length) {
    return { executionStatus: "published", actualLiveDate: earliest };
  }

  let matched = 0;
  for (const type of types) {
    if (creatorFacts.some((fact) => deliverableLabelsMatch(type, fact.deliverable))) {
      matched += 1;
    }
  }

  if (matched <= 0) {
    // Creator has live content but labels did not align — still mark published
    // so operators see the influencer went live.
    return { executionStatus: "published", actualLiveDate: earliest };
  }
  if (matched >= types.length) {
    return { executionStatus: "published", actualLiveDate: earliest };
  }
  return { executionStatus: "partial", actualLiveDate: earliest };
}

function typesOf(entry: {
  serviceTypes?: string[];
  serviceType?: string;
}): string[] {
  if (entry.serviceTypes?.length) return entry.serviceTypes.filter((t) => t.trim());
  if (entry.serviceType?.trim()) return [entry.serviceType.trim()];
  return [];
}

function annotateEntry<T extends MediaPlanDay | MediaPlanAdditionalDeliverable>(
  entry: T,
  index: Map<string, CompletedFact[]>
): T {
  if (!entry.creatorId && !entry.creator) return entry;
  const creatorFacts = factsForCreator(index, entry.creatorId, entry.creator);
  const { executionStatus, actualLiveDate } = resolveCardExecution(
    typesOf(entry),
    creatorFacts
  );
  return {
    ...entry,
    executionStatus,
    actualLiveDate,
  };
}

/**
 * Stamp executionStatus onto every creator card from Performance facts.
 * Idempotent — safe to call on already-annotated data.
 */
export function annotateMediaPlanExecutionStatus(
  data: MediaPlanData,
  facts: MediaPlanPerformanceFact[]
): MediaPlanData {
  if (!facts.length) {
    return {
      ...data,
      weeks: data.weeks.map((week) => ({
        ...week,
        days: week.days.map((day) =>
          day.creatorId || day.creator
            ? { ...day, executionStatus: day.executionStatus ?? "planned", actualLiveDate: day.actualLiveDate ?? null }
            : day
        ),
      })),
    };
  }

  const index = indexCompletedFacts(facts);
  return {
    ...data,
    weeks: data.weeks.map((week) => ({
      ...week,
      days: week.days.map((day) => {
        if (!day.creatorId && !day.creator && !day.additionalDeliverables?.length) {
          return day;
        }
        const annotated = annotateEntry(day, index);
        return {
          ...annotated,
          additionalDeliverables: day.additionalDeliverables?.map((extra) =>
            annotateEntry(extra, index)
          ),
        };
      }),
    })),
  };
}
