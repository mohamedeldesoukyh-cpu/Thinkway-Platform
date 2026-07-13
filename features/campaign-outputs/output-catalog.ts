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
  CampaignOutputGroup,
  CampaignOutputInputKey,
  CampaignOutputKind,
} from "./output-types";
import { generateMediaPlan, MEDIA_PLAN_GENERATOR_VERSION } from "./generators/media-plan";
import { generateFullStrategy, STRATEGY_GENERATOR_VERSION } from "./generators/strategy";
import { generateKpiForecast, KPI_FORECAST_GENERATOR_VERSION } from "./generators/kpi-forecast";
import { generateRiskPlan, RISK_PLAN_GENERATOR_VERSION } from "./generators/risk-plan";
import {
  generateAmplificationPlan,
  AMPLIFICATION_PLAN_GENERATOR_VERSION,
} from "./generators/amplification-plan";
import {
  generateBudgetAllocation,
  BUDGET_ALLOCATION_GENERATOR_VERSION,
} from "./generators/budget-allocation";
import {
  generateCreatorActivation,
  CREATOR_ACTIVATION_GENERATOR_VERSION,
} from "./generators/creator-activation";
import {
  generateContentCalendar,
  CONTENT_CALENDAR_GENERATOR_VERSION,
} from "./generators/content-calendar";
import {
  generateInternalOperations,
  INTERNAL_OPERATIONS_GENERATOR_VERSION,
} from "./generators/internal-operations";
import {
  generateExecutiveProposal,
  EXECUTIVE_PROPOSAL_GENERATOR_VERSION,
} from "./generators/executive-proposal";

export type OutputGenerator = (campaignObject: CampaignObject) => CampaignOutputContent;

export type OutputDefinition = {
  kind: CampaignOutputKind;
  label: string;
  description: string;
  category: CampaignOutputCategory;
  /** Top-level Outputs Center group — the metadata that drives card grouping. */
  group: CampaignOutputGroup;
  /** Campaign inputs this output derives from — drives fingerprint + Source Data / Dependencies. */
  inputKeys: CampaignOutputInputKey[];
  /** Rough generation time for the card's "Estimated generation time". */
  estimatedGenerationMs: number;
  /** Deterministic generator; absent until wired (declared for forward-compat). */
  generate?: OutputGenerator;
  /** Semantic version of the wired generator, stored on each record for compare/repro. */
  generatorVersion?: string;
};

/** Ordered groups + labels for the Outputs Center. Metadata-driven, not hardcoded in the UI. */
export const OUTPUT_GROUPS: Array<{ group: CampaignOutputGroup; label: string }> = [
  { group: "strategy", label: "Strategy" },
  { group: "planning", label: "Planning" },
  { group: "client", label: "Client" },
  { group: "internal", label: "Internal" },
];

