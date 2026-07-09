import type { AiResponse } from "@/features/ai";
import type {
  BuildCampaignOutput,
  GenerateBriefOutput,
  GenerateReportOutput,
  SearchCreatorsOutput,
} from "@/features/ai";
import { STUDIO_CREATOR_HYDRATION_LIMIT } from "@/features/campaign-studio/constants/hydration-limits";
import { normalizeCreators } from "@/features/ai-workflows/formatters/creator-formatter";

import type { AiActionCard } from "../types";

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function getToolOutput<T>(
  structured: Record<string, unknown> | undefined,
  toolName: string
): T | undefined {
  const outputs = structured?.toolOutputs as
    | Array<{ tool: string; output: unknown }>
    | undefined;
  const match = outputs?.find((entry) => entry.tool === toolName);
  return match?.output as T | undefined;
}

export function parseActionCardsFromResponse(
  response: AiResponse
): AiActionCard[] {
  const cards: AiActionCard[] = [];
  const structured = response.structured as Record<string, unknown> | undefined;

  if (structured?.mode === "clarification") {
    return cards;
  }

  const search = getToolOutput<SearchCreatorsOutput>(structured, "searchCreators");
  if (search && search.creators.length > 0) {
    const creators = normalizeCreators(search.creators, "actionCardParser").slice(
      0,
      STUDIO_CREATOR_HYDRATION_LIMIT
    );
    const facts = structured?.campaignFacts as { platforms?: string[]; budget?: { currency?: string } } | undefined;
    cards.push({
      id: createId("creator_search"),
      type: "creator_search",
      title: "Creator matches",
      description: `${search.total} match(es). Review details or add to shortlist.`,
      payload: {
        query: structured?.analysis
          ? (structured.analysis as Record<string, unknown>).searchQuery
          : undefined,
        creators,
        creatorIds: creators.map((c) => c.id),
        total: search.total,
        preferredPlatforms: facts?.platforms,
        currency: facts?.budget?.currency,
      },
      requiresApproval: false,
      status: "executed",
    });
  }

  const draft = getToolOutput<BuildCampaignOutput>(structured, "buildCampaign");
  if (draft?.draft) {
    cards.push({
      id: createId("campaign"),
      type: "campaign",
      title: "Campaign draft ready",
      description: `Draft "${draft.draft.name}" with ${draft.draft.suggestedLines.length} suggested line(s). Approve to create in Thinkway.`,
      payload: {
        brandId: draft.draft.brandId,
        name: draft.draft.name,
        suggestedLines: draft.draft.suggestedLines,
      },
      requiresApproval: true,
      status: "pending",
    });
  }

  const brief = getToolOutput<GenerateBriefOutput>(structured, "generateBrief");
  if (brief?.sections?.length) {
    cards.push({
      id: createId("approval"),
      type: "approval",
      title: "Creative brief generated",
      description: brief.title ?? "Review the brief content before sharing with vendors.",
      payload: {
        title: brief.title,
        sections: brief.sections,
      },
      requiresApproval: false,
      status: "executed",
    });
  }

  const report = getToolOutput<GenerateReportOutput>(structured, "generateReport");
  if (report?.summary) {
    cards.push({
      id: createId("report"),
      type: "report",
      title: "Report generated",
      description: report.title ?? "Campaign analysis report",
      payload: {
        title: report.title,
        summary: report.summary,
        metrics: report.metrics,
        recommendations: report.recommendations,
      },
      requiresApproval: false,
      status: "executed",
    });
  }

  return cards;
}
