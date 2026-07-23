/**
 * Pre-render validation — the quotation is the single source of truth.
 *
 * Before exporting a Media Plan, every scheduled activation must exactly match
 * the commercial agreement. Failures trigger reschedule, never silent export.
 */

import { parseServiceTypeQuantity } from "./media-plan-scheduler-types";
import { isUgcServiceType } from "./media-plan-deliverable-classification";
import type { ScheduledDeliverablePlacement } from "./media-plan-scheduler-types";
import { validateQuotationActivationContract, type ImmutableQuotationActivation } from "./media-plan-quotation-activations";
import type { SlateCreator } from "./output-inputs";

export type MediaPlanValidationCheck = {
  name: string;
  pass: boolean;
  expected?: string | number;
  actual?: string | number;
};

export type MediaPlanValidationResult = {
  ok: boolean;
  checks: MediaPlanValidationCheck[];
  errors: string[];
};

function flattenQuotationLines(slate: SlateCreator[]): string[] {
  const lines: string[] = [];
  for (const creator of slate) {
    const types = creator.serviceTypes?.length
      ? creator.serviceTypes
      : creator.serviceLabel
        ? creator.serviceLabel.split(/\s*(?:\+|·)\s*/).map((part) => part.trim()).filter(Boolean)
        : [];
    for (const raw of types) {
      const { quantity, baseLabel } = parseServiceTypeQuantity(raw);
      for (let index = 0; index < quantity; index += 1) {
        lines.push(`1× ${baseLabel}`);
      }
    }
  }
  return lines;
}

function normalizeDeliverableKey(line: string): string {
  return line.trim().toLowerCase().replace(/\s+/g, " ");
}

function countDeliverableTypes(lines: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const key = normalizeDeliverableKey(line);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function scheduledActivationLines(placements: ScheduledDeliverablePlacement[]): string[] {
  const lines: string[] = [];
  for (const placement of placements) {
    const deliverable = placement.deliverable;
    lines.push(deliverable.serviceType);
    for (const companion of deliverable.attachedCompanions ?? []) {
      lines.push(companion.serviceType);
    }
    for (const mirror of deliverable.attachedMirrors ?? []) {
      lines.push(mirror.serviceType);
    }
  }
  return lines;
}

function countUgcActivations(placements: ScheduledDeliverablePlacement[]): number {
  return placements.filter((placement) => placement.deliverable.role === "ugc").length;
}

function countQuotationUgcLines(slate: SlateCreator[]): number {
  let total = 0;
  for (const creator of slate) {
    const types = creator.serviceTypes?.length
      ? creator.serviceTypes
      : creator.serviceLabel
        ? creator.serviceLabel.split(/\s*(?:\+|·)\s*/).map((part) => part.trim()).filter(Boolean)
        : [];
    for (const type of types) {
      const { quantity, baseLabel } = parseServiceTypeQuantity(type);
      if (isUgcServiceType(`1× ${baseLabel}`, creator)) {
        total += quantity;
      }
    }
  }
  return total;
}

function activationsPerWeek(
  placements: ScheduledDeliverablePlacement[],
  durationWeeks: number
): number[] {
  const counts = Array.from({ length: durationWeeks }, () => 0);
  for (const placement of placements) {
    const weekIndex = placement.week - 1;
    if (weekIndex >= 0 && weekIndex < durationWeeks) {
      counts[weekIndex]! += 1;
    }
  }
  return counts;
}

/** Minimum activations each week should carry for a sustained (non-burst) campaign. */
export function minimumActivationsPerWeek(
  totalActivations: number,
  durationWeeks: number
): number {
  if (durationWeeks <= 1 || totalActivations <= 0) return 0;
  if (totalActivations < durationWeeks) return 0;
  return 1;
}

export function validateMediaPlanAgainstQuotation(input: {
  slate: SlateCreator[];
  placements: ScheduledDeliverablePlacement[];
  activations: ImmutableQuotationActivation[];
  durationWeeks: number;
  /** When true, every week must carry at least one activation. */
  requireContinuousPresence?: boolean;
}): MediaPlanValidationResult {
  const checks: MediaPlanValidationCheck[] = [];
  const errors: string[] = [];

  const quotationLines = flattenQuotationLines(input.slate);
  const scheduledLines = scheduledActivationLines(input.placements);
  const contract = validateQuotationActivationContract(input.slate, input.activations);

  checks.push({
    name: "Quotation activations = scheduled activations",
    pass: input.placements.length === input.activations.length,
    expected: input.activations.length,
    actual: input.placements.length,
  });
  if (!checks.at(-1)!.pass) {
    errors.push(
      `Activation count mismatch: quotation defines ${input.activations.length}, schedule placed ${input.placements.length}`
    );
  }

  checks.push({
    name: "Quotation lines = scheduled lines",
    pass: contract.ok && quotationLines.length === scheduledLines.length,
    expected: contract.expected,
    actual: scheduledLines.length,
  });
  if (!contract.ok) {
    errors.push(
      `Quotation contract breach: expected ${contract.expected} deliverable lines, schedule accounts for ${contract.accounted}`
    );
  }

  const quotationTypes = countDeliverableTypes(quotationLines);
  const scheduledTypes = countDeliverableTypes(scheduledLines);
  for (const [type, expected] of quotationTypes) {
    const actual = scheduledTypes.get(type) ?? 0;
    const pass = actual === expected;
    checks.push({
      name: `Quotation ${type} = ${expected}`,
      pass,
      expected,
      actual,
    });
    if (!pass) {
      errors.push(`Deliverable integrity: quotation ${type} = ${expected}, scheduled = ${actual}`);
    }
  }

  const quotationUgc = countQuotationUgcLines(input.slate);
  const scheduledUgc = countUgcActivations(input.placements);
  checks.push({
    name: "Quotation UGC = scheduled UGC",
    pass: quotationUgc === scheduledUgc,
    expected: quotationUgc,
    actual: scheduledUgc,
  });
  if (quotationUgc !== scheduledUgc) {
    errors.push(`UGC integrity: quotation defines ${quotationUgc} UGC, schedule contains ${scheduledUgc}`);
  }

  const perWeek = activationsPerWeek(input.placements, input.durationWeeks);
  const minPerWeek = minimumActivationsPerWeek(input.placements.length, input.durationWeeks);
  const requirePresence = input.requireContinuousPresence !== false && minPerWeek > 0;
  if (requirePresence) {
    for (let week = 1; week <= input.durationWeeks; week += 1) {
      const count = perWeek[week - 1] ?? 0;
      const pass = count >= minPerWeek;
      checks.push({
        name: `Week ${week} meaningful activity`,
        pass,
        expected: `≥${minPerWeek}`,
        actual: count,
      });
      if (!pass) {
        errors.push(`Week ${week} has no meaningful campaign activity (${count} activations)`);
      }
    }
  }

  return { ok: errors.length === 0, checks, errors };
}
