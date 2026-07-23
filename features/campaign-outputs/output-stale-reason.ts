/**
 * Human phrasing for staleness — the "Reason:" line on a Needs-Update output.
 * Always names the exact campaign input(s) that changed, never a generic message.
 */

import type { CampaignOutputInputKey } from "./output-types";

/** "Creator slate changed", "Budget changed", … — the reason for a single input. */
export const INPUT_CHANGE_PHRASES: Record<CampaignOutputInputKey, string> = {
  brief: "Campaign brief changed",
  creators: "Creator slate changed",
  budget: "Budget changed",
  timeline: "Timeline changed",
  platforms: "Platform mix changed",
  objective: "Objective changed",
  audience: "Audience changed",
  market: "Market changed",
  kpis: "KPIs changed",
  strategy: "Strategy content changed",
  creative_concepts: "Creative concepts changed",
  risks: "Risks changed",
  deliverables_scope: "Deliverables scope changed",
  market_intelligence: "Market intelligence settings changed",
};

function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

/** Compose one reason sentence from the changed input keys. */
export function describeInputsChanged(inputs: CampaignOutputInputKey[]): string {
  const phrases = inputs.map((key) => INPUT_CHANGE_PHRASES[key]);
  if (phrases.length === 0) return "Manual regeneration.";
  if (phrases.length === 1) return `${phrases[0]}.`;
  const head = phrases.slice(0, -1).map((p, i) => (i === 0 ? p : lowerFirst(p)));
  const tail = lowerFirst(phrases[phrases.length - 1]!);
  return `${head.join(", ")} and ${tail}.`;
}
