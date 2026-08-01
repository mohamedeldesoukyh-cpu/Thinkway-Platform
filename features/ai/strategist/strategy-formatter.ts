import type {
  BuildCampaignOutput,
  GenerateBriefOutput,
  GetCampaignOutput,
  GetClientOutput,
  SearchCreatorsOutput,
} from "../tools/schemas";
import type { ToolExecutionResult } from "../types";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

import type { StrategistRequestAnalysis } from "./request-analysis";

export type StrategySections = {
  campaignSummary: string;
  targetAudience: string;
  creatorStrategy: string;
  budgetAllocation: string;
  kpis: string;
  timeline: string;
  risks: string;
  recommendedNextActions: string;
};

export type StrategyFormattedResponse = {
  sections: StrategySections;
  markdown: string;
};

function getToolOutput<T>(toolResults: ToolExecutionResult[], toolName: string): T | undefined {
  const result = toolResults.find(
    (entry) => entry.toolName === toolName && entry.success
  );
  return result?.output as T | undefined;
}

function formatCurrency(amount: number, currency?: string): string {
  return formatMoneyKpi(amount, currency?.trim() || "USD");
}

function formatCreatorStrategy(
  search: SearchCreatorsOutput | undefined,
  analysis: StrategistRequestAnalysis
): string {
  if (!search) {
    return "Creator search was not run. Confirm target audience to source vendor recommendations.";
  }

  if (search.creators.length === 0) {
    return `Creator search for "${analysis.searchQuery ?? "query"}" returned no vendors. Refine audience, platform, or category filters.`;
  }

  const topCreators = search.creators.slice(0, 5);
  const platformNote =
    analysis.platforms && analysis.platforms.length > 0
      ? ` Prioritize ${analysis.platforms.join(", ")} based on the request.`
      : "";

  const roster = topCreators
    .map((creator) => {
      const followers =
        creator.followers != null
          ? `${creator.followers.toLocaleString()} followers`
          : "followers unknown";
      const engagement =
        creator.engagementRate != null
          ? `${creator.engagementRate}% ER`
          : "ER unknown";
      return `- @${creator.handle} (${creator.displayName}) — ${creator.platform}, ${followers}, ${engagement}`;
    })
    .join("\n");

  return `Identified ${search.total} vendor match(es); top candidates:\n${roster}${platformNote}`;
}

function formatBudgetAllocation(
  analysis: StrategistRequestAnalysis,
  campaign: GetCampaignOutput | undefined,
  draft: BuildCampaignOutput | undefined
): string {
  const budget = campaign?.poAmount ?? analysis.budget;
  const currency = campaign?.currency ?? analysis.currency;

  if (draft?.draft.suggestedLines.length) {
    const lines = draft.draft.suggestedLines
      .map((line) => {
        const po =
          line.poAmount != null
            ? formatCurrency(line.poAmount, currency)
            : "PO TBD";
        const vendor = line.creatorId ? `vendor ${line.creatorId}` : "unassigned vendor";
        return `- Line ${line.code}: ${vendor} — ${po}`;
      })
      .join("\n");

    const total =
      budget != null
        ? `Total operational PO: ${formatCurrency(budget, currency)}.`
        : "Total PO not confirmed on record.";

    return `${total}\nSuggested campaign line allocation:\n${lines}`;
  }

  if (budget != null) {
    return `Operational PO budget: ${formatCurrency(budget, currency)}. Draft campaign lines were not generated — assign vendors after creator shortlist approval.`;
  }

  return "Budget not available from tools or request. Confirm PO amount with finance before line allocation.";
}

function formatKpis(
  analysis: StrategistRequestAnalysis,
  search: SearchCreatorsOutput | undefined,
  campaign: GetCampaignOutput | undefined
): string {
  const items: string[] = [];

  if (analysis.objective) {
    items.push(`- Primary objective: ${analysis.objective}`);
  }

  if (campaign?.lineCount != null) {
    items.push(`- Campaign lines in workspace: ${campaign.lineCount}`);
  }

  if (search && search.creators.length > 0) {
    const avgEngagement =
      search.creators
        .map((creator) => creator.engagementRate)
        .filter((value): value is number => value != null)
        .reduce((sum, value, _, arr) => sum + value / arr.length, 0) || null;

    items.push(`- Shortlisted vendor pool: ${search.total} creator(s)`);
    if (avgEngagement != null) {
      items.push(`- Benchmark engagement (shortlist avg): ${avgEngagement.toFixed(1)}%`);
    }
  }

  if (analysis.budget != null) {
    items.push(
      `- Budget guardrail: ${formatCurrency(analysis.budget, analysis.currency)} operational PO`
    );
  }

  if (items.length === 0) {
    return "KPIs cannot be finalized until objective, budget, and creator shortlist data are confirmed.";
  }

  return items.join("\n");
}

