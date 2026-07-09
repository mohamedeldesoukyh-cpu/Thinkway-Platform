import type { ContextBuilderInput } from "@/features/ai/shared";

import type { ResolvedEntity, WorkspaceKnowledge } from "../types";

export function resolveWorkspaceKnowledge(
  input?: Omit<ContextBuilderInput, "request">,
  resolvedEntities?: ResolvedEntity[]
): WorkspaceKnowledge {
  const workspace: WorkspaceKnowledge["workspace"] = {
    type: input?.workspace?.type ?? "general",
    ...input?.workspace,
  };

  const knowledge: WorkspaceKnowledge = {
    workspace,
    user: input?.user,
    campaign: input?.campaign,
    client: input?.client,
    shortlist: input?.shortlist
      ? {
          id: input.shortlist.id,
          name: input.shortlist.name,
          creatorCount: input.shortlist.creatorCount,
          status: input.shortlist.status,
        }
      : undefined,
    filters: input?.filters,
    page: workspace.type !== "general" ? workspace.type : undefined,
  };

  if (!resolvedEntities?.length) return knowledge;

  const topBrand = resolvedEntities.find((e) => e.type === "brand" && e.confidence >= 85);
  const topClient = resolvedEntities.find((e) => e.type === "client" && e.confidence >= 85);
  const topCampaign = resolvedEntities.find((e) => e.type === "campaign" && e.confidence >= 85);

  if (topCampaign && !knowledge.campaign) {
    knowledge.campaign = {
      id: topCampaign.id,
      name: topCampaign.label,
      code: topCampaign.metadata?.subtitle as string | undefined,
    };
    knowledge.workspace = {
      ...knowledge.workspace,
      type: "campaign",
      id: topCampaign.id,
      campaignId: topCampaign.id,
      label: topCampaign.label,
    };
  }

  if (topClient && !knowledge.client) {
    knowledge.client = {
      id: topClient.id,
      name: topClient.label,
    };
    if (!knowledge.workspace.campaignId) {
      knowledge.workspace = {
        ...knowledge.workspace,
        type: "client",
        id: topClient.id,
        clientId: topClient.id,
        label: topClient.label,
      };
    }
  }

  if (topBrand && !knowledge.brand) {
    knowledge.brand = {
      id: topBrand.id,
      name: topBrand.label,
      documentNumber: topBrand.metadata?.subtitle as string | undefined,
    };
    if (knowledge.workspace.type === "general") {
      knowledge.workspace = {
        ...knowledge.workspace,
        type: "brand",
        id: topBrand.id,
        brandId: topBrand.id,
        label: topBrand.label,
      };
    }
  }

  const shortlistEntity = resolvedEntities.find((e) => e.type === "shortlist");
  if (shortlistEntity && !knowledge.shortlist) {
    knowledge.shortlist = {
      id: shortlistEntity.id,
      name: shortlistEntity.label,
    };
  }

  return knowledge;
}

export function shouldSkipEntityQuestion(
  knowledge: WorkspaceKnowledge,
  entityType: "campaign" | "client" | "brand" | "shortlist"
): boolean {
  switch (entityType) {
    case "campaign":
      return Boolean(knowledge.campaign?.id);
    case "client":
      return Boolean(knowledge.client?.id);
    case "brand":
      return Boolean(knowledge.brand?.id);
    case "shortlist":
      return Boolean(knowledge.shortlist?.id);
    default:
      return false;
  }
}
