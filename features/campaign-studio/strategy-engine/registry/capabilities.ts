import type { PlanningCapabilityDefinition } from "../types/planning-capability";

/**
 * Planning Capability Registry.
 * Capabilities declare interest in routing slices; all reads/writes resolve
 * through Campaign Object (and Media Plan / Outputs engines). Planning Context
 * never owns these slices as persisted fields.
 */
export const PLANNING_CAPABILITIES: readonly PlanningCapabilityDefinition[] = [
  {
    id: "campaign_brief",
    label: "Campaign Brief",
    description: "Authors and updates the campaign brief on Campaign Object facts.",
    reads: ["brief", "objectives", "audience", "planningStatus"],
    writes: ["brief", "objectives", "audience", "planningStatus"],
  },
  {
    id: "objectives",
    label: "Objectives",
    description: "Campaign objectives on Campaign Object facts.",
    reads: ["objectives", "brief"],
    writes: ["objectives", "planningStatus"],
  },
  {
    id: "audience",
    label: "Audience",
    description: "Audience definition on Campaign Object.",
    reads: ["audience", "markets", "platforms"],
    writes: ["audience", "markets", "planningStatus"],
  },
  {
    id: "discovery",
    label: "Discovery",
    description: "Creator discovery into Campaign Object recommendations.",
    reads: ["platforms", "markets", "audience", "creatorSlate", "brief"],
    writes: ["creatorSlate", "planningStatus"],
  },
  {
    id: "creator_slate",
    label: "Creator Slate",
    description: "Compose creator recommendations on Campaign Object.",
    reads: ["creatorSlate", "creatorRoles", "mediaMix"],
    writes: ["creatorSlate", "planningStatus"],
  },
  {
    id: "creator_compare",
    label: "Creator Compare",
    description: "Compare creators; may update recommendation ids on Campaign Object.",
    reads: ["creatorSlate", "creatorRoles", "budget", "platforms"],
    writes: ["creatorSlate"],
  },
  {
    id: "budget",
    label: "Budget",
    description: "Budget on Campaign Object facts — not a separate budget document.",
    reads: ["budget", "mediaMix", "creatorSlate"],
    writes: ["budget", "planningStatus"],
  },
  {
    id: "media_plan",
    label: "Media Plan",
    description:
      "References Media Plan SSOT on Campaign Object — never duplicates schedule ledger. Schedule mutations go through lib/media-plan only.",
    reads: ["mediaPlan", "creatorSlate", "platforms", "budget"],
    writes: ["planningStatus"],
  },
  {
    id: "strategy_narrative",
    label: "Strategy Narrative",
    description: "Strategy section content on Campaign Object.",
    reads: ["strategyNarrative", "brief", "objectives", "audience"],
    writes: ["strategyNarrative", "planningStatus"],
  },
  {
    id: "proposal",
    label: "Proposal",
    description: "Proposal narrative via Campaign Object presentation section (existing artifact).",
    reads: [
      "proposal",
      "brief",
      "strategyNarrative",
      "creatorSlate",
      "budget",
      "presentation",
    ],
    writes: ["proposal", "planningStatus"],
  },
  {
    id: "presentation",
    label: "Presentation",
    description: "Presentation section on Campaign Object.",
    reads: ["presentation", "proposal", "planningStatus"],
    writes: ["presentation", "planningStatus"],
  },
  {
    id: "outputs",
    label: "Outputs",
    description: "Orchestrates Campaign Outputs registry already on Campaign Object.meta.",
    reads: ["mediaPlan", "proposal", "presentation", "creatorSlate", "budget", "outputs"],
    writes: ["planningStatus"],
  },
  {
    id: "approval",
    label: "Approval",
    description: "Maps approval/freeze intents onto Campaign Object lifecycle signals.",
    reads: ["planningStatus", "presentation", "creatorSlate", "budget"],
    writes: ["planningStatus"],
  },
] as const;
