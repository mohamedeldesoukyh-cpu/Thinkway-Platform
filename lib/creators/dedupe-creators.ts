import type { GroundedCreator } from "@/features/ai-workflows/formatters/creator-formatter";

export type CreatorIntegrityStage =
  | "browseUnifiedCreators"
  | "searchCreatorsTool"
  | "workflowSearchResults"
  | "campaignObjectDiscovery"
  | "campaignObjectRecommendations"
  | "rankingInput"
  | "rankingOutput"
  | "uiHydration"
  | "uiRender";

export type CreatorIntegrityViolation = {
  stage: CreatorIntegrityStage | string;
  duplicateIds: string[];
  totalCount: number;
  uniqueCount: number;
};

export type CreatorStageCount = {
  stage: CreatorIntegrityStage | string;
  before: number;
  after: number;
  duplicatesRemoved: number;
};

/** Normalize creator id for dedupe — unified_id, inf:, dis:, or raw influencer id. */
export function normalizeCreatorIdForDedupe(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes(":")) return trimmed;
  return trimmed;
}

export function findDuplicateCreatorIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const raw of ids) {
    const id = normalizeCreatorIdForDedupe(raw);
    if (!id) continue;
    if (seen.has(id)) duplicates.add(id);
    else seen.add(id);
  }

  return [...duplicates];
}

export function dedupeCreatorIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of ids) {
    const id = normalizeCreatorIdForDedupe(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }

  return result;
}

export function dedupeByCreatorId<T>(
  items: readonly T[],
  getId: (item: T) => string | null | undefined
): { items: T[]; stageCount: CreatorStageCount } {
  const before = items.length;
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const item of items) {
    const rawId = getId(item);
    const id = rawId ? normalizeCreatorIdForDedupe(rawId) : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push(item);
  }

  return {
    items: deduped,
    stageCount: {
      stage: "dedupe",
      before,
      after: deduped.length,
      duplicatesRemoved: before - deduped.length,
    },
  };
}

export function dedupeGroundedCreators(
  creators: readonly GroundedCreator[],
  stage: CreatorIntegrityStage | string = "dedupe"
): { creators: GroundedCreator[]; stageCount: CreatorStageCount } {
  const { items, stageCount } = dedupeByCreatorId(creators, (c) => c.id);
  return { creators: items, stageCount: { ...stageCount, stage } };
}

export function assertNoDuplicateCreatorIds(
  ids: readonly string[],
  stage: CreatorIntegrityStage | string
): CreatorIntegrityViolation | null {
  const duplicateIds = findDuplicateCreatorIds(ids);
  if (duplicateIds.length === 0) return null;

  const uniqueCount = dedupeCreatorIds(ids).length;
  return {
    stage,
    duplicateIds,
    totalCount: ids.length,
    uniqueCount,
  };
}

export function assertNoDuplicateGroundedCreators(
  creators: readonly GroundedCreator[],
  stage: CreatorIntegrityStage | string
): CreatorIntegrityViolation | null {
  return assertNoDuplicateCreatorIds(
    creators.map((c) => c.id),
    stage
  );
}

export function formatIntegrityViolation(v: CreatorIntegrityViolation): string {
  return `[${v.stage}] ${v.duplicateIds.length} duplicate id(s): ${v.duplicateIds.join(", ")} (${v.totalCount} total, ${v.uniqueCount} unique)`;
}