export const OUTPUT_CATALOG: OutputDefinition[] = [
  {
    kind: "full_strategy",
    label: "Full Campaign Strategy",
    description:
      "The complete strategy: executive summary, objectives, audience, creator & platform strategy, creative direction, activation phases, timeline, budget, KPIs, risks, and recommendations.",
    category: "strategy",
    group: "strategy",
    estimatedGenerationMs: 4500,
    inputKeys: ["objective", "audience", "market", "platforms", "creators", "budget", "timeline", "strategy"],
    generate: generateFullStrategy,
    generatorVersion: STRATEGY_GENERATOR_VERSION,
  },
  {
    kind: "media_plan",
    label: "Media Plan",
    description:
      "Quotation-aligned publishing calendar: weekly grid with creator avatar, name, and quoted ad type on every slot — synced automatically when the slate or budget changes.",
    category: "planning",
    group: "planning",
    estimatedGenerationMs: 5000,
    inputKeys: ["creators", "platforms", "timeline", "deliverables_scope"],
    generate: generateMediaPlan,
    generatorVersion: MEDIA_PLAN_GENERATOR_VERSION,
  },
  {
    kind: "executive_proposal",
    label: "Executive Proposal",
    description: "Client-facing proposal narrative assembled from the strategy and creator slate.",
    category: "presentation",
    group: "client",
    estimatedGenerationMs: 6000,
    inputKeys: ["objective", "audience", "creators", "budget", "timeline", "kpis", "strategy"],
    generate: generateExecutiveProposal,
    generatorVersion: EXECUTIVE_PROPOSAL_GENERATOR_VERSION,
  },
  {
    kind: "kpi_forecast",
    label: "KPI Forecast",
    description: "Projected reach, engagement, and conversion outcomes across the budget and KPI targets.",
    category: "performance",
    group: "strategy",
    estimatedGenerationMs: 3000,
    inputKeys: ["budget", "kpis", "platforms"],
    generate: generateKpiForecast,
    generatorVersion: KPI_FORECAST_GENERATOR_VERSION,
  },
  {
    kind: "risk_plan",
    label: "Risk & Mitigation Plan",
    description: "Campaign risks and mitigations derived from the slate, timeline, and market.",
    category: "performance",
    group: "strategy",
    estimatedGenerationMs: 2500,
    inputKeys: ["creators", "timeline", "market", "risks"],
    generate: generateRiskPlan,
    generatorVersion: RISK_PLAN_GENERATOR_VERSION,
  },
  {
    kind: "budget_allocation",
    label: "Budget Allocation Plan",
    description: "How the budget is allocated across creators, tiers, and platforms.",
    category: "planning",
    group: "planning",
    estimatedGenerationMs: 2500,
    inputKeys: ["budget", "creators", "platforms"],
    generate: generateBudgetAllocation,
    generatorVersion: BUDGET_ALLOCATION_GENERATOR_VERSION,
  },
  {
    kind: "amplification_plan",
    label: "Amplification Plan",
    description: "Paid boosting and cross-channel amplification layered over the organic plan.",
    category: "planning",
    group: "strategy",
    estimatedGenerationMs: 3000,
    inputKeys: ["creators", "platforms", "budget"],
    generate: generateAmplificationPlan,
    generatorVersion: AMPLIFICATION_PLAN_GENERATOR_VERSION,
  },
  {
    kind: "content_calendar",
    label: "Content Calendar",
    description: "Day-level content calendar across creators and platforms.",
    category: "planning",
    group: "planning",
    estimatedGenerationMs: 4000,
    inputKeys: ["creators", "platforms", "timeline"],
    generate: generateContentCalendar,
    generatorVersion: CONTENT_CALENDAR_GENERATOR_VERSION,
  },
  {
    kind: "posting_timeline",
    label: "Posting Timeline",
    description: "Sequenced posting timeline and creator dependencies.",
    category: "planning",
    group: "planning",
    estimatedGenerationMs: 3000,
    inputKeys: ["creators", "timeline", "platforms"],
  },
  {
    kind: "creator_activation",
    label: "Creator Activation Plan",
    description: "Per-creator activation brief and role in the campaign.",
    category: "operations",
    group: "planning",
    estimatedGenerationMs: 3500,
    inputKeys: ["creators", "objective", "platforms"],
    generate: generateCreatorActivation,
    generatorVersion: CREATOR_ACTIVATION_GENERATOR_VERSION,
  },
  {
    kind: "campaign_playbook",
    label: "Campaign Playbook",
    description: "The end-to-end operating playbook for running the campaign.",
    category: "operations",
    group: "internal",
    estimatedGenerationMs: 5000,
    inputKeys: ["objective", "creators", "platforms", "timeline"],
  },
  {
    kind: "executive_summary",
    label: "Executive Summary",
    description: "One-page executive summary of the campaign.",
    category: "strategy",
    group: "strategy",
    estimatedGenerationMs: 2500,
    inputKeys: ["objective", "audience", "creators", "budget"],
  },
  {
    kind: "creative_concepts",
    label: "Creative Concepts",
    description: "Creative concepts and key messages for the campaign.",
    category: "creative",
    group: "strategy",
    estimatedGenerationMs: 3500,
    inputKeys: ["objective", "audience", "creative_concepts"],
  },
  {
    kind: "client_presentation",
    label: "Client Presentation (PDF/PPT)",
    description: "Exportable client presentation deck.",
    category: "presentation",
    group: "client",
    estimatedGenerationMs: 6000,
    inputKeys: ["objective", "creators", "budget", "timeline", "strategy"],
  },
  {
    kind: "campaign_brief",
    label: "Campaign Brief (reverse)",
    description: "A campaign brief reverse-generated from the assembled campaign.",
    category: "operations",
    group: "internal",
    estimatedGenerationMs: 2500,
    inputKeys: ["objective", "audience", "market", "platforms", "budget", "timeline"],
  },
  {
    kind: "statement_of_work",
    label: "Statement of Work",
    description: "Scope, deliverables, and terms for the engagement.",
    category: "operations",
    group: "internal",
    estimatedGenerationMs: 3000,
    inputKeys: ["deliverables_scope", "creators", "budget", "timeline"],
  },
  {
    kind: "internal_operations",
    label: "Internal Operations Plan",
    description: "Internal execution and operations plan (agency-facing).",
    category: "operations",
    group: "internal",
    estimatedGenerationMs: 3500,
    inputKeys: ["creators", "timeline", "platforms", "deliverables_scope"],
    generate: generateInternalOperations,
    generatorVersion: INTERNAL_OPERATIONS_GENERATOR_VERSION,
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
