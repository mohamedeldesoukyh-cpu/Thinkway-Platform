/**
 * Data-driven stage policy (mandatory + enforcement).
 * Presentation/orchestration only — not persisted; future campaign types can swap sets.
 */

import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { BusinessProcessOwner } from "@/lib/business-process/types";
import type { StageEnforcement } from "@/lib/business-process/business-state";

export type CampaignStagePolicy = {
  id: CampaignWorkspaceTabId;
  label: string;
  canonicalRef: string;
  owner: BusinessProcessOwner;
  /** Whether the stage is required for a complete campaign journey. */
  mandatory: boolean;
  /**
   * none — informational
   * soft — reminders; commercial may continue
   * hard — UI treats as cannot proceed (presentation cue only in this sprint)
   */
  enforcement: StageEnforcement;
  /** Cross-cutting workspace (not a business stage). */
  crossCutting?: boolean;
};

/** Configurable stage policy — Planning Board will plug into Planning later. */
export const CAMPAIGN_STAGE_POLICY: readonly CampaignStagePolicy[] = [
  {
    id: "overview",
    label: "Overview",
    canonicalRef: "S00–S01",
    owner: "Operations",
    mandatory: true,
    enforcement: "none",
  },
  {
    id: "lines",
    label: "Assignments",
    canonicalRef: "S06",
    owner: "Operations",
    mandatory: true,
    enforcement: "soft",
  },
  {
    id: "client-io",
    label: "Client IO",
    canonicalRef: "S07–S08",
    owner: "Commercial",
    mandatory: true,
    enforcement: "soft",
  },
  {
    id: "vendor-io",
    label: "Vendor IO",
    canonicalRef: "S09–S10",
    owner: "Operations",
    mandatory: true,
    enforcement: "soft",
  },
  {
    id: "deliverables",
    label: "Deliverables",
    canonicalRef: "S11",
    owner: "Operations",
    mandatory: true,
    enforcement: "soft",
  },
  {
    id: "publications",
    label: "Performance",
    canonicalRef: "S12–S13",
    owner: "Operations",
    mandatory: true,
    enforcement: "none",
  },
  {
    id: "billing",
    label: "Finance",
    canonicalRef: "S14–S16",
    owner: "Finance",
    mandatory: true,
    enforcement: "soft",
  },
  {
    id: "workflow",
    label: "Workflow",
    canonicalRef: "cross-cutting",
    owner: "Operations",
    mandatory: false,
    enforcement: "none",
    crossCutting: true,
  },
  {
    id: "timeline",
    label: "Timeline",
    canonicalRef: "cross-cutting",
    owner: "Operations",
    mandatory: false,
    enforcement: "none",
    crossCutting: true,
  },
] as const;

export function getStagePolicy(id: CampaignWorkspaceTabId): CampaignStagePolicy {
  return (
    CAMPAIGN_STAGE_POLICY.find((stage) => stage.id === id) ?? CAMPAIGN_STAGE_POLICY[0]
  );
}

export const BUSINESS_PROCESS_STAGES = CAMPAIGN_STAGE_POLICY.filter(
  (stage) => !stage.crossCutting
);
