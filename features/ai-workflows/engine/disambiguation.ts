import type { CampaignResolveResult } from "./campaign-resolver";
import type { WorkflowExecutionContext, WorkflowState } from "../types";

export type DisambiguationResult = {
  needsDisambiguation: boolean;
  options: Array<{ id: string; label: string; meta?: Record<string, unknown> }>;
  message: string;
};

export function buildDisambiguationPrompt(
  entityType: string,
  options: Array<{ id: string; label: string; meta?: Record<string, unknown> }>
): string {
  const lines = options.map(
    (opt, i) => `${i + 1}. **${opt.label}**${opt.meta?.documentNumber ? ` (${opt.meta.documentNumber})` : ""}`
  );
  return `Multiple ${entityType} matches found. Please specify which one:\n\n${lines.join("\n")}\n\nReply with the number or exact name.`;
}

export function applyDisambiguationToState(
  state: WorkflowState,
  candidates: CampaignResolveResult[]
): DisambiguationResult {
  const options = candidates.map((c) => ({
    id: c.id,
    label: c.name,
    meta: { documentNumber: c.documentNumber, confidence: c.confidence },
  }));

  const message = buildDisambiguationPrompt("campaign", options);

  state.status = "paused";
  state.pauseReason = "disambiguation";
  state.pauseMessage = message;
  state.disambiguationOptions = options;

  return {
    needsDisambiguation: true,
    options,
    message,
  };
}

export function tryResolveDisambiguationFromMessage(
  message: string,
  options: Array<{ id: string; label: string; meta?: Record<string, unknown> }>
): string | null {
  const trimmed = message.trim();

  const numMatch = trimmed.match(/^(\d+)$/);
  if (numMatch) {
    const index = parseInt(numMatch[1], 10) - 1;
    if (index >= 0 && index < options.length) {
      return options[index].id;
    }
  }

  const lower = trimmed.toLowerCase();
  const exact = options.find((o) => o.label.toLowerCase() === lower);
  if (exact) return exact.id;

  const partial = options.find(
    (o) =>
      o.label.toLowerCase().includes(lower) || lower.includes(o.label.toLowerCase())
  );
  if (partial) return partial.id;

  return null;
}

export function enrichContextWithCampaign(
  ctx: WorkflowExecutionContext,
  campaign: CampaignResolveResult
): WorkflowExecutionContext {
  return {
    ...ctx,
    resolvedCampaignId: campaign.id,
    resolvedCampaignName: campaign.name,
    state: {
      ...ctx.state,
      data: {
        ...ctx.state.data,
        campaignId: campaign.id,
        campaignName: campaign.name,
      },
    },
  };
}
