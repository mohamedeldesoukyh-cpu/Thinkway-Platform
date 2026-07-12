import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignOutputKind } from "@/features/campaign-outputs/output-types";
import type {
  CampaignScoreSet,
  CreatorsSectionData,
  PerformanceSectionData,
  StudioDraftChange,
  VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import { matchesTierLabel, normalizeTierLabel } from "../creator-slate";
import { normalizeCreatorId } from "../studio-draft";
import type { SectionAuthorTarget } from "./section-authoring-types";

/**
 * The Campaign Copilot never edits campaign JSON directly. The LLM emits one of
 * these structured intents; the deterministic engine executes it. This is the
 * full vocabulary — each increment wires more of them to executors, but the
 * schema is stable so the model always speaks the same language.
 */
export type StudioCopilotIntentKind =
  | "remove_creators"
  | "add_creators"
  | "replace_creators"
  | "update_budget"
  | "update_timeline"
  | "update_objectives"
  | "update_audience"
  | "update_platforms"
  | "update_market"
  | "update_strategy"
  | "update_deliverables"
  | "update_kpis"
  | "update_proposal"
  | "update_creative_concepts"
  | "update_presentation"
  | "author_section"
  | "retone_proposal"
  | "generate_output"
  | "regenerate_output"
  | "export_output"
  | "open_output"
  | "preview_output"
  | "explain_output_staleness"
  | "compare_output_versions"
  | "review_campaign"
  | "undo_last_change"
  | "restore_version"
  | "answer_question"
  | "clarify";

export type RemoveCreatorsIntent = {
  kind: "remove_creators";
  /** Follower tier to remove wholesale, e.g. "Celebrity", "Macro". */
  tier?: string;
  /** Specific creators by display name or handle. */
  names?: string[];
  /** Remove creators located in this city (requires hydration). */
  city?: string;
  /** Remove creators located in this country (requires hydration). */
  country?: string;
  /** Remove creators with engagement rate below this % (requires hydration). */
  belowEngagement?: number;
  /** Human phrasing of the reason, surfaced back to the user. */
  reason?: string;
};

export type AddCreatorsIntent = {
  kind: "add_creators";
  /** Content category / niche to search Discovery for, e.g. "parenting". */
  category?: string;
  /** Follower tier to target. */
  tier?: string;
  city?: string;
  country?: string;
  /** How many to add (default 3). */
  count?: number;
};

export type ReplaceCreatorsIntent = {
  kind: "replace_creators";
  /** Tier to replace out of the slate. */
  fromTier?: string;
  /** Specific creators to replace by name/handle. */
  fromNames?: string[];
  /** Tier to bring in. */
  toTier?: string;
  /** Category to search for replacements. */
  toCategory?: string;
  /** Prefer higher-engagement replacements. */
  higherEngagement?: boolean;
};

export type UpdateBudgetIntent = { kind: "update_budget"; amount: number; currency?: string };
export type UpdateTimelineIntent = { kind: "update_timeline"; durationWeeks: number };
export type UpdatePlatformsIntent = { kind: "update_platforms"; platforms: string[] };
export type UpdateObjectivesIntent = { kind: "update_objectives"; objective: string };
export type UpdateAudienceIntent = { kind: "update_audience"; audience: string };
export type UpdateMarketIntent = { kind: "update_market"; geography: string[] };

export type AuthorSectionIntent = {
  kind: "author_section";
  /** Target section; resolved from focus / conversation when omitted. */
  target?: SectionAuthorTarget;
  /** What the user wants done, e.g. "make it more premium", "expand this". */
  instruction: string;
  /** Optional tone/style, e.g. "premium", "executive", "youth-focused". */
  tone?: string;
};

/** Apply a tone across the whole proposal's narrative sections in one edit. */
export type RetoneProposalIntent = {
  kind: "retone_proposal";
  tone: string;
  instruction?: string;
};

/**
 * Campaign Outputs Engine intents. The Copilot resolves which output the user
 * means (kind) and whether to force a rebuild; a deterministic Output Generator
 * executes it. Only the requested output is (re)generated.
 */
export type GenerateOutputIntent = {
  kind: "generate_output";
  /** Which Campaign Output to generate; resolved from the request when omitted. */
  output?: CampaignOutputKind;
};
export type RegenerateOutputIntent = {
  kind: "regenerate_output";
  output?: CampaignOutputKind;
};
export type ExportOutputIntent = {
  kind: "export_output";
  output?: CampaignOutputKind;
};
/** Outputs Center operations: navigate, preview, explain staleness, compare versions. */
export type OpenOutputIntent = { kind: "open_output"; output?: CampaignOutputKind };
export type PreviewOutputIntent = { kind: "preview_output"; output?: CampaignOutputKind };
export type ExplainStalenessIntent = {
  kind: "explain_output_staleness";
  output?: CampaignOutputKind;
};
export type CompareVersionsIntent = {
  kind: "compare_output_versions";
  output?: CampaignOutputKind;
  from?: number;
  to?: number;
};

/** AI Campaign Director: review the whole Campaign Object and propose improvements. */
export type ReviewCampaignIntent = { kind: "review_campaign" };

export type AnswerQuestionIntent = { kind: "answer_question"; question: string };
export type ClarifyIntent = { kind: "clarify"; question: string };
export type UndoIntent = { kind: "undo_last_change" };
export type RestoreVersionIntent = { kind: "restore_version"; version: number };

/** Intents wired to executors in this increment; the rest are typed for forward-compat. */
export type ExecutableStudioCopilotIntent =
  | RemoveCreatorsIntent
  | AddCreatorsIntent
  | ReplaceCreatorsIntent
  | UpdateBudgetIntent
  | UpdateTimelineIntent
  | UpdatePlatformsIntent
  | UpdateObjectivesIntent
  | UpdateAudienceIntent
  | UpdateMarketIntent
  | AuthorSectionIntent
  | RetoneProposalIntent
  | GenerateOutputIntent
  | RegenerateOutputIntent
  | ExportOutputIntent
  | OpenOutputIntent
  | PreviewOutputIntent
  | ExplainStalenessIntent
  | CompareVersionsIntent
  | ReviewCampaignIntent
  | AnswerQuestionIntent
  | ClarifyIntent
  | UndoIntent
  | RestoreVersionIntent;

export type StudioCopilotIntent =
  | ExecutableStudioCopilotIntent
  | { kind: Exclude<StudioCopilotIntentKind, ExecutableStudioCopilotIntent["kind"]>; [key: string]: unknown };

// ---------------------------------------------------------------------------
// Campaign context digest — attached to every Copilot turn so the AI always
// knows exactly which campaign it is working on and never asks "which one?".
// ---------------------------------------------------------------------------

export type CampaignSlateEntry = {
  creatorId: string;
  displayName: string;
  tier?: string;
};

export type CampaignContextDigest = {
  campaignName: string;
  client?: string;
  brand?: string;
  market?: string;
  objective?: string;
  audience?: string;
  platforms: string[];
  budget?: { amount: number; currency: string };
  durationWeeks?: number;
  deliverables: string[];
  kpis: string[];
  slate: CampaignSlateEntry[];
  tierCounts: Record<string, number>;
  strategySummary?: string;
  overallScore?: number;
  recentChanges: string[];
};

function reasoningEntries(campaignObject: CampaignObject): VendorSelectedReasoning[] {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  return creatorsData.recommendations?.selectedReasoning ?? [];
}

function creatorIds(campaignObject: CampaignObject): string[] {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  return creatorsData.recommendations?.creatorIds ?? [];
}

/** Current slate as name + tier, resolved from the object's own reasoning (no hydration). */
export function resolveCampaignSlate(campaignObject: CampaignObject): CampaignSlateEntry[] {
  const byId = new Map(
    reasoningEntries(campaignObject).map((r) => [normalizeCreatorId(r.creatorId), r])
  );
  return creatorIds(campaignObject).map((id) => {
    const entry = byId.get(normalizeCreatorId(id));
    return {
      creatorId: id,
      displayName: entry?.displayName?.trim() || id,
      tier: entry?.expectedRole?.trim() || undefined,
    };
  });
}

function tierCountsOf(slate: CampaignSlateEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of slate) {
    const tier = entry.tier ? normalizeTierLabel(entry.tier) : "Unclassified";
    counts[tier] = (counts[tier] ?? 0) + 1;
  }
  return counts;
}

