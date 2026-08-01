import type {
  BusinessProcessLifecycleSignal,
  BusinessProcessProgress,
  BusinessProcessStageDefinition,
} from "@/lib/business-process/types";

/**
 * Build per-stage rail signals from ordered stage definitions.
 * Navigation is never disabled — signals are educational only.
 */
export function buildStageRailSignals<TStageId extends string>(
  stages: readonly BusinessProcessStageDefinition<TStageId>[],
  currentStageId: TStageId,
  currentSignal: BusinessProcessLifecycleSignal
): Partial<Record<TStageId, BusinessProcessLifecycleSignal>> {
  const indexById = new Map(stages.map((stage, index) => [stage.id, index]));
  const currentIndex = indexById.get(currentStageId) ?? 0;
  const signals: Partial<Record<TStageId, BusinessProcessLifecycleSignal>> = {};

  for (const stage of stages) {
    const index = indexById.get(stage.id) ?? 0;
    if (stage.id === currentStageId) {
      signals[stage.id] = currentSignal === "completed" ? "current" : currentSignal;
      continue;
    }
    if (index < currentIndex) {
      signals[stage.id] = "completed";
      continue;
    }
    signals[stage.id] = "upcoming";
  }

  return signals;
}

export function nextStageAfter<TStageId extends string>(
  stages: readonly BusinessProcessStageDefinition<TStageId>[],
  currentStageId: TStageId
): BusinessProcessStageDefinition<TStageId> | null {
  const index = stages.findIndex((stage) => stage.id === currentStageId);
  if (index < 0 || index >= stages.length - 1) return null;
  return stages[index + 1] ?? null;
}

export function withRailSignals<TStageId extends string>(
  stages: readonly BusinessProcessStageDefinition<TStageId>[],
  progress: Omit<BusinessProcessProgress<TStageId>, "stageSignals">
): BusinessProcessProgress<TStageId> {
  return {
    ...progress,
    stageSignals: buildStageRailSignals(
      stages,
      progress.currentStageId,
      progress.lifecycleSignal
    ),
  };
}
