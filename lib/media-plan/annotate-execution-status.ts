/**
 * Overlay Performance live dates onto Media Plan calendar cards.
 * Same annotation for Studio tip and Campaign Original so published creators
 * share one visual language.
 *
 * Release 2.1: Assignment ID-first matching; creator/label is display fallback only.
 */

import type {
  MediaPlanAdditionalDeliverable,
  MediaPlanData,
  MediaPlanDay,
  MediaPlanExecutionStatus,
} from "@/features/campaign-outputs/generators/media-plan";

import { operationalMatchKey } from "./operational-refs";
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

type CompletedFact = MediaPlanPerformanceFact & { liveDate: string };

function indexCompletedFacts(facts: MediaPlanPerformanceFact[]): {
  byOperationalKey: Map<string, CompletedFact[]>;
  byLineId: Map<string, CompletedFact[]>;
  byCreator: Map<string, CompletedFact[]>;
} {
  const byOperationalKey = new Map<string, CompletedFact[]>();
  const byLineId = new Map<string, CompletedFact[]>();
  const byCreator = new Map<string, CompletedFact[]>();

  for (const fact of facts) {
    if (!fact.completed || !fact.liveDate) continue;
    const completed = fact as CompletedFact;

    const opKey = operationalMatchKey(fact).key;
    const opList = byOperationalKey.get(opKey) ?? [];
    opList.push(completed);
    byOperationalKey.set(opKey, opList);

    const lineId = fact.campaignLineId?.trim();
    if (lineId) {
      const lineList = byLineId.get(normId(lineId)) ?? [];
      lineList.push(completed);
      byLineId.set(normId(lineId), lineList);
    }

    if (fact.creatorId?.trim()) {
      const creatorList = byCreator.get(`id:${normId(fact.creatorId)}`) ?? [];
      creatorList.push(completed);
      byCreator.set(`id:${normId(fact.creatorId)}`, creatorList);
    }
    if (fact.creatorName?.trim()) {
      const nameList = byCreator.get(`name:${normLabel(fact.creatorName)}`) ?? [];
      nameList.push(completed);
      byCreator.set(`name:${normLabel(fact.creatorName)}`, nameList);
    }
  }

  return { byOperationalKey, byLineId, byCreator };
}

function typesOf(entry: {
  serviceTypes?: string[];
  serviceType?: string;
}): string[] {
  if (entry.serviceTypes?.length) return entry.serviceTypes.filter((t) => t.trim());
  if (entry.serviceType?.trim()) return [entry.serviceType.trim()];
  return [];
}

function factsForCard(
  index: ReturnType<typeof indexCompletedFacts>,
  entry: MediaPlanDay | MediaPlanAdditionalDeliverable
): CompletedFact[] {
  const types = typesOf(entry);
  const seen = new Set<CompletedFact>();
  const out: CompletedFact[] = [];

  const pushUnique = (facts: CompletedFact[]) => {
    for (const fact of facts) {
      if (seen.has(fact)) continue;
      seen.add(fact);
      out.push(fact);
    }
  };

  // 1) Exact operational key per typed deliverable when Assignment refs exist.
  if (entry.campaignLineId?.trim() && types.length) {
    for (const type of types) {
      const key = operationalMatchKey({
        campaignLineId: entry.campaignLineId,
        assignmentDeliverableId: entry.assignmentDeliverableId,
        assignmentPostScheduleId: entry.assignmentPostScheduleId,
        creatorId: entry.creatorId,
        platform: entry.platform,
        deliverable: type,
      }).key;
      pushUnique(index.byOperationalKey.get(key) ?? []);
    }
    if (out.length) return out;
  }

  // 2) All completed facts on the Assignment line.
  if (entry.campaignLineId?.trim()) {
    pushUnique(index.byLineId.get(normId(entry.campaignLineId)) ?? []);
    if (out.length) return out;
  }

  // 3) Legacy creator fallback (pre-2.1 plans without Assignment IDs).
  if (entry.creatorId?.trim()) {
    pushUnique(index.byCreator.get(`id:${normId(entry.creatorId)}`) ?? []);
  }
  if (entry.creator?.trim()) {
    pushUnique(index.byCreator.get(`name:${normLabel(entry.creator)}`) ?? []);
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
    // Creator/Assignment went live even if type labels differ — keep published overlay.
    return { executionStatus: "published", actualLiveDate: earliest };
  }
  if (matched >= types.length) {
    return { executionStatus: "published", actualLiveDate: earliest };
  }
  return { executionStatus: "partial", actualLiveDate: earliest };
}

function annotateEntry<T extends MediaPlanDay | MediaPlanAdditionalDeliverable>(
  entry: T,
  index: ReturnType<typeof indexCompletedFacts>
): T {
  if (!entry.creatorId && !entry.creator && !entry.campaignLineId) return entry;
  const creatorFacts = factsForCard(index, entry);
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
          day.creatorId || day.creator || day.campaignLineId
            ? {
                ...day,
                executionStatus: day.executionStatus ?? "planned",
                actualLiveDate: day.actualLiveDate ?? null,
              }
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
        if (
          !day.creatorId &&
          !day.creator &&
          !day.campaignLineId &&
          !day.additionalDeliverables?.length
        ) {
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
