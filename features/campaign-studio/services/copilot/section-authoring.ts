import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  ExecutiveSummaryData,
  GroundedStrategyField,
  StrategySectionData,
} from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { deriveGroundedStrategy } from "@/features/campaign-studio/services/presentation-intelligence";
import type { LlmProvider } from "@/features/ai/types/llm";

import {
  buildCampaignContextDigest,
  renderDigestForPrompt,
} from "./studio-copilot-intents";
import {
  strategyLabelsForInstruction,
  studioSectionForTarget,
  type SectionAuthorTarget,
  type StudioFocus,
} from "./section-authoring-types";

export type SectionAuthorResult = {
  campaignObject: CampaignObject;
  /** Human summary line, or null when nothing was authored. */
  change: string | null;
  /** Reason when authoring could not be applied (surfaced to the user). */
  reason?: string;
  /** Studio section touched — for change-log focus tracking. */
  section: string;
};

const MAX_FIELD_LEN = 1200;

/** Strip code fences / prose around a JSON object the model may return. */
function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cleanValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_FIELD_LEN);
}

const GROUNDING_RULE =
  "Stay strictly grounded in the campaign context below. Never invent creators, budget figures, dates, or metrics that are not in the context. Preserve the campaign's facts. Return ONLY the requested JSON, no commentary.";

async function completeJson(
  provider: LlmProvider,
  system: string,
  user: string
): Promise<Record<string, unknown> | null> {
  try {
    const response = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
    });
    return response.content ? extractJson(response.content) : null;
  } catch {
    return null;
  }
}

function readStrategyData(campaignObject: CampaignObject): StrategySectionData {
  return (campaignObject.sections.strategy.data ?? {}) as StrategySectionData;
}

/** Current grounded strategy fields, scaffolded deterministically if absent. */
function currentStrategyFields(campaignObject: CampaignObject): GroundedStrategyField[] {
  const existing = readStrategyData(campaignObject).groundedFields;
  if (existing && existing.length > 0) return existing;
  const strategyText =
    typeof campaignObject.sections.strategy.content === "string"
      ? campaignObject.sections.strategy.content
      : "";
  const summaryText =
    typeof campaignObject.sections.summary.content === "string"
      ? campaignObject.sections.summary.content
      : "";
  const audienceText =
    typeof campaignObject.sections.audience.content === "string"
      ? campaignObject.sections.audience.content
      : "";
  return deriveGroundedStrategy(strategyText, audienceText, summaryText);
}