function overallScoreOf(campaignObject: CampaignObject): number | undefined {
  const performance = campaignObject.sections.performance.data as PerformanceSectionData | undefined;
  return performance?.campaignScores?.overall;
}

export function buildCampaignContextDigest(campaignObject: CampaignObject): CampaignContextDigest {
  const facts = getCampaignFacts(campaignObject);
  const slate = resolveCampaignSlate(campaignObject);
  const presentation = campaignObject.sections.presentation?.data as
    | { campaignName?: string; brandName?: string }
    | undefined;

  const strategyContent = campaignObject.sections.strategy?.content;
  const strategySummary =
    typeof strategyContent === "string" ? strategyContent.slice(0, 600) : undefined;

  return {
    campaignName:
      presentation?.campaignName?.trim() ||
      (facts?.brandName ? `${facts.brandName} Campaign` : "Campaign"),
    client: facts?.clientName,
    brand: facts?.brandName ?? presentation?.brandName,
    market: facts?.geography?.join(", "),
    objective: facts?.objective,
    audience: facts?.audience,
    platforms: facts?.platforms ?? [],
    budget: facts?.budget,
    durationWeeks: facts?.durationWeeks,
    deliverables: facts?.deliverables ?? [],
    kpis: facts?.kpis ?? [],
    slate,
    tierCounts: tierCountsOf(slate),
    strategySummary,
    overallScore: overallScoreOf(campaignObject),
    recentChanges: (campaignObject.meta.copilotChangeLog ?? [])
      .slice(-5)
      .map((entry) => entry.summary),
  };
}

