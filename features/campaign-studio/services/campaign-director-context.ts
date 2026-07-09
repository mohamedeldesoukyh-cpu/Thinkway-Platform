import type { AiRequest } from "@/features/ai";
import { analyzeStrategistRequest } from "@/features/ai/strategist/request-analysis";
import { detectMissingCriticalInfo } from "@/features/ai/strategist/missing-info";
import type { AiWorkspaceRequestContext } from "@/features/knowledge-engine";

export const CAMPAIGN_DIRECTOR_CONFIDENCE_THRESHOLD = 85;

export type CampaignDirectorResult = {
  request: AiRequest;
  aiContext: AiWorkspaceRequestContext;
  inferredFields: string[];
};

/**
 * Campaign Director: enriches request/context from knowledge engine when confidence > 85%.
 * Skips clarification by inferring brand, objective, and audience before workflow execution.
 */
export function applyCampaignDirectorContext(
  request: AiRequest,
  aiContext: AiWorkspaceRequestContext
): CampaignDirectorResult {
  const knowledge = aiContext.knowledgeContext;
  const inferredFields: string[] = [];

  if (!knowledge || knowledge.confidence < CAMPAIGN_DIRECTOR_CONFIDENCE_THRESHOLD) {
    return { request, aiContext, inferredFields };
  }

  const enrichedContext: AiWorkspaceRequestContext = {
    ...aiContext,
    workspace: { ...aiContext.workspace },
  };

  if (knowledge.resolvedBrand) {
    if (!enrichedContext.workspace.brandId) {
      enrichedContext.workspace.brandId = knowledge.resolvedBrand.id;
    }
    if (knowledge.resolvedBrand.clientId && !enrichedContext.workspace.clientId) {
      enrichedContext.workspace.clientId = knowledge.resolvedBrand.clientId;
    }
    if (!enrichedContext.client && knowledge.resolvedClient) {
      enrichedContext.client = knowledge.resolvedClient;
    }
    inferredFields.push(`Brand: ${knowledge.resolvedBrand.name}`);
  } else if (knowledge.resolvedClient && !enrichedContext.client) {
    enrichedContext.client = knowledge.resolvedClient;
    inferredFields.push(`Legal entity: ${knowledge.resolvedClient.name}`);
  }

  if (knowledge.resolvedCampaign && !enrichedContext.campaign) {
    enrichedContext.campaign = knowledge.resolvedCampaign;
    inferredFields.push(`Campaign: ${knowledge.resolvedCampaign.name}`);
  }

  let enrichedMessage = request.message.trim();
  const analysis = analyzeStrategistRequest(
    { ...request, context: enrichedContext },
    enrichedContext
  );
  const missing = detectMissingCriticalInfo(analysis, enrichedContext);

  if (missing) {
    const additions: string[] = [];

    if (missing.field === "brandOrClient") {
      const brandEntity = knowledge.entities.find((entity) => entity.type === "brand");
      const brandName =
        knowledge.resolvedBrand?.name ?? brandEntity?.label;
      if (brandName) {
        additions.push(`Brand: ${brandName}`);
        inferredFields.push(`Brand inferred: ${brandName}`);
      }
    }

    if (missing.field === "objective") {
      const categoryEntity = knowledge.entities.find(
        (entity) => entity.type === "category"
      );
      const objective = categoryEntity
        ? `${categoryEntity.label} brand awareness and engagement`
        : "Brand awareness and engagement";
      additions.push(`Objective: ${objective}`);
      inferredFields.push(`Objective inferred: ${objective}`);
    }

    if (missing.field === "budgetOrAudience") {
      const brandLabel =
        knowledge.resolvedBrand?.name ??
        knowledge.entities.find((entity) => entity.type === "brand")?.label;
      const audience = brandLabel
        ? `Target audience aligned with ${brandLabel} consumers in primary market`
        : "Target audience: brand-relevant consumers in primary market";
      additions.push(audience);
      inferredFields.push("Audience inferred from brand context");
    }

    if (additions.length > 0) {
      enrichedMessage = `${enrichedMessage}\n\n${additions.join("\n")}`;
    }
  }

  return {
    request: {
      ...request,
      message: enrichedMessage,
      context: enrichedContext,
    },
    aiContext: enrichedContext,
    inferredFields,
  };
}

export { isCampaignWorkflow } from "../constants/workflow-ids";
