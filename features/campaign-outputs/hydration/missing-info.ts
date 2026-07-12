/**
 * Missing-information detection — the "ask only for what's missing" engine.
 * Determines exactly which campaign inputs the Campaign Object already knows and
 * which are still absent, so a workflow never re-asks for known information.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { CampaignOutputKind } from "../output-types";
import { getOutputDefinition } from "../output-catalog";
import { resolveInputValue } from "../output-inputs";
import { resolveSlate } from "../output-inputs";
import type { HydrationField, MissingInformation } from "./hydration-types";

const FIELD_LABELS: Record<HydrationField, string> = {
  client: "Client",
  brand: "Brand",
  objective: "Campaign objective",
  audience: "Target audience",
  market: "Market",
  platforms: "Platforms",
  budget: "Budget",
  durationWeeks: "Campaign duration",
  creators: "Creators",
  deliverables: "Deliverables",
  kpis: "KPIs",
};

/** The full campaign checklist, in the order a wizard would ask. */
const CHECKLIST: HydrationField[] = [
  "client",
  "brand",
  "objective",
  "audience",
  "market",
  "platforms",
  "budget",
  "durationWeeks",
  "creators",
  "deliverables",
  "kpis",
];

function isPresent(campaignObject: CampaignObject, field: HydrationField): boolean {
  const facts = getCampaignFacts(campaignObject);
  switch (field) {
    case "client":
      return Boolean(facts?.clientName);
    case "brand":
      return Boolean(facts?.brandName);
    case "objective":
      return Boolean(facts?.objective);
    case "audience":
      return Boolean(facts?.audience);
    case "market":
      return Boolean(facts?.geography?.length);
    case "platforms":
      return Boolean(facts?.platforms?.length);
    case "budget":
      return Boolean(facts?.budget && facts.budget.amount > 0);
    case "durationWeeks":
      return Boolean(facts?.durationWeeks);
    case "creators":
      return resolveSlate(campaignObject).length > 0;
    case "deliverables":
      return Boolean(facts?.deliverables?.length);
    case "kpis":
      return Boolean(facts?.kpis?.length);
    default:
      return false;
  }
}

export function detectMissingInformation(campaignObject: CampaignObject): MissingInformation {
  const known: HydrationField[] = [];
  const missing: HydrationField[] = [];
  for (const field of CHECKLIST) {
    (isPresent(campaignObject, field) ? known : missing).push(field);
  }
  return { known, missing, missingLabels: missing.map((f) => FIELD_LABELS[f]) };
}

export type OutputReadiness = {
  kind: CampaignOutputKind;
  ready: boolean;
  /** Human labels of inputs this output needs that aren't present yet. */
  missingInputs: string[];
};

const INPUT_LABELS: Record<string, string> = {
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

function inputPresent(campaignObject: CampaignObject, key: string): boolean {
  const value = resolveInputValue(campaignObject, key as never);
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

/**
 * Whether an output can be generated meaningfully from the current Campaign
 * Object — and which of its inputs are still missing. Powers "Generate from
 * anywhere": a hydrated source can immediately show which outputs are ready.
 */
export function readinessForOutput(
  campaignObject: CampaignObject,
  kind: CampaignOutputKind
): OutputReadiness {
  const definition = getOutputDefinition(kind);
  if (!definition) return { kind, ready: false, missingInputs: [] };
  const missing = definition.inputKeys.filter((key) => !inputPresent(campaignObject, key));
  return {
    kind,
    ready: typeof definition.generate === "function" && missing.length === 0,
    missingInputs: missing.map((key) => INPUT_LABELS[key] ?? key),
  };
}
