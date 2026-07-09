import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiRequest } from "@/features/ai";
import type { ContextBuilderInput } from "@/features/ai/shared";

import {
  injectKnowledgeContext,
  type AiWorkspaceContextInput,
  type AiWorkspaceRequestContext,
} from "@/features/knowledge-engine";

export type EnrichedWorkspaceContext = {
  contextInput: AiWorkspaceContextInput;
  aiContext: AiWorkspaceRequestContext;
};

/**
 * Workspace-layer enrichment: builds KnowledgeContext before workflow/orchestrator.
 */
export async function enrichWorkspaceWithKnowledge(
  supabase: SupabaseClient,
  request: AiRequest,
  contextInput: Omit<ContextBuilderInput, "request">
): Promise<EnrichedWorkspaceContext> {
  const injected = await injectKnowledgeContext(supabase, request, contextInput);
  return {
    contextInput: injected.contextInput,
    aiContext: injected.aiContext,
  };
}
