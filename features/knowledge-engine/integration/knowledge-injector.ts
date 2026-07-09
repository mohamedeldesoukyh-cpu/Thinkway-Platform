import type { AiContext, AiRequest } from "@/features/ai";
import type { ContextBuilderInput } from "@/features/ai/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildKnowledgeContext } from "../knowledge-engine";
import type { KnowledgeContext } from "../types";

export type AiWorkspaceContextInput = Omit<ContextBuilderInput, "request"> & {
  knowledgeContext?: KnowledgeContext;
};

export type AiWorkspaceRequestContext = AiContext & {
  knowledgeContext?: KnowledgeContext;
};

export type KnowledgeInjectionResult = {
  contextInput: AiWorkspaceContextInput;
  aiContext: AiWorkspaceRequestContext;
  knowledgeContext: KnowledgeContext;
};

export type KnowledgeInjectorOptions = {
  skipCache?: boolean;
  page?: string;
};

/**
 * Builds KnowledgeContext and enriches workspace context before workflow/orchestrator.
 * Additive only — does not modify frozen ai module APIs.
 */
export async function injectKnowledgeContext(
  supabase: SupabaseClient,
  request: AiRequest,
  contextInput: Omit<ContextBuilderInput, "request">,
  options?: KnowledgeInjectorOptions
): Promise<KnowledgeInjectionResult> {
  const knowledgeContext = await buildKnowledgeContext(
    supabase,
    request.message,
    contextInput,
    { skipCache: options?.skipCache }
  );

  if (options?.page) {
    knowledgeContext.workspace.page = options.page;
  }

  const enrichedContextInput: AiWorkspaceContextInput = {
    ...contextInput,
    knowledgeContext,
    campaign: knowledgeContext.resolvedCampaign ?? contextInput.campaign,
    client: knowledgeContext.resolvedClient ?? contextInput.client,
    snapshot: {
      source: "knowledge-engine",
      capturedAt: new Date().toISOString(),
      payload: {
        knowledgeContext,
        entityCount: knowledgeContext.entities.length,
        confidence: knowledgeContext.confidence,
      },
    },
  };

  const baseContext: AiWorkspaceRequestContext = {
    workspace: {
      type: "general",
      ...request.context?.workspace,
      ...enrichedContextInput.workspace,
    },
    user: enrichedContextInput.user ?? request.context?.user,
    campaign: enrichedContextInput.campaign ?? request.context?.campaign,
    client: enrichedContextInput.client ?? request.context?.client,
    shortlist: enrichedContextInput.shortlist ?? request.context?.shortlist,
    filters: enrichedContextInput.filters ?? request.context?.filters,
    snapshot: enrichedContextInput.snapshot ?? request.context?.snapshot,
    selectedCreators: request.context?.selectedCreators,
    conversation: request.context?.conversation,
    knowledgeContext,
  };

  return {
    contextInput: enrichedContextInput,
    aiContext: baseContext,
    knowledgeContext,
  };
}

export function formatKnowledgeContextSummary(context: KnowledgeContext): string {
  const parts: string[] = [];
  if (context.resolvedCampaign) {
    parts.push(`Campaign: ${context.resolvedCampaign.name}`);
  }
  if (context.resolvedClient) {
    parts.push(`Client: ${context.resolvedClient.name}`);
  }
  if (context.resolvedBrand) {
    parts.push(`Brand: ${context.resolvedBrand.name}`);
  }
  if (context.resolvedCreators?.length) {
    parts.push(`Creators: ${context.resolvedCreators.length}`);
  }
  if (context.disambiguation?.length) {
    parts.push(`Disambiguation required (${context.disambiguation.length} options)`);
  }
  return parts.join(" · ") || "No entities resolved";
}
