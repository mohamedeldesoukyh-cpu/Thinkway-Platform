import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { lifecycleLabel } from "@/features/campaign-intelligence";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignObjectLifecycleStatus } from "@/features/campaign-intelligence/types/campaign-lifecycle";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import {
  STUDIO_WORKSPACE_STEPS,
  type StudioWorkspaceStepId,
} from "@/features/campaign-studio/constants/studio-workspace";
import {
  defaultStudioWorkspaceStep,
  resolveStudioWorkspaceSteps,
} from "@/features/campaign-studio/services/studio-workspace-status";
import { workspaceHref } from "@/features/campaign-outputs/actions/campaign-workspace-message";
import { formatMoneyKpi } from "@/lib/finance/currency-format";

export type StudioCampaignHistoryItem = {
  conversationId: string;
  campaignObjectId: string;
  name: string;
  clientName: string | null;
  brandName: string | null;
  statusLabel: string;
  currentStepId: StudioWorkspaceStepId;
  currentStepLabel: string;
  creatorCount: number;
  budgetLabel: string | null;
  updatedAt: string;
  href: string;
};

export type StudioCampaignHistorySource = {
  conversationId: string;
  campaignObjectId: string;
  lifecycleStatus: CampaignObjectLifecycleStatus | string;
  updatedAt: string;
  conversationTitle?: string | null;
  campaignObject: CampaignObject;
};

function creatorCountFromObject(campaignObject: CampaignObject): number {
  const data = (campaignObject.sections.creators?.data ?? {}) as CreatorsSectionData;
  return data.recommendations?.creatorIds?.length ?? 0;
}

function campaignName(source: StudioCampaignHistorySource): string {
  const facts = getCampaignFacts(source.campaignObject);
  const fromFacts = facts?.product?.trim() || facts?.brandName?.trim();
  if (fromFacts) return fromFacts;
  const title = source.conversationTitle?.trim();
  if (title && title.toLowerCase() !== "new conversation") return title;
  return "Untitled campaign";
}

export function projectStudioCampaignHistoryItem(
  source: StudioCampaignHistorySource
): StudioCampaignHistoryItem {
  const facts = getCampaignFacts(source.campaignObject);
  const steps = resolveStudioWorkspaceSteps({
    campaignObject: source.campaignObject,
    sections: [],
    outdatedSections: new Set(),
  });
  const currentStepId = defaultStudioWorkspaceStep(steps);
  const currentStepLabel =
    STUDIO_WORKSPACE_STEPS.find((step) => step.id === currentStepId)?.label ?? "Intake";
  const budget =
    facts?.budget && Number.isFinite(facts.budget.amount)
      ? formatMoneyKpi(facts.budget.amount, facts.budget.currency)
      : null;

  return {
    conversationId: source.conversationId,
    campaignObjectId: source.campaignObjectId,
    name: campaignName(source),
    clientName: facts?.clientName?.trim() || null,
    brandName: facts?.brandName?.trim() || null,
    statusLabel: lifecycleLabel(source.lifecycleStatus as CampaignObjectLifecycleStatus),
    currentStepId,
    currentStepLabel,
    creatorCount: creatorCountFromObject(source.campaignObject),
    budgetLabel: budget,
    updatedAt: source.updatedAt,
    href: workspaceHref(source.conversationId, "studio"),
  };
}