function patchSectionData(
  campaignObject: CampaignObject,
  sectionKey: "strategy" | "presentation",
  dataPatch: Record<string, unknown>
): CampaignObject {
  const section = campaignObject.sections[sectionKey];
  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      [sectionKey]: {
        ...section,
        data: { ...(section.data ?? {}), ...dataPatch },
        updatedBy: "director",
        updatedAt: new Date().toISOString(),
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

async function authorStrategy(
  provider: LlmProvider,
  campaignObject: CampaignObject,
  instruction: string,
  tone: string | undefined,
  focus: StudioFocus | undefined
): Promise<SectionAuthorResult> {
  const section = studioSectionForTarget("strategy");
  const fields = currentStrategyFields(campaignObject);
  if (fields.length === 0) {
    return { campaignObject, change: null, reason: "This campaign has no strategy to edit yet.", section };
  }

  // Focused single field, or the labels the instruction implies.
  const focusedLabel =
    focus?.elementKind === "strategy_field" && typeof focus.elementIndex === "number"
      ? fields[focus.elementIndex]?.label
      : undefined;
  const targetLabels = focusedLabel
    ? [focusedLabel]
    : strategyLabelsForInstruction(instruction).filter((label) =>
        fields.some((f) => f.label === label)
      );
  if (targetLabels.length === 0) targetLabels.push(...fields.map((f) => f.label));

  const digest = renderDigestForPrompt(buildCampaignContextDigest(campaignObject));
  const currentValues = Object.fromEntries(
    fields.filter((f) => targetLabels.includes(f.label)).map((f) => [f.label, f.value])
  );
  const toneLine = tone ? `Desired tone: ${tone}.` : "";

  const parsed = await completeJson(
    provider,
    `You are the Thinkway Campaign Strategist editing ONE section of a campaign. ${GROUNDING_RULE}`,
    `Campaign context:\n${digest}\n\nRewrite these strategy fields per the instruction. ${toneLine}\nInstruction: ${instruction}\n\nCurrent values (JSON):\n${JSON.stringify(currentValues, null, 2)}\n\nReturn a JSON object with the SAME keys and improved string values.`
  );
  if (!parsed) {
    return {
      campaignObject,
      change: null,
      reason: "I couldn't rewrite the strategy just now — please try again.",
      section,
    };
  }

  let updatedCount = 0;
  const nextFields = fields.map((field) => {
    if (!targetLabels.includes(field.label)) return field;
    const value = cleanValue(parsed[field.label]);
    if (!value || value === field.value) return field;
    updatedCount += 1;
    return {
      ...field,
      value,
      grounding: {
        ...field.grounding,
        source: "AI" as const,
        reason: "Rewritten by the Campaign Copilot",
      },
    };
  });

  if (updatedCount === 0) {
    return {
      campaignObject,
      change: null,
      reason: "The strategy already reads that way — no changes were needed.",
      section,
    };
  }

  const next = patchSectionData(campaignObject, "strategy", { groundedFields: nextFields });
  const scope = focusedLabel ?? (targetLabels.length === fields.length ? "strategy" : targetLabels.join(", "));
  return {
    campaignObject: next,
    change: `Rewrote the ${scope}${tone ? ` in a more ${tone} tone` : ""}.`,
    section,
  };
}

async function authorExecutiveSummary(
  provider: LlmProvider,
  campaignObject: CampaignObject,
  instruction: string,
  tone: string | undefined
): Promise<SectionAuthorResult> {
  const section = studioSectionForTarget("executive_summary");
  const presentationData = (campaignObject.sections.presentation.data ?? {}) as Record<
    string,
    unknown
  >;
  const current = (presentationData.executiveSummary ?? null) as ExecutiveSummaryData | null;
  const digest = renderDigestForPrompt(buildCampaignContextDigest(campaignObject));
  const toneLine = tone ? `Desired tone: ${tone}.` : "";

  const parsed = await completeJson(
    provider,
    `You are the Thinkway Campaign Strategist writing the executive summary of a campaign. ${GROUNDING_RULE}`,
    `Campaign context:\n${digest}\n\n${toneLine}\nInstruction: ${instruction}\n\nCurrent summary: ${current?.summary ?? "(none yet)"}\nCurrent recommended actions: ${JSON.stringify(current?.recommendedActions ?? [])}\n\nReturn JSON: { "summary": string, "recommendedActions": string[] (3-5 items) }.`
  );
  if (!parsed) {
    return {
      campaignObject,
      change: null,
      reason: "I couldn't rewrite the executive summary just now — please try again.",
      section,
    };
  }

  const summary = cleanValue(parsed.summary);
  const recommendedActions = Array.isArray(parsed.recommendedActions)
    ? parsed.recommendedActions.map(cleanValue).filter((v): v is string => Boolean(v)).slice(0, 6)
    : current?.recommendedActions ?? [];
  if (!summary) {
    return {
      campaignObject,
      change: null,
      reason: "The rewritten summary came back empty — please try again.",
      section,
    };
  }

  const nextSummary: ExecutiveSummaryData = {
    summary,
    keyDecisions: current?.keyDecisions ?? [],
    recommendedActions,
    immediateNextSteps: current?.immediateNextSteps ?? [],
    expectedBusinessOutcome: current?.expectedBusinessOutcome ?? "",
    grounding: current?.grounding ?? {
      source: "AI",
      confidence: 85,
      reason: "Authored by the Campaign Copilot",
    },
  };

  const next = patchSectionData(campaignObject, "presentation", { executiveSummary: nextSummary });
  return {
    campaignObject: next,
    change: `Rewrote the executive summary${tone ? ` for a more ${tone} tone` : ""}.`,
    section,
  };
}

/** Dispatch section authoring to the right editor. Only the target section changes. */
export async function authorSection(
  provider: LlmProvider,
  campaignObject: CampaignObject,
  input: { target: SectionAuthorTarget; instruction: string; tone?: string; focus?: StudioFocus }
): Promise<SectionAuthorResult> {
  switch (input.target) {
    case "strategy":
      return authorStrategy(provider, campaignObject, input.instruction, input.tone, input.focus);
    case "executive_summary":
      return authorExecutiveSummary(provider, campaignObject, input.instruction, input.tone);
    default:
      return {
        campaignObject,
        change: null,
        reason: `Authoring ${input.target.replace(/_/g, " ")} is coming in the next update.`,
        section: studioSectionForTarget(input.target),
      };
  }
}