function formatTimeline(analysis: StrategistRequestAnalysis): string {
  if (analysis.timeline) {
    return `Requested timeline: ${analysis.timeline}. Align vendor contracting, content production, and go-live accordingly.`;
  }
  return "Timeline not specified. Confirm campaign start/end dates before vendor IO issuance.";
}

function formatRisks(
  toolResults: ToolExecutionResult[],
  search: SearchCreatorsOutput | undefined
): string {
  const risks: string[] = [];

  for (const result of toolResults) {
    if (!result.success) {
      risks.push(`- Tool ${result.toolName} failed: ${result.error ?? "unknown error"}`);
    }
  }

  if (search && search.total === 0) {
    risks.push("- No vendors matched the current search criteria.");
  }

  if (risks.length === 0) {
    return "No material data risks detected from tool outputs. Validate assumptions with the account team before commitment.";
  }

  return risks.join("\n");
}

function formatNextActions(
  analysis: StrategistRequestAnalysis,
  brief: GenerateBriefOutput | undefined,
  draft: BuildCampaignOutput | undefined
): string {
  const actions: string[] = [];

  if (draft) {
    actions.push("- Review suggested campaign line draft and create header in Thinkway when approved.");
  }

  if (brief) {
    actions.push("- Circulate generated creative brief to vendors and client approvers.");
  }

  actions.push("- Finalize vendor shortlist and assign campaign lines with PO amounts.");
  actions.push("- Confirm KPI baselines and reporting cadence in the campaign workspace.");

  if (analysis.brandName && !analysis.brandId) {
    actions.push(`- Link strategy to the correct brand record for ${analysis.brandName}.`);
  }

  return actions.join("\n");
}

function formatCampaignSummary(
  analysis: StrategistRequestAnalysis,
  client: GetClientOutput | undefined,
  campaign: GetCampaignOutput | undefined
): string {
  const parts: string[] = [];

  const title =
    campaign?.name ??
    analysis.campaignTitle ??
    analysis.campaignName ??
    "Campaign strategy request";

  parts.push(`**${title}**`);

  if (client?.name || analysis.clientName) {
    parts.push(`Legal entity: ${client?.name ?? analysis.clientName}`);
  }

  if (analysis.brandName || campaign?.brandId || analysis.brandId) {
    parts.push(
      `Brand: ${analysis.brandName ?? campaign?.brandId ?? analysis.brandId}`
    );
  }

  if (campaign?.code) {
    parts.push(`Campaign code: ${campaign.code} (${campaign.status})`);
  }

  if (analysis.objective) {
    parts.push(`Objective: ${analysis.objective}`);
  }

  if (analysis.budget != null) {
    parts.push(
      `Budget signal: ${formatCurrency(analysis.budget, analysis.currency ?? campaign?.currency)}`
    );
  }

  return parts.join("\n");
}

function formatTargetAudience(analysis: StrategistRequestAnalysis): string {
  if (analysis.audience) {
    return analysis.audience;
  }
  return "Target audience not explicitly stated. Creator search used available objective/brand context as a proxy.";
}

function sectionsToMarkdown(sections: StrategySections): string {
  return [
    "## 1. Campaign Summary",
    sections.campaignSummary,
    "",
    "## 2. Target Audience",
    sections.targetAudience,
    "",
    "## 3. Creator Strategy",
    sections.creatorStrategy,
    "",
    "## 4. Budget Allocation",
    sections.budgetAllocation,
    "",
    "## 5. KPIs",
    sections.kpis,
    "",
    "## 6. Timeline",
    sections.timeline,
    "",
    "## 7. Risks",
    sections.risks,
    "",
    "## 8. Recommended Next Actions",
    sections.recommendedNextActions,
  ].join("\n");
}

export function formatStrategyResponse(
  analysis: StrategistRequestAnalysis,
  toolResults: ToolExecutionResult[]
): StrategyFormattedResponse {
  const search = getToolOutput<SearchCreatorsOutput>(toolResults, "searchCreators");
  const client = getToolOutput<GetClientOutput>(toolResults, "getClient");
  const campaign = getToolOutput<GetCampaignOutput>(toolResults, "getCampaign");
  const draft = getToolOutput<BuildCampaignOutput>(toolResults, "buildCampaign");
  const brief = getToolOutput<GenerateBriefOutput>(toolResults, "generateBrief");

  const sections: StrategySections = {
    campaignSummary: formatCampaignSummary(analysis, client, campaign),
    targetAudience: formatTargetAudience(analysis),
    creatorStrategy: formatCreatorStrategy(search, analysis),
    budgetAllocation: formatBudgetAllocation(analysis, campaign, draft),
    kpis: formatKpis(analysis, search, campaign),
    timeline: formatTimeline(analysis),
    risks: formatRisks(toolResults, search),
    recommendedNextActions: formatNextActions(analysis, brief, draft),
  };

  return {
    sections,
    markdown: sectionsToMarkdown(sections),
  };
}
