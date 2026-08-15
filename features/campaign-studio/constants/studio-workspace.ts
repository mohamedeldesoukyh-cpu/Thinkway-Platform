import type { CampaignStudioSectionId } from "../types/campaign-studio";

/**
 * Studio workspace information architecture (primary navigation).
 *
 * Engines and section ids still exist on the Campaign Object. This map is the
 * user-facing destination for each engine — not a second freshness or facts SSOT.
 */
export const STUDIO_WORKSPACE_STEP_IDS = [
  "intake",
  "strategy",
  "creators",
  "content",
  "commercial",
  "package",
] as const;

export type StudioWorkspaceStepId = (typeof STUDIO_WORKSPACE_STEP_IDS)[number];

export type StudioWorkspaceStepDef = {
  id: StudioWorkspaceStepId;
  label: string;
  question: string;
  /** Sections rendered in this step. */
  sections: CampaignStudioSectionId[];
};

export const STUDIO_WORKSPACE_STEPS: readonly StudioWorkspaceStepDef[] = [
  {
    id: "intake",
    label: "Intake",
    question: "What are we working on?",
    sections: ["campaign-summary"],
  },
  {
    id: "strategy",
    label: "Strategy",
    question: "What is the influencer strategy for this campaign?",
    sections: ["executive-strategy"],
  },
  {
    id: "creators",
    label: "Creators",
    question: "Who should we recommend?",
    sections: ["creator-discovery", "creator-recommendations"],
  },
  {
    id: "content",
    label: "Content",
    question: "What does each creator make?",
    sections: ["content-plan"],
  },
  {
    id: "commercial",
    label: "Commercial",
    question: "How does the money work?",
    sections: ["budget-planner"],
  },
  {
    id: "package",
    label: "Package",
    question: "Is this ready for the client?",
    sections: ["presentation-status", "timeline"],
  },
] as const;

/**
 * Engines that remain on the Campaign Object but are not primary navigation.
 * Folded into a step for freshness mapping, or omitted from the primary UX.
 */
export const STUDIO_WORKSPACE_FOLDED_SECTIONS: ReadonlyArray<{
  id: CampaignStudioSectionId;
  destination: StudioWorkspaceStepId | null;
  reason: string;
}> = [
  {
    id: "creative-concepts",
    destination: "strategy",
    reason: "Content approach lives in the Strategy checklist",
  },
  {
    id: "why-ai",
    destination: "strategy",
    reason: "Decisions required live in the Strategy checklist",
  },
  {
    id: "risk-analysis",
    destination: "strategy",
    reason: "Key risks live in the Strategy checklist",
  },
  {
    id: "creator-mix",
    destination: "creators",
    reason: "Recommended mix is the Creators header",
  },
  {
    id: "executive-summary",
    destination: "package",
    reason: "One strategy narrative — Package shows readiness, not a second summary",
  },
  {
    id: "kpi-forecast",
    destination: null,
    reason: "Not a primary campaign decision screen",
  },
  {
    id: "success-probability",
    destination: null,
    reason: "Not a primary campaign decision screen",
  },
  {
    id: "industry-benchmark",
    destination: null,
    reason: "Not a primary campaign decision screen",
  },
  {
    id: "opportunity-finder",
    destination: null,
    reason: "Not a primary campaign decision screen",
  },
];

const SECTION_TO_STEP = new Map<CampaignStudioSectionId, StudioWorkspaceStepId>();

for (const step of STUDIO_WORKSPACE_STEPS) {
  for (const sectionId of step.sections) {
    SECTION_TO_STEP.set(sectionId, step.id);
  }
}

for (const folded of STUDIO_WORKSPACE_FOLDED_SECTIONS) {
  if (folded.destination) {
    SECTION_TO_STEP.set(folded.id, folded.destination);
  }
}

export function workspaceStepForSection(
  sectionId: CampaignStudioSectionId
): StudioWorkspaceStepId | null {
  return SECTION_TO_STEP.get(sectionId) ?? null;
}

export function primarySectionIdsForStep(
  stepId: StudioWorkspaceStepId
): readonly CampaignStudioSectionId[] {
  return STUDIO_WORKSPACE_STEPS.find((step) => step.id === stepId)?.sections ?? [];
}

export function isPrimaryWorkspaceSection(sectionId: CampaignStudioSectionId): boolean {
  return STUDIO_WORKSPACE_STEPS.some((step) => step.sections.includes(sectionId));
}
