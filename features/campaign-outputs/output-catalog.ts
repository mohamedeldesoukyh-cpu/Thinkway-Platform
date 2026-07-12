/**
 * Output catalog — the declarative registry of every Campaign Output, the
 * campaign inputs it depends on, and (where wired) its deterministic generator.
 *
 * The catalog is the dependency graph's source of truth. `inputKeys` both
 * fingerprints an output and tells the Outputs Center its "Source Data" /
 * "Dependencies". The dependency map is tuned to the platform's stale rules:
 *
 *   • creators change → Strategy, Media Plan, Timeline, Proposal, Budget Allocation
 *   • budget   change → Strategy, Budget Allocation, KPI Forecast, Proposal
 *   • kpis     change → ONLY KPI Forecast and Proposal   (kpis is depended on by
 *                        exactly those two outputs — nothing else goes stale)
 *
 * New outputs are declared here with their inputs even before a generator
 * exists, so the vocabulary is stable and the Center can list them as
 * "Not Generated".
 */

import type { CampaignObject } from "@/features/campaign-intelligence";

import type {
  CampaignOutputCategory,
  CampaignOutputContent,
  CampaignOutputInputKey,
  CampaignOutputKind,
} from "./output-types";
import { generateMediaPlan, MEDIA_PLAN_GENERATOR_VERSION } from "./generators/media-plan";
import { generateFullStrategy, STRATEGY_GENERATOR_VERSION } from "./generators/strategy";

export type OutputGenerator = (campaignObject: CampaignObject) => CampaignOutputContent;

export type OutputDefinition = {
  kind: CampaignOutputKind;
  label: string;
  description: string;
  category: CampaignOutputCategory;
  /** Campaign inputs this output derives from — drives fingerprint + Source Data / Dependencies. */
  inputKeys: CampaignOutputInputKey[];
  /** Deterministic generator; absent until wired (declared for forward-compat). */
  generate?: OutputGenerator;
  /** Semantic version of the wired generator, stored on each record for compare/repro. */
  generatorVersion?: string;
};

export const OUTPUT_CATALOG: OutputDefinition[] = [
  {
    kind: "full_strategy",
    label: "Full Campaign Strategy",
    description:
      "The complete strategy: executive summary, objectives, audience, creator & platform strategy, creative direction, activation phases, timeline, budget, KPIs, risks, and recommendations.",
    category: "strategy",
    inputKeys: ["objective", "audience", "market", "platforms", "creators", "budget", "timeline", "strategy"],
    generate: generateFullStrategy,
    generatorVersion: STRATEGY_GENERATOR_VERSION,
  },
  {
    kind: "media_plan",
    label: "Media Plan",
    description:
      "Agency-grade publishing plan: weekly & daily calendar, creator-by-creator schedule, platform allocation, activation waves, review & client approval milestones, optimization & paid amplification windows, contingency windows, creator dependencies, and production/asset deadlines.",
    category: "planning",
    inputKeys: ["creators", "platforms", "timeline", "deliverables_scope"],
    generate: generateMediaPlan,
    generatorVersion: MEDIA_PLAN_GENERATOR_VERSION,
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
    description: "Projected reach, engagement, and conversion outcomes across the budget and KPI targets.",
    category: "performance",
    inputKeys: ["budget", "kpis", "platforms"],
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
    description: "Sequenced posting timeline and creator dependencies.",
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
    inputKeys: ["objective", "creators", "platforms", "timeline"],
  },
  {
    kind: "executive_summary",
    label: "Executive Summary",
    description: "One-page executive summary of the campaign.",
    category: "strategy",
    inputKeys: ["objective", "audience", "creators", "budget"],
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
    inputKeys: ["objective", "creators", "budget", "timeline", "strategy"],
  },
  {
    kind: "campaign_brief",
    label: "Campaign Brief (reverse)",
    description: "A campaign brief reverse-generated from the assembled campaign.",
    category: "operations",
    inputKeys: ["objective", "audience", "market", "platforms", "budget", "timeline"],
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

const CATALOG_BY_KIND = new Map<CampaignOutputKind, OutputDefinition>(
  OUTPUT_CATALOG.map((definition) => [definition.kind, definition])
);

export function getOutputDefinition(kind: CampaignOutputKind): OutputDefinition | undefined {
  return CATALOG_BY_KIND.get(kind);
}

/** Every output that declares a dependency on the given input key. */
export function outputsDependingOn(inputKey: CampaignOutputInputKey): CampaignOutputKind[] {
  return OUTPUT_CATALOG.filter((definition) => definition.inputKeys.includes(inputKey)).map(
    (definition) => definition.kind
  );
}

/** Human labels for input keys — shown as an output's "Source Data" / "Dependencies". */
export const INPUT_KEY_LABELS: Record<CampaignOutputInputKey, string> = {
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