/** Render the digest as compact prompt text the model reads on every turn. */
export function renderDigestForPrompt(digest: CampaignContextDigest): string {
  const lines: string[] = [];
  lines.push(`Campaign: ${digest.campaignName}`);
  if (digest.client) lines.push(`Client: ${digest.client}`);
  if (digest.brand) lines.push(`Brand: ${digest.brand}`);
  if (digest.market) lines.push(`Market: ${digest.market}`);
  if (digest.objective) lines.push(`Objective: ${digest.objective}`);
  if (digest.audience) lines.push(`Audience: ${digest.audience}`);
  if (digest.platforms.length) lines.push(`Platforms: ${digest.platforms.join(", ")}`);
  if (digest.budget)
    lines.push(`Budget: ${digest.budget.amount.toLocaleString()} ${digest.budget.currency}`);
  if (digest.durationWeeks) lines.push(`Duration: ${digest.durationWeeks} weeks`);
  if (digest.deliverables.length) lines.push(`Deliverables: ${digest.deliverables.join("; ")}`);
  if (digest.kpis.length) lines.push(`KPIs: ${digest.kpis.join("; ")}`);
  if (digest.overallScore != null) lines.push(`Overall score: ${digest.overallScore}/100`);

  const tierSummary = Object.entries(digest.tierCounts)
    .map(([tier, count]) => `${count} ${tier}`)
    .join(", ");
  lines.push(`Creator slate (${digest.slate.length}): ${tierSummary || "none"}`);
  for (const entry of digest.slate) {
    lines.push(`  - ${entry.displayName}${entry.tier ? ` (${entry.tier})` : ""}`);
  }
  if (digest.recentChanges.length) {
    lines.push(`Recent changes: ${digest.recentChanges.join(" → ")}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Removal target resolution — turn "remove celebrities" / "remove @x" into
// concrete creator ids using only the object's own data.
// ---------------------------------------------------------------------------

export type ResolvedRemovalTargets = {
  targets: CampaignSlateEntry[];
  /** Names/handles the user asked for that matched no creator in the slate. */
  unmatchedNames: string[];
};

function matchesName(entry: CampaignSlateEntry, query: string): boolean {
  const q = query.trim().replace(/^@/, "").toLowerCase();
  if (!q) return false;
  const name = entry.displayName.toLowerCase();
  const handle = entry.creatorId.toLowerCase();
  return name.includes(q) || q.includes(name) || handle.includes(q);
}

export function resolveRemovalTargets(
  campaignObject: CampaignObject,
  intent: Pick<RemoveCreatorsIntent, "tier" | "names">
): ResolvedRemovalTargets {
  const slate = resolveCampaignSlate(campaignObject);
  const targetIds = new Set<string>();
  const targets: CampaignSlateEntry[] = [];
  const unmatchedNames: string[] = [];

  const add = (entry: CampaignSlateEntry) => {
    const key = normalizeCreatorId(entry.creatorId);
    if (targetIds.has(key)) return;
    targetIds.add(key);
    targets.push(entry);
  };

  if (intent.tier?.trim()) {
    for (const entry of slate) {
      if (entry.tier && matchesTierLabel(intent.tier, entry.tier)) add(entry);
    }
  }

  for (const name of intent.names ?? []) {
    const matches = slate.filter((entry) => matchesName(entry, name));
    if (matches.length === 0) {
      unmatchedNames.push(name);
      continue;
    }
    matches.forEach(add);
  }

  return { targets, unmatchedNames };
}

export function planRemovalChanges(targets: CampaignSlateEntry[]): StudioDraftChange[] {
  const stagedAt = new Date().toISOString();
  return targets.map((entry) => ({
    kind: "remove_creator" as const,
    creatorId: entry.creatorId,
    displayName: entry.displayName,
    stagedAt,
  }));
}

// ---------------------------------------------------------------------------
// Change summary — the transparent "here is what changed" block.
// ---------------------------------------------------------------------------

export type CampaignChangeSummary = {
  /** First-person past-tense action, e.g. "removed the 2 Celebrity creators". */
  action: string;
  /** The grounded reason, e.g. "the client will handle them". */
  rationale?: string;
  /** Downstream effects on the campaign, e.g. "the creator mix was rebalanced...". */
  effects: string[];
  scoreBefore?: number;
  scoreAfter?: number;
};

export function buildChangeSummary(input: {
  action: string;
  rationale?: string;
  effects?: string[];
  scoreBefore?: number;
  scoresAfter?: CampaignScoreSet;
}): CampaignChangeSummary {
  return {
    action: input.action,
    rationale: input.rationale,
    effects: input.effects ?? [],
    scoreBefore: input.scoreBefore,
    scoreAfter: input.scoresAfter?.overall,
  };
}

/** Pull a grounded reason clause out of the user's instruction ("... because X"). */
export function extractRationale(text?: string): string | undefined {
  if (!text) return undefined;
  const m = text.match(/\b(?:because|since|so that|as)\b\s+(.+)$/i);
  if (!m?.[1]) return undefined;
  const clause = m[1].trim().replace(/[.!?]+$/, "");
  // Ignore trivially short or non-reason fragments.
  if (clause.split(/\s+/).length < 2) return undefined;
  return clause;
}

/** "toward macro and mid-tier creators" — the tiers the updated slate now leans on. */
export function describeDominantTiers(campaignObject: CampaignObject): string {
  const counts = tierCountsOf(resolveCampaignSlate(campaignObject));
  const ranked = Object.entries(counts)
    .filter(([tier]) => tier !== "Unclassified")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([tier]) => tier.toLowerCase());
  if (ranked.length === 0) return "across the remaining creators";
  return `toward ${ranked.join(" and ")} creators`;
}

function scoreSentence(before?: number, after?: number): string | undefined {
  if (after == null) return before == null ? undefined : undefined;
  if (before == null) return `the overall campaign score is ${after}/100`;
  if (Math.abs(after - before) <= 1) return `the campaign score held steady at ${after}/100`;
  if (after > before) return `the campaign score rose from ${before} to ${after}/100`;
  return `the campaign score moved from ${before} to ${after}/100`;
}

function joinClauses(clauses: string[]): string {
  const parts = clauses.filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]}, and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function capitalizeFirst(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/**
 * Render the change as a strategist's explanation: what changed, WHY, and the
 * grounded downstream effect on the campaign — never a bare changelog.
 */
export function renderChangeSummary(summary: CampaignChangeSummary): string {
  const lead = `I ${summary.action}${summary.rationale ? ` because ${summary.rationale}` : ""}.`;

  const tail = [...summary.effects];
  const score = scoreSentence(summary.scoreBefore, summary.scoreAfter);
  if (score) tail.push(score);

  const second = tail.length > 0 ? `${capitalizeFirst(joinClauses(tail))}.` : "";
  return [lead, second].filter(Boolean).join(" ");
}
