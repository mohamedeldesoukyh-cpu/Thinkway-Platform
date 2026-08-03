import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import {
  isTimelineSectionData,
  type TimelineSectionData,
} from "@/features/campaign-intelligence/types/section-schemas";
import { listCampaignOutputs } from "@/features/campaign-outputs/output-registry";
import type { CampaignOutputKind } from "@/features/campaign-outputs/output-types";
import { resolveSlate } from "@/features/campaign-outputs/output-inputs";
import { filterExecutionCreatorIds } from "@/lib/domains/commercial/campaign-plan-execution-mapper";

export type CampaignPlanReadinessItemId =
  | "client"
  | "brand"
  | "objective"
  | "budget"
  | "market"
  | "creator_slate"
  | "platform"
  | "strategy"
  | "timeline"
  | "media_plan";

export type CampaignPlanReadinessOptionalId =
  | "kpi_forecast"
  | "risk_plan"
  | "amplification"
  | "executive_proposal";

export type CampaignPlanReadinessItem = {
  id: CampaignPlanReadinessItemId | CampaignPlanReadinessOptionalId;
  label: string;
  satisfied: boolean;
  required: boolean;
};

export type CampaignPlanReadinessStatus = "not_ready" | "ready_for_review";

export type CampaignPlanReadiness = {
  items: CampaignPlanReadinessItem[];
  mandatory: CampaignPlanReadinessItem[];
  optional: CampaignPlanReadinessItem[];
  mandatoryMissing: CampaignPlanReadinessItem[];
  optionalRemaining: number;
  status: CampaignPlanReadinessStatus;
  statusLabel: string;
};

const MANDATORY_DEFINITIONS: Array<{ id: CampaignPlanReadinessItemId; label: string }> = [
  { id: "client", label: "Client" },
  { id: "brand", label: "Brand" },
  { id: "objective", label: "Objective" },
  { id: "budget", label: "Budget" },
  { id: "market", label: "Market" },
  { id: "creator_slate", label: "Creator Slate" },
  { id: "platform", label: "Platform" },
  { id: "strategy", label: "Strategy" },
  { id: "timeline", label: "Timeline" },
  { id: "media_plan", label: "Media Plan" },
];

const OPTIONAL_DEFINITIONS: Array<{ id: CampaignPlanReadinessOptionalId; label: string }> = [
  { id: "kpi_forecast", label: "KPI Forecast" },
  { id: "risk_plan", label: "Risk Plan" },
  { id: "amplification", label: "Amplification" },
  { id: "executive_proposal", label: "Executive Proposal" },
];

function isOutputGenerated(campaignObject: CampaignObject, kind: CampaignOutputKind): boolean {
  const view = listCampaignOutputs(campaignObject).find((output) => output.kind === kind);
  return view?.status === "generated" || view?.status === "needs_update";
}

function readTimelineData(campaignObject: CampaignObject): TimelineSectionData | null {
  const content = campaignObject.sections.timeline.content;
  return isTimelineSectionData(content) ? content : null;
}

function hasStrategy(campaignObject: CampaignObject): boolean {
  if (isOutputGenerated(campaignObject, "full_strategy")) return true;

  const strategy = campaignObject.sections.strategy;
  if (strategy.status === "complete") return true;

  const content =
    typeof strategy.content === "string" ? strategy.content.trim() : "";
  if (content.length > 80) return true;

  const data = strategy.data as { groundedFields?: unknown[] } | undefined;
  return Boolean(data?.groundedFields?.length);
}

function hasTimeline(campaignObject: CampaignObject): boolean {
  const facts = getCampaignFacts(campaignObject);
  const timeline = readTimelineData(campaignObject);

  if (timeline?.milestones?.length) return true;
  if (facts?.durationWeeks && facts.durationWeeks > 0) {
    return campaignObject.sections.timeline.status === "complete" || Boolean(timeline);
  }

  return false;
}

function evaluateMandatoryItem(
  campaignObject: CampaignObject,
  id: CampaignPlanReadinessItemId
): boolean {
  const facts = getCampaignFacts(campaignObject);

  switch (id) {
    case "client":
      // STAB-030: brand-as-client briefs (Brand: Noon with no separate legal
      // entity) must not block Approve → Generate when brand is present.
      return Boolean(facts?.clientName?.trim() || facts?.brandName?.trim());
    case "brand":
      return Boolean(facts?.brandName?.trim());
    case "objective":
      return Boolean(facts?.objective?.trim());
    case "budget":
      return Boolean(facts?.budget && facts.budget.amount > 0);
    case "market":
      return Boolean(facts?.geography?.length);
    case "creator_slate":
      return filterExecutionCreatorIds(campaignObject).length > 0 || resolveSlate(campaignObject).length > 0;
    case "platform":
      return Boolean(facts?.platforms?.length);
    case "strategy":
      return hasStrategy(campaignObject);
    case "timeline":
      return hasTimeline(campaignObject);
    case "media_plan":
      return isOutputGenerated(campaignObject, "media_plan");
    default:
      return false;
  }
}

function evaluateOptionalItem(
  campaignObject: CampaignObject,
  id: CampaignPlanReadinessOptionalId
): boolean {
  const outputKind: CampaignOutputKind =
    id === "kpi_forecast"
      ? "kpi_forecast"
      : id === "risk_plan"
        ? "risk_plan"
        : id === "amplification"
          ? "amplification_plan"
          : "executive_proposal";

  return isOutputGenerated(campaignObject, outputKind);
}

/** Evaluate mandatory + optional readiness for Campaign Director review. */
export function evaluateCampaignPlanReadiness(
  campaignObject: CampaignObject
): CampaignPlanReadiness {
  const mandatory: CampaignPlanReadinessItem[] = MANDATORY_DEFINITIONS.map((def) => ({
    id: def.id,
    label: def.label,
    required: true,
    satisfied: evaluateMandatoryItem(campaignObject, def.id),
  }));

  const optional: CampaignPlanReadinessItem[] = OPTIONAL_DEFINITIONS.map((def) => ({
    id: def.id,
    label: def.label,
    required: false,
    satisfied: evaluateOptionalItem(campaignObject, def.id),
  }));

  const mandatoryMissing = mandatory.filter((item) => !item.satisfied);
  const optionalRemaining = optional.filter((item) => !item.satisfied).length;
  const status: CampaignPlanReadinessStatus =
    mandatoryMissing.length === 0 ? "ready_for_review" : "not_ready";

  return {
    items: [...mandatory, ...optional],
    mandatory,
    optional,
    mandatoryMissing,
    optionalRemaining,
    status,
    statusLabel: status === "ready_for_review" ? "Ready for Review" : "Not Ready",
  };
}

/** Human-readable blockers for submit-for-review validation. */
export function formatCampaignPlanReadinessBlockers(
  readiness: CampaignPlanReadiness
): string {
  if (readiness.mandatoryMissing.length === 0) return "";
  const labels = readiness.mandatoryMissing.map((item) => item.label).join(", ");
  return `Campaign Plan is not ready for review. Missing: ${labels}.`;
}
