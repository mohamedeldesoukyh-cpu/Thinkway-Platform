import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContextBuilderInput } from "@/features/ai/shared";
import type {
  DisambiguationOption,
  EntityType,
  KnowledgeContext,
  ResolvedEntity,
  WorkspaceKnowledge,
} from "./types";
import { knowledgeCache } from "./cache/memory-cache";
import { resolveEntitiesFromMessage } from "./entity-resolver/entity-resolver";
import { loadKnowledgeSnapshots } from "./context-loader/snapshot-loader";
import { buildRelationshipGraph } from "./relationship-graph/graph-builder";
import { resolveWorkspaceKnowledge } from "./workspace-resolver/workspace-resolver";

export type KnowledgeEngineOptions = {
  skipCache?: boolean;
};

export async function buildKnowledgeContext(
  supabase: SupabaseClient,
  message: string,
  workspaceInput?: Omit<ContextBuilderInput, "request">,
  options?: KnowledgeEngineOptions
): Promise<KnowledgeContext> {
  const start = performance.now();
  const cacheKey = `knowledge:${message}:${JSON.stringify(workspaceInput?.workspace ?? {})}`;

  if (!options?.skipCache) {
    const cached = knowledgeCache.get(cacheKey) as KnowledgeContext | undefined;
    if (cached) {
      return { ...cached, buildMs: 0, resolutionMs: 0 };
    }
  }

  const resolutionStart = performance.now();
  const resolution = await resolveEntitiesFromMessage(supabase, message, workspaceInput);
  const resolutionMs = Math.round(performance.now() - resolutionStart);

  const workspace = resolveWorkspaceKnowledge(workspaceInput, resolution.entities);
  const snapshots = await loadKnowledgeSnapshots(supabase, resolution.entities, workspace);
  const relationships = buildRelationshipGraph(resolution.entities, snapshots, workspace);

  const confidence = computeOverallConfidence(resolution.entities, resolution.disambiguation);

  const context: KnowledgeContext = {
    entities: resolution.entities,
    workspace,
    relationships,
    resolvedCampaign: snapshots.campaign,
    resolvedClient: snapshots.client,
    resolvedBrand: snapshots.brand,
    resolvedCreators: snapshots.creators,
    confidence,
    disambiguation: resolution.disambiguation,
    buildMs: Math.round(performance.now() - start),
    resolutionMs,
  };

  knowledgeCache.set(cacheKey, context);
  return context;
}

function computeOverallConfidence(
  entities: ResolvedEntity[],
  disambiguation?: DisambiguationOption[]
): number {
  if (disambiguation?.length) {
    const top = disambiguation[0]?.confidence ?? 0;
    return Math.min(top, 75);
  }
  if (!entities.length) return 0;
  const avg =
    entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length;
  return Math.round(Math.min(100, avg));
}

export function mergeResolvedIntoWorkspace(
  workspace: WorkspaceKnowledge,
  context: KnowledgeContext
): WorkspaceKnowledge {
  return {
    ...workspace,
    campaign: context.resolvedCampaign ?? workspace.campaign,
    client: context.resolvedClient ?? workspace.client,
    brand: context.resolvedBrand ?? workspace.brand,
  };
}

export type EntityResolutionSummary = {
  entityCount: number;
  topEntity?: ResolvedEntity;
  needsDisambiguation: boolean;
  types: EntityType[];
};

export function summarizeKnowledge(context: KnowledgeContext): EntityResolutionSummary {
  const sorted = [...context.entities].sort((a, b) => b.confidence - a.confidence);
  return {
    entityCount: context.entities.length,
    topEntity: sorted[0],
    needsDisambiguation: Boolean(context.disambiguation?.length),
    types: [...new Set(context.entities.map((e) => e.type))],
  };
}
