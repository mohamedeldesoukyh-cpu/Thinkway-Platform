/**
 * Deliverable catalog — the declarative registry of every deliverable, the
 * campaign inputs it depends on, and (where wired) its deterministic generator.
 *
 * The catalog is the dependency graph's source of truth: `inputKeys` both
 * fingerprints the deliverable and tells the panel its "Source Data". New
 * deliverables are declared here with their inputs even before a generator
 * exists, so the vocabulary is stable and the panel can list them as
 * "Not Generated" — mirroring how the Copilot declares intents ahead of executors.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";

import type {
  DeliverableCategory,
  DeliverableContent,
  DeliverableInputKey,
  DeliverableKind,
} from "./deliverable-types";
import { generateMediaPlan } from "./generators/media-plan";
import { generateFullStrategy } from "./generators/strategy";

export type DeliverableGenerator = (campaignObject: CampaignObject) => DeliverableContent;

export type DeliverableDefinition = {
  kind: DeliverableKind;
  label: string;
  description: string;
  category: DeliverableCategory;
  /** Campaign inputs this deliverable derives from — drives fingerprint + "Source Data". */
  inputKeys: DeliverableInputKey[];
  /** Deterministic generator; absent until wired (declared for forward-compat). */
  generate?: DeliverableGenerator;
};

export const DELIVERABLE_CATALOG: DeliverableDefinition[] = [
  {
    kind: "full_strategy",
    label: "Full Campaign Strategy",
    description:
      "The complete strategy: objectives, audience, creator & platform strategy, creative direction, timeline, budget, KPIs, risks, and recommendations.",
    category: "strategy",
    inputKeys: [
      "objective",
      "audience",
      "market",
      "platforms",
      "creators",
      "budget",
      "timeline",
      "kpis",
      "strategy",
      "risks",
    ],
    generate: generateFullStrategy,
  },
  {
    kind: "media_plan",
    label: "Media Plan",
    description:
      "Creator-by-creator publishing calendar: weekly and daily schedule, platform allocation, waves, dependencies, review and approval milestones, and optimization windows.",
    category: "planning",
    inputKeys: ["creators", "platforms", "timeline", "deliverables_scope"],
    generate: generateMediaPlan,
  },
  {
    kind: "executive_proposal",
    label: "Executive Proposal",
    description: "Client-facing proposal narrative assembled from the strategy and creator slate.",
    category: "presentation",
    inputKeys: ["objective", "audience", "creators", "budget", "timeline", "kpis", "strategy"],
  },
  {
    kind: "kpi_forecast",
    label: "KPI Forecast",
    description: "Projected reach, engagement, and conversion outcomes across the slate and budget.",
    category: "performance",
    inputKeys: ["creators", "budget", "platforms", "kpis"],
  },
  {
    kind: "risk_plan",
    label: "Risk & Mitigation Plan",
    description: "Campaign risks and mitigations derived from the slate, timeline, and market.",
    category: "performance",
    inputKeys: ["creators", "timeline", "market", "risks"],
  },
  {
    kind: "budget_allocation",
    label: "Budget Allocation Plan",
    description: "How the budget is allocated across creators, tiers, and platforms.",
    category: "planning",
    inputKeys: ["budget", "creators", "platforms"],
  },
  {
    kind: "amplification_plan",
    label: "Amplification Plan",
    description: "Paid boosting and cross-channel amplification layered over the organic plan.",
    category: "planning",
    inputKeys: ["creators", "platforms", "budget"],
  },
  {
    kind: "content_calendar",
    label: "Content Calendar",
    description: "Day-level content calendar across creators and platforms.",
    category: "planning",
    inputKeys: ["creators", "platforms", "timeline"],
  },
  {
    kind: "posting_timeline",
    label: "Posting Timeline",
    description: "Sequenced posting timeline and dependencies.",
    category: "planning",
    inputKeys: ["creators", "timeline", "platforms"],
  },
  {
    kind: "creator_activation",
    label: "Creator Activation Plan",
    description: "Per-creator activation brief and role in the campaign.",
    category: "operations",
    inputKeys: ["creators", "objective", "platforms"],
  },
  {
    kind: "campaign_playbook",
    label: "Campaign Playbook",
    description: "The end-to-end operating playbook for running the campaign.",
    category: "operations",
    inputKeys: ["objective", "creators", "platforms", "timeline", "kpis"],
  },
  {
    kind: "executive_summary",
    label: "Executive Summary",
    description: "One-page executive summary of the campaign.",
    category: "strategy",
    inputKeys: ["objective", "audience", "creators", "budget", "kpis"],
  },
  {
    kind: "creative_concepts",
    label: "Creative Concepts",
    description: "Creative concepts and key messages for the campaign.",
    category: "creative",
    inputKeys: ["objective", "audience", "creative_concepts"],
  },
  {
    kind: "client_presentation",
    label: "Client Presentation (PDF/PPT)",
    description: "Exportable client presentation deck.",
    category: "presentation",
    inputKeys: ["objective", "creators", "budget", "timeline", "kpis", "strategy"],
  },
  {
    kind: "campaign_brief",
    label: "Campaign Brief (reverse)",
    description: "A campaign brief reverse-generated from the assembled campaign.",
    category: "operations",
    inputKeys: ["objective", "audience", "market", "platforms", "budget", "timeline", "kpis"],
  },
  {
    kind: "statement_of_work",
    label: "Statement of Work",
    description: "Scope, deliverables, and terms for the engagement.",
    category: "operations",
    inputKeys: ["deliverables_scope", "creators", "budget", "timeline"],
  },
  {
    kind: "internal_operations",
    label: "Internal Operations Plan",
    description: "Internal execution and operations plan (agency-facing).",
    category: "operations",
    inputKeys: ["creators", "timeline", "platforms", "deliverables_scope"],
  },
];

const CATALOG_BY_KIND = new Map<DeliverableKind, DeliverableDefinition>(
  DELIVERABLE_CATALOG.map((definition) => [definition.kind, definition])
);

export function getDeliverableDefinition(kind: DeliverableKind): DeliverableDefinition | undefined {
  return CATALOG_BY_KIND.get(kind);
}

/** Human labels for input keys — shown as the deliverable's "Source Data". */
export const INPUT_KEY_LABELS: Record<DeliverableInputKey, string> = {
  objective: "Objective",
  audience: "Audience",
  market: "Market",
  platforms: "Platforms",
  creators: "Creators",
  budget: "Budget",
  timeline: "Timeline",
  kpis: "KPIs",
  strategy: "Strategy",
  creative_concepts: "Creative concepts",
  risks: "Risks",
  deliverables_scope: "Deliverables scope",
};
