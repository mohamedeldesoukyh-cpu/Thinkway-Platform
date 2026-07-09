import type { AiContext } from "../types";

import type { StrategistRequestAnalysis } from "./request-analysis";

export type MissingCriticalField =
  | "brandOrClient"
  | "objective"
  | "budgetOrAudience";

export type MissingInfoResult = {
  field: MissingCriticalField;
  question: string;
};

function hasBrandOrClient(
  analysis: StrategistRequestAnalysis,
  context: AiContext
): boolean {
  if (
    analysis.brandId ||
    analysis.clientId ||
    analysis.brandName ||
    context.client?.name ||
    context.campaign?.brandId ||
    context.workspace.brandId
  ) {
    return true;
  }

  const objective = analysis.objective?.toLowerCase() ?? "";
  return objective.includes("restaurant") || objective.includes("tourism");
}

function hasObjective(analysis: StrategistRequestAnalysis): boolean {
  return Boolean(analysis.objective?.trim());
}

function hasBudgetOrAudience(analysis: StrategistRequestAnalysis): boolean {
  return Boolean(
    (analysis.budget != null && analysis.budget > 0) || analysis.audience?.trim()
  );
}

export function detectMissingCriticalInfo(
  analysis: StrategistRequestAnalysis,
  context: AiContext
): MissingInfoResult | null {
  if (!hasBrandOrClient(analysis, context)) {
    return {
      field: "brandOrClient",
      question:
        "Which brand or legal entity should this campaign strategy target?",
    };
  }

  if (!hasObjective(analysis)) {
    return {
      field: "objective",
      question: "What is the primary campaign objective (e.g. awareness, launch, engagement)?",
    };
  }

  if (!hasBudgetOrAudience(analysis)) {
    return {
      field: "budgetOrAudience",
      question:
        "What is the campaign budget (amount + currency) or target audience you want to reach?",
    };
  }

  return null;
}

export function buildClarificationQuestion(missing: MissingInfoResult): string {
  return missing.question;
}
