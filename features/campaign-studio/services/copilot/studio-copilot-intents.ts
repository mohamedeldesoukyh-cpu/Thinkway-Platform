import type { CampaignObject } from "@/features/campaign-intelligence";
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
  headline: string;
  changes: string[];
  scoreBefore?: number;
  scoreAfter?: number;
  creatorsRemoved: number;
  creatorsAdded: number;
};

export function buildChangeSummary(input: {
  headline: string;
  changes: string[];
  scoreBefore?: number;
  scoresAfter?: CampaignScoreSet;
  creatorsRemoved?: number;
  creatorsAdded?: number;
}): CampaignChangeSummary {
  return {
    headline: input.headline,
    changes: input.changes,
    scoreBefore: input.scoreBefore,
    scoreAfter: input.scoresAfter?.overall,
    creatorsRemoved: input.creatorsRemoved ?? 0,
    creatorsAdded: input.creatorsAdded ?? 0,
  };
}

/** Render the change summary as the markdown reply the chat shows. */
export function renderChangeSummary(summary: CampaignChangeSummary): string {
  const lines: string[] = [`✅ ${summary.headline}`, "", "Changes applied:"];
  for (const change of summary.changes) lines.push(`- ${change}`);
  if (summary.scoreBefore != null || summary.scoreAfter != null) {
    lines.push("");
    lines.push(
      `Overall Campaign Score: ${summary.scoreBefore ?? "—"} → ${summary.scoreAfter ?? "—"}`
    );
  }
  if (summary.creatorsRemoved > 0) lines.push(`Creators removed: ${summary.creatorsRemoved}`);
  if (summary.creatorsAdded > 0) lines.push(`Creators added: ${summary.creatorsAdded}`);
  return lines.join("\n");
}
