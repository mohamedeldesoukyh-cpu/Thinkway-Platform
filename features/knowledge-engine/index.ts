export { buildKnowledgeContext, mergeResolvedIntoWorkspace, summarizeKnowledge } from "./knowledge-engine";
export type { KnowledgeEngineOptions, EntityResolutionSummary } from "./knowledge-engine";

export { resolveEntitiesFromMessage, clearEntityResolutionDedupe } from "./entity-resolver/entity-resolver";
export { loadKnowledgeSnapshots } from "./context-loader/snapshot-loader";
export type { LoadedSnapshots } from "./context-loader/snapshot-loader";

export { buildRelationshipGraph, traverseRelationships } from "./relationship-graph/graph-builder";

export {
  resolveWorkspaceKnowledge,
  shouldSkipEntityQuestion,
} from "./workspace-resolver/workspace-resolver";

export { searchEntityWithPriority, searchCampaignContext } from "./search/entity-search";
export {
  extractEntityCandidates,
  extractTwDocumentNumbers,
  extractHandles,
  extractHashtags,
  detectPlatform,
  inferEntityTypeFromDocumentNumber,
} from "./search/patterns";
export { fuzzyConfidence, normalizeSearchTerm } from "./search/fuzzy-match";

export {
  knowledgeCache,
  entitySearchCache,
  invalidateKnowledgeForEntity,
  KNOWLEDGE_CACHE_TTL_MS,
} from "./cache/memory-cache";

export {
  injectKnowledgeContext,
  formatKnowledgeContextSummary,
} from "./integration/knowledge-injector";
export type {
  AiWorkspaceContextInput,
  AiWorkspaceRequestContext,
  KnowledgeInjectionResult,
  KnowledgeInjectorOptions,
} from "./integration/knowledge-injector";

export type {
  EntityType,
  MatchMethod,
  MatchSource,
  ResolvedEntity,
  DisambiguationOption,
  BrandSnapshot,
  CreatorSnapshot,
  WorkspaceKnowledge,
  RelationshipNode,
  RelationshipEdge,
  RelationshipGraph,
  KnowledgeContext,
  KnowledgeBuildInput,
  EntitySearchHit,
  EntitySearchResult,
} from "./types";
