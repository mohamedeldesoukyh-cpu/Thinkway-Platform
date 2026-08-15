import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { CampaignStudioSection, CampaignStudioSectionId } from "../types/campaign-studio";
import {
  STUDIO_WORKSPACE_STEPS,
  type StudioWorkspaceStepId,
  workspaceStepForSection,
} from "../constants/studio-workspace";
import { requiredIntakeFacts } from "./studio-intake-facts";

/** User-facing workspace states — never expose fingerprint / registry internals. */
export type StudioWorkspaceStepStatus =
  | "current"
  | "outdated"
  | "in_progress"
  | "blocked"
  | "ready";

export const STUDIO_WORKSPACE_STATUS_LABEL: Record<StudioWorkspaceStepStatus, string> = {
  current: "Current",
  outdated: "Outdated",
  in_progress: "In progress",
  blocked: "Blocked",
  ready: "Ready",
};

export type StudioWorkspaceStepView = {
  id: StudioWorkspaceStepId;
  label: string;
  question: string;
  status: StudioWorkspaceStepStatus;
  complete: boolean;
};

export function isStudioIntakeConfirmed(
  campaignObject: CampaignObject | undefined
): boolean {
  if (!campaignObject) return false;
  if (campaignObject.meta.factsConfirmedAt?.trim()) return true;
  // Legacy objects already storing Campaign Facts keep working without a stamp.
  return Boolean(getCampaignFacts(campaignObject));
}

export function outdatedWorkspaceSteps(
  outdatedSections: ReadonlySet<CampaignStudioSectionId>
): Set<StudioWorkspaceStepId> {
  const steps = new Set<StudioWorkspaceStepId>();
  for (const sectionId of outdatedSections) {
    const stepId = workspaceStepForSection(sectionId);
    if (!stepId || stepId === "intake") continue;
    steps.add(stepId);
  }
  return steps;
}

function sectionById(
  sections: CampaignStudioSection[]
): Map<CampaignStudioSectionId, CampaignStudioSection> {
  return new Map(sections.map((section) => [section.id, section]));
}

function stepSectionStatus(
  stepId: StudioWorkspaceStepId,
  byId: Map<CampaignStudioSectionId, CampaignStudioSection>
): CampaignStudioSection["status"] | null {
  const step = STUDIO_WORKSPACE_STEPS.find((item) => item.id === stepId);
  if (!step) return null;
  const statuses = step.sections
    .map((id) => byId.get(id)?.status)
    .filter((status): status is CampaignStudioSection["status"] => Boolean(status));
  if (statuses.includes("running")) return "running";
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.length > 0 && statuses.every((status) => status === "complete")) {
    return "complete";
  }
  if (statuses.includes("pending")) return "pending";
  return statuses[0] ?? null;
}

/**
 * Derive the six-step rail from Campaign Facts + Wave 1 outdated sections.
 * Does not invent a second freshness engine.
 */
export function resolveStudioWorkspaceSteps(input: {
  campaignObject?: CampaignObject;
  sections: CampaignStudioSection[];
  outdatedSections: ReadonlySet<CampaignStudioSectionId>;
}): StudioWorkspaceStepView[] {
  const byId = sectionById(input.sections);
  const outdatedSteps = outdatedWorkspaceSteps(input.outdatedSections);
  const intake = requiredIntakeFacts(getCampaignFacts(input.campaignObject));
  const intakeConfirmed = isStudioIntakeConfirmed(input.campaignObject);
  const intakeBlocked = intake.missing.length > 0 || !intakeConfirmed;

  return STUDIO_WORKSPACE_STEPS.map((step) => {
    const sectionStatus = stepSectionStatus(step.id, byId);

    if (step.id === "intake") {
      if (sectionStatus === "running") {
        return { ...step, status: "in_progress", complete: false };
      }
      if (intake.missing.length > 0) {
        return { ...step, status: "blocked", complete: false };
      }
      if (intakeConfirmed) {
        return { ...step, status: "current", complete: true };
      }
      return { ...step, status: "blocked", complete: false };
    }

    if (intakeBlocked && sectionStatus !== "running") {
      return { ...step, status: "blocked", complete: false };
    }

    if (sectionStatus === "running") {
      return { ...step, status: "in_progress", complete: false };
    }

    if (outdatedSteps.has(step.id)) {
      return { ...step, status: "outdated", complete: sectionStatus === "complete" };
    }

    if (step.id === "package" && sectionStatus === "complete" && outdatedSteps.size === 0) {
      return { ...step, status: "ready", complete: true };
    }

    if (sectionStatus === "complete") {
      return { ...step, status: "current", complete: true };
    }

    if (sectionStatus === "blocked") {
      return { ...step, status: "blocked", complete: false };
    }

    return { ...step, status: "in_progress", complete: false };
  });
}

export function defaultStudioWorkspaceStep(
  steps: StudioWorkspaceStepView[]
): StudioWorkspaceStepId {
  const intake = steps.find((step) => step.id === "intake");
  if (intake && !intake.complete) return "intake";

  const outdated = steps.find((step) => step.status === "outdated");
  if (outdated) return outdated.id;

  const inProgress = steps.find((step) => step.status === "in_progress");
  if (inProgress) return inProgress.id;

  const blocked = steps.find((step) => step.status === "blocked");
  if (blocked) return blocked.id;

  return "intake";
}
