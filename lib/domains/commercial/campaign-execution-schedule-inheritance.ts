import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

import type { CampaignPlanLineSeed } from "./campaign-plan-execution-mapper";
import {
  normalizeCreatorScheduleKey,
  type CreatorTentativeScheduleBundle,
  type ScheduleByCreatorKey,
} from "./campaign-plan-tentative-schedule";
import {
  readTentativeScheduleFromDeliverable,
} from "./quotation-tentative-schedule";
import type { QuotationDeliverable, QuotationTentativeScheduleFields } from "./quotation-types";

export type ExecutionDeliverableScheduleHint = {
  platform: string;
  deliverableType: string;
} & QuotationTentativeScheduleFields;

export type ExecutionLineSeed = CampaignPlanLineSeed & {
  scheduleHints: ExecutionDeliverableScheduleHint[];
};

function scheduleForPlatform(
  bundle: CreatorTentativeScheduleBundle,
  platform: string
): QuotationTentativeScheduleFields {
  return bundle.byPlatform[canonicalPlatformKey(platform)] ?? bundle.primary;
}

/** Build per-deliverable schedule hints from a plan line seed + creator bundle. */
export function buildScheduleHintsFromLineSeed(
  seed: CampaignPlanLineSeed,
  bundle: CreatorTentativeScheduleBundle
): ExecutionDeliverableScheduleHint[] {
  const hints: ExecutionDeliverableScheduleHint[] = [];

  for (const platform of seed.platforms) {
    const schedule = scheduleForPlatform(bundle, platform.platform);
    for (const deliverableType of platform.deliverables) {
      hints.push({
        platform: canonicalPlatformKey(platform.platform),
        deliverableType,
        ...schedule,
      });
    }
  }

  return hints;
}

export function attachScheduleHintsToLineSeeds(input: {
  seeds: CampaignPlanLineSeed[];
  scheduleByCreatorKey: ScheduleByCreatorKey;
}): ExecutionLineSeed[] {
  return input.seeds.map((seed) => {
    const bundle =
      input.scheduleByCreatorKey.get(normalizeCreatorScheduleKey(seed.unifiedId)) ??
      input.scheduleByCreatorKey.get(normalizeCreatorScheduleKey(seed.displayName));

    return {
      ...seed,
      scheduleHints: bundle ? buildScheduleHintsFromLineSeed(seed, bundle) : [],
    };
  });
}

/** Extract schedule hints from quotation deliverable rows (commercial snapshot). */
export function buildScheduleHintsFromQuotationDeliverables(
  deliverables: QuotationDeliverable[]
): ExecutionDeliverableScheduleHint[] {
  const hints: ExecutionDeliverableScheduleHint[] = [];

  for (const deliverable of deliverables) {
    const schedule = readTentativeScheduleFromDeliverable(deliverable);
    const platform = canonicalPlatformKey(deliverable.platform);
    const typeLines = deliverable.type_lines?.length
      ? deliverable.type_lines
      : deliverable.type
        ? [{ type: deliverable.type, quantity: 1 }]
        : [];

    for (const line of typeLines) {
      const qty = Math.max(1, Math.floor(line.quantity || 1));
      for (let index = 0; index < qty; index += 1) {
        hints.push({
          platform,
          deliverableType: line.type.trim(),
          ...schedule,
        });
      }
    }
  }

  return hints;
}

export function resolveHintForDeliverable(
  hints: ExecutionDeliverableScheduleHint[],
  platform: string,
  deliverableType: string,
  usedIndexes: Set<number>
): ExecutionDeliverableScheduleHint | null {
  const platformKey = canonicalPlatformKey(platform);
  const typeKey = deliverableType.trim().toLowerCase();

  for (let index = 0; index < hints.length; index += 1) {
    if (usedIndexes.has(index)) continue;
    const hint = hints[index]!;
    if (
      canonicalPlatformKey(hint.platform) === platformKey &&
      hint.deliverableType.trim().toLowerCase() === typeKey
    ) {
      usedIndexes.add(index);
      return hint;
    }
  }

  for (let index = 0; index < hints.length; index += 1) {
    if (usedIndexes.has(index)) continue;
    const hint = hints[index]!;
    if (canonicalPlatformKey(hint.platform) === platformKey) {
      usedIndexes.add(index);
      return hint;
    }
  }

  return null;
}

export function resolveOperationalLiveDate(
  hint: ExecutionDeliverableScheduleHint | null,
  fallbackDate: string | null
): string | null {
  return hint?.tentative_posting_date?.trim().slice(0, 10) ?? fallbackDate;
}
