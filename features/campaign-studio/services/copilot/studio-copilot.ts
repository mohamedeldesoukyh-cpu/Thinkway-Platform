import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CopilotChangeLogEntry } from "@/features/campaign-intelligence/types/campaign-object";
import type { PerformanceSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { saveCampaignObject } from "@/features/campaign-intelligence/services/campaign-object-store";
import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { getDefaultLlmProvider } from "@/features/ai/llm";
import type { LlmProvider } from "@/features/ai/types/llm";

import { applyStudioDraftChanges, getStudioDraft, stageDraftChange, withStudioDraft } from "../studio-draft";
import { reoptimizeCampaignAfterApply } from "../apply-draft-reoptimize";
import {
  applyAudienceChange,
  applyBudgetChange,
  applyGeographyChange,
  applyObjectiveChange,
  applyPlatformsChange,
  applyTimelineChange,
  type FactsEditResult,
} from "./campaign-facts-mutations";
import {
  buildAdditionChanges,
  buildRemovalChanges,
  hydrateSlateCreators,
  searchCreatorsForAddition,
  slateCreatorIdSet,
} from "./slate-edit-mutations";
import { selectCreatorsToAdd, selectSlateCreatorsToRemove } from "./slate-edit-filters";
import type { StudioDraftChange } from "@/features/campaign-intelligence/types/section-schemas";
import { authorSection } from "./section-authoring";
import {
  targetForStudioSection,
  studioSectionForTarget,
  type SectionAuthorTarget,
  type StudioFocus,
} from "./section-authoring-types";
import {
  buildCampaignContextDigest,
  buildChangeSummary,
  describeDominantTiers,
  extractRationale,
  planRemovalChanges,
  renderChangeSummary,
  renderDigestForPrompt,
  resolveRemovalTargets,
  type CampaignContextDigest,
  type StudioCopilotIntent,
} from "./studio-copilot-intents";
import {
  parseStudioIntentFallback,
  parseToolCallIntent,
  STUDIO_COPILOT_TOOLS,
} from "./studio-copilot-parse";

export type StudioCopilotResult = {
  /** Updated campaign object when a change was applied; unchanged otherwise. */
  campaignObject: CampaignObject;
  /** Assistant reply to show in the chat. */
  reply: string;
  /** True when the campaign object changed (studio must re-render). */
  changed: boolean;
  intentKind: StudioCopilotIntent["kind"];
};

const SYSTEM_PROMPT = `You are the Thinkway Campaign Copilot. You are permanently editing ONE specific campaign, described in the context below. You already know exactly which campaign this is — NEVER ask the user which campaign or brand they mean.

You do not edit campaign data directly. You choose exactly ONE tool that best matches the user's request. A deterministic engine executes it and regenerates the studio.

Rules:
- To remove creators, call remove_creators (use tier for a whole follower tier, names for specific creators).
- To undo, call undo_last_change.
- To answer a question about the campaign, call answer_question.
- Only call clarify when the request is genuinely ambiguous, and reference the campaign's real contents in your question (e.g. mention how many Celebrity creators it currently has).
Always pick a tool.`;

/** Ask the model which structured intent to run; fall back to the keyword parser. */
export async function interpretStudioMessage(
  message: string,
  digest: CampaignContextDigest,
  provider: LlmProvider
): Promise<StudioCopilotIntent> {
  try {
    const response = await provider.complete({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Current campaign context:\n${renderDigestForPrompt(digest)}\n\nUser request: ${message}`,
        },
      ],
      tools: STUDIO_COPILOT_TOOLS,
      temperature: 0,
    });

    const call = response.toolCalls?.[0];
    if (call) {
      const intent = parseToolCallIntent(call);
      if (intent) return intent;
    }
  } catch {
    // Model unavailable — deterministic fallback keeps the Copilot alive.
  }

  return parseStudioIntentFallback(message);
}

function overallScore(campaignObject: CampaignObject): number | undefined {
  const performance = campaignObject.sections.performance.data as PerformanceSectionData | undefined;
  return performance?.campaignScores?.overall;
}

/** Turn a builder change line ("Updated budget to X.") into a first-person action ("updated budget to X"). */
function toAction(change: string): string {
  const trimmed = change.trim().replace(/[.!?]+$/, "");
  return trimmed ? trimmed.charAt(0).toLowerCase() + trimmed.slice(1) : trimmed;
}

function appendChangeLog(
  campaignObject: CampaignObject,
  entry: CopilotChangeLogEntry
): CampaignObject {
  return {
    ...campaignObject,
    meta: {
      ...campaignObject.meta,
      copilotChangeLog: [...(campaignObject.meta.copilotChangeLog ?? []), entry],
    },
  };
}

async function persistVersion(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string | undefined,
  campaignObject: CampaignObject
): Promise<CampaignObject> {
  try {
    return await saveCampaignObject(conversationId, campaignObject, {
      persistToDb: Boolean(userId),
      supabase,
      userId,
      saveReason: "manual",
    });
  } catch (error) {
    console.error(
      "[studio-copilot] version persist failed — keeping in-memory object:",
      error instanceof Error ? error.message : error
    );
    return campaignObject;
  }
}

type RunInput = {
  supabase: SupabaseClient;
  userId?: string;
  conversationId: string;
  campaignObject: CampaignObject;
  message: string;
  provider?: LlmProvider;
  /** Deictic focus from the UI — which studio section/element is active. */
  focus?: StudioFocus;
};

/** The Campaign Copilot: interpret → execute deterministically → persist → summarize. */
export async function runStudioCopilot(input: RunInput): Promise<StudioCopilotResult> {
  const provider = input.provider ?? getDefaultLlmProvider();
  const digest = buildCampaignContextDigest(input.campaignObject);
  const intent = await interpretStudioMessage(input.message, digest, provider);

  switch (intent.kind) {
    case "remove_creators":
      return removeCreators(input, digest, intent);
    case "add_creators":
      return addCreators(input, digest, intent);
    case "replace_creators":
      return replaceCreators(input, digest, intent);
    case "update_budget":
      return applyFactsEdit(input, digest, "update_budget", (obj) =>
        applyBudgetChange(obj, { amount: intent.amount, currency: intent.currency })
      );
    case "update_timeline":
      return applyFactsEdit(input, digest, "update_timeline", (obj) =>
        applyTimelineChange(obj, { durationWeeks: intent.durationWeeks })
      );
    case "update_platforms":
      return applyFactsEdit(input, digest, "update_platforms", (obj) =>
        applyPlatformsChange(obj, { platforms: intent.platforms })
      );
    case "update_objectives":
      return applyFactsEdit(input, digest, "update_objectives", (obj) =>
        applyObjectiveChange(obj, { objective: intent.objective })
      );
    case "update_audience":
      return applyFactsEdit(input, digest, "update_audience", (obj) =>
        applyAudienceChange(obj, { audience: intent.audience })
      );
    case "update_market":
      return applyFactsEdit(input, digest, "update_market", (obj) =>
        applyGeographyChange(obj, { geography: intent.geography })
      );
    case "author_section":
      return authorSectionEdit(input, digest, intent, provider);
    case "retone_proposal":
      return retoneProposal(input, digest, intent.tone, provider);
    case "undo_last_change":
      return undoLastChange(input);
    case "restore_version":
      return restoreVersion(input, intent.version);
    case "answer_question":
      return answerQuestion(input, digest, intent.question, provider);
    case "clarify":
      return {
        campaignObject: input.campaignObject,
        reply: intent.question || fallbackClarify(digest),
        changed: false,
        intentKind: "clarify",
      };
    default:
      // Known intent without an executor yet — be honest, never silently no-op.
      return {
        campaignObject: input.campaignObject,
        reply: `I can see you want to ${intent.kind.replace(/_/g, " ")}. That edit is coming soon — for now I can remove creators, answer questions about the campaign, and undo the last change.`,
        changed: false,
        intentKind: intent.kind,
      };
  }
}

/**
 * Apply a set of slate draft changes (removals + additions) in one deterministic
 * pass: stage → apply → re-optimize → save a version → summarize.
 */
async function commitDraftChanges(
  input: RunInput,
  digest: CampaignContextDigest,
  changes: StudioDraftChange[],
  meta: {
    intentKind: StudioCopilotResult["intentKind"];
    /** First-person action, e.g. "removed the 2 Celebrity creators (…)". */
    action: string;
    /** Grounded reason, when the user gave one. */
    rationale?: string;
    logSummary: string;
    removed: number;
    added: number;
  }
): Promise<StudioCopilotResult> {
  let draft = getStudioDraft(input.campaignObject);
  for (const change of changes) draft = stageDraftChange(draft, change);
  const staged = withStudioDraft(input.campaignObject, draft);
  const applied = applyStudioDraftChanges(staged);
  const reoptimized = await reoptimizeCampaignAfterApply(input.supabase, applied.campaignObject);

  const scoresAfter = (reoptimized.sections.performance.data as PerformanceSectionData | undefined)
    ?.campaignScores;

  // Grounded downstream effects on the actual updated campaign.
  const effects: string[] = [];
  if (meta.removed > 0 || meta.added > 0) {
    effects.push(`the creator mix was rebalanced ${describeDominantTiers(reoptimized)}`);
    effects.push("the budget was reallocated across the updated slate");
  }

  const summary = buildChangeSummary({
    action: meta.action,
    rationale: meta.rationale,
    effects,
    scoreBefore: digest.overallScore,
    scoresAfter,
  });

  const logged = appendChangeLog(reoptimized, {
    summary: meta.logSummary,
    intent: meta.intentKind,
    overallScoreAfter: scoresAfter?.overall,
    appliedAt: new Date().toISOString(),
  });
  const persisted = await persistVersion(
    input.supabase,
    input.conversationId,
    input.userId,
    logged
  );

  return {
    campaignObject: persisted,
    reply: renderChangeSummary(summary),
    changed: true,
    intentKind: meta.intentKind,
  };
}

async function removeCreators(
  input: RunInput,
  digest: CampaignContextDigest,
  intent: Extract<StudioCopilotIntent, { kind: "remove_creators" }>
): Promise<StudioCopilotResult> {
  // Tier/name targets resolve from the object; location/engagement need hydration.
  const { targets, unmatchedNames } = resolveRemovalTargets(input.campaignObject, {
    tier: intent.tier,
    names: intent.names,
  });
  const changes: StudioDraftChange[] = planRemovalChanges(targets);
  const removedNames = targets.map((t) => t.displayName);

  const needsHydration = Boolean(intent.city || intent.country || intent.belowEngagement != null);
  if (needsHydration) {
    const slate = await hydrateSlateCreators(input.supabase, input.campaignObject);
    const attributeMatches = selectSlateCreatorsToRemove(slate, {
      city: intent.city,
      country: intent.country,
      belowEngagement: intent.belowEngagement,
    });
    for (const change of buildRemovalChanges(attributeMatches)) changes.push(change);
    for (const creator of attributeMatches) removedNames.push(creator.display_name);
  }

  if (changes.length === 0) {
    const present = Object.entries(digest.tierCounts)
      .map(([tier, count]) => `${count} ${tier}`)
      .join(", ");
    const criterion = intent.city
      ? `in ${intent.city}`
      : intent.country
        ? `in ${intent.country}`
        : intent.belowEngagement != null
          ? `below ${intent.belowEngagement}% engagement`
          : intent.tier
            ? `${intent.tier}`
            : "matching that";
    return {
      campaignObject: input.campaignObject,
      reply:
        `I couldn't find any creators ${criterion} to remove. The current slate is: ${present || "empty"}.` +
        (unmatchedNames.length ? ` No match for: ${unmatchedNames.join(", ")}.` : ""),
      changed: false,
      intentKind: "remove_creators",
    };
  }

  const tierLabel = intent.tier ? `${intent.tier} ` : "";
  const criterionLabel = intent.city
    ? ` from ${intent.city}`
    : intent.country
      ? ` from ${intent.country}`
      : intent.belowEngagement != null
        ? " with the lowest engagement"
        : "";
  const action = `removed the ${changes.length} ${tierLabel}creator${changes.length === 1 ? "" : "s"}${criterionLabel} (${removedNames.join(", ")})`;

  return commitDraftChanges(input, digest, changes, {
    intentKind: "remove_creators",
    action,
    rationale: extractRationale(intent.reason),
    logSummary: `Removed ${changes.length} ${tierLabel}creator${changes.length === 1 ? "" : "s"}`.trim(),
    removed: changes.length,
    added: 0,
  });
}

async function addCreators(
  input: RunInput,
  digest: CampaignContextDigest,
  intent: Extract<StudioCopilotIntent, { kind: "add_creators" }>
): Promise<StudioCopilotResult> {
  const count = Math.min(Math.max(intent.count ?? 3, 1), 10);
  const candidates = await searchCreatorsForAddition(input.supabase, input.campaignObject, {
    category: intent.category,
    tier: intent.tier,
    city: intent.city,
    country: intent.country,
    limit: count,
  });
  const picked = selectCreatorsToAdd(candidates, slateCreatorIdSet(input.campaignObject), count);

  if (picked.length === 0) {
    const what = intent.category ? `${intent.category} ` : intent.tier ? `${intent.tier} ` : "";
    return {
      campaignObject: input.campaignObject,
      reply: `I couldn't find new ${what}creators in Discovery that aren't already on the slate. Try a broader niche or a different tier.`,
      changed: false,
      intentKind: "add_creators",
    };
  }

  const descriptor = [intent.tier, intent.category].filter(Boolean).join(" ");
  const action = `added ${picked.length} ${descriptor ? `${descriptor} ` : ""}creator${picked.length === 1 ? "" : "s"} from Discovery (${picked.map((c) => c.display_name).join(", ")})`;
  return commitDraftChanges(input, digest, buildAdditionChanges(picked), {
    intentKind: "add_creators",
    action,
    logSummary: `Added ${picked.length} ${descriptor || "creator"}${picked.length === 1 ? "" : "s"}`,
    removed: 0,
    added: picked.length,
  });
}

async function replaceCreators(
  input: RunInput,
  digest: CampaignContextDigest,
  intent: Extract<StudioCopilotIntent, { kind: "replace_creators" }>
): Promise<StudioCopilotResult> {
  // Who to remove: tier or named creators from the current slate.
  const { targets } = resolveRemovalTargets(input.campaignObject, {
    tier: intent.fromTier,
    names: intent.fromNames,
  });
  if (targets.length === 0) {
    return {
      campaignObject: input.campaignObject,
      reply: `I couldn't find ${intent.fromTier ?? "those"} creators to replace on the current slate.`,
      changed: false,
      intentKind: "replace_creators",
    };
  }

  // What to bring in: same count, target tier/category, higher engagement optional.
  const candidates = await searchCreatorsForAddition(input.supabase, input.campaignObject, {
    tier: intent.toTier ?? intent.fromTier,
    category: intent.toCategory,
    limit: targets.length,
  });
  let ranked = candidates;
  if (intent.higherEngagement) {
    ranked = [...candidates].sort(
      (a, b) => (b.metrics?.engagement_rate?.value ?? 0) - (a.metrics?.engagement_rate?.value ?? 0)
    );
  }
  const picked = selectCreatorsToAdd(
    ranked,
    slateCreatorIdSet(input.campaignObject),
    targets.length
  );

  const changes: StudioDraftChange[] = [
    ...planRemovalChanges(targets),
    ...buildAdditionChanges(picked),
  ];
  const toLabel = intent.toTier ?? intent.toCategory ?? "comparable";
  const fromLabel = intent.fromTier ?? "selected";
  const action =
    picked.length > 0
      ? `replaced ${targets.length} ${fromLabel} creator${targets.length === 1 ? "" : "s"} (${targets.map((t) => t.displayName).join(", ")}) with ${picked.length} ${toLabel} creator${picked.length === 1 ? "" : "s"} (${picked.map((c) => c.display_name).join(", ")})`
      : `removed ${targets.length} ${fromLabel} creator${targets.length === 1 ? "" : "s"} (${targets.map((t) => t.displayName).join(", ")}) — no matching ${toLabel} replacements were available in Discovery`;
  return commitDraftChanges(input, digest, changes, {
    intentKind: "replace_creators",
    action,
    rationale: intent.higherEngagement ? "you asked for higher-engagement creators" : undefined,
    logSummary: `Replaced ${targets.length} ${fromLabel} with ${picked.length} ${toLabel}`,
    removed: targets.length,
    added: picked.length,
  });
}

/**
 * Facts-level edits (budget, timeline, platforms, objective, audience, market):
 * mutate the facts SSOT, re-optimize the slate + scores from the new facts, save
 * a version, and summarize. Budget/duration/mix/waves re-derive from facts at
 * read time, so the studio and exports update automatically.
 */
async function applyFactsEdit(
  input: RunInput,
  digest: CampaignContextDigest,
  intentKind: StudioCopilotResult["intentKind"],
  mutate: (campaignObject: CampaignObject) => FactsEditResult
): Promise<StudioCopilotResult> {
  const result = mutate(input.campaignObject);
  if (!result.change) {
    return {
      campaignObject: input.campaignObject,
      reply:
        "I couldn't apply that change — please restate the exact value (for example \"set the budget to EGP 2,000,000\" or \"make it 4 weeks\").",
      changed: false,
      intentKind,
    };
  }

  const reoptimized = await reoptimizeCampaignAfterApply(input.supabase, result.campaignObject);
  const scoresAfter = (reoptimized.sections.performance.data as PerformanceSectionData | undefined)
    ?.campaignScores;

  const summary = buildChangeSummary({
    action: toAction(result.change),
    effects: ["the studio, budget allocation, and campaign scores were refreshed from the new inputs"],
    scoreBefore: digest.overallScore,
    scoresAfter,
  });

  const logged = appendChangeLog(reoptimized, {
    summary: result.change,
    intent: intentKind,
    overallScoreAfter: scoresAfter?.overall,
    appliedAt: new Date().toISOString(),
  });
  const persisted = await persistVersion(
    input.supabase,
    input.conversationId,
    input.userId,
    logged
  );

  return {
    campaignObject: persisted,
    reply: renderChangeSummary(summary),
    changed: true,
    intentKind,
  };
}

/** Last studio section the Copilot authored — resolves "this section" conversationally. */
function conversationalFocusTarget(
  campaignObject: CampaignObject
): SectionAuthorTarget | undefined {
  const log = campaignObject.meta.copilotChangeLog ?? [];
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const section = log[i]?.section;
    if (section) {
      const target = targetForStudioSection(section);
      if (target) return target;
    }
  }
  return undefined;
}

/**
 * Content authoring: the LLM re-writes ONE section's content, validated and
 * patched in place. No slate/score recompute — content edits don't change the
 * slate — and every other section is preserved. Saves a new version.
 */
async function authorSectionEdit(
  input: RunInput,
  digest: CampaignContextDigest,
  intent: Extract<StudioCopilotIntent, { kind: "author_section" }>,
  provider: LlmProvider
): Promise<StudioCopilotResult> {
  const target =
    intent.target ??
    targetForStudioSection(input.focus?.sectionId) ??
    conversationalFocusTarget(input.campaignObject);

  if (!target) {
    return {
      campaignObject: input.campaignObject,
      reply:
        "Which part would you like me to rewrite — the strategy or the executive summary? (Or open a section in the studio and say \"rewrite this\".)",
      changed: false,
      intentKind: "author_section",
    };
  }

  const result = await authorSection(provider, input.campaignObject, {
    target,
    instruction: intent.instruction || "Improve this section.",
    tone: intent.tone,
    focus: input.focus,
  });

  if (!result.change) {
    return {
      campaignObject: input.campaignObject,
      reply: result.reason ?? "I couldn't author that section — please try again.",
      changed: false,
      intentKind: "author_section",
    };
  }

  const summary = buildChangeSummary({
    action: toAction(result.change),
    effects: ["only this section changed — the creators, budget, and every other section are untouched"],
  });

  const logged = appendChangeLog(result.campaignObject, {
    summary: result.change,
    intent: "author_section",
    section: result.section,
    overallScoreAfter: digest.overallScore,
    appliedAt: new Date().toISOString(),
  });
  const persisted = await persistVersion(
    input.supabase,
    input.conversationId,
    input.userId,
    logged
  );

  return {
    campaignObject: persisted,
    reply: renderChangeSummary(summary),
    changed: true,
    intentKind: "author_section",
  };
}

/** Apply a tone across the whole proposal — re-author the narrative sections together. */
async function retoneProposal(
  input: RunInput,
  digest: CampaignContextDigest,
  tone: string,
  provider: LlmProvider
): Promise<StudioCopilotResult> {
  if (!tone.trim()) {
    return {
      campaignObject: input.campaignObject,
      reply: "What tone should I apply — for example executive, premium, or data-driven?",
      changed: false,
      intentKind: "retone_proposal",
    };
  }

  let obj = input.campaignObject;
  const changes: string[] = [];
  for (const target of ["strategy", "executive_summary"] as const) {
    const result = await authorSection(provider, obj, {
      target,
      instruction: `Rewrite this to be more ${tone}, preserving all facts and structure.`,
      tone,
    });
    if (result.change) {
      obj = result.campaignObject;
      changes.push(result.change);
    }
  }

  if (changes.length === 0) {
    return {
      campaignObject: input.campaignObject,
      reply: `I couldn't retone the proposal just now — please try again.`,
      changed: false,
      intentKind: "retone_proposal",
    };
  }

  const summary = buildChangeSummary({
    action: `rewrote the proposal in a more ${tone} tone across ${changes.length} section${changes.length === 1 ? "" : "s"}`,
    effects: ["the facts, creators, and budget are unchanged — only the writing was refined"],
  });

  const logged = appendChangeLog(obj, {
    summary: `Retoned the proposal (${tone})`,
    intent: "retone_proposal",
    section: "executive-strategy",
    overallScoreAfter: digest.overallScore,
    appliedAt: new Date().toISOString(),
  });
  const persisted = await persistVersion(
    input.supabase,
    input.conversationId,
    input.userId,
    logged
  );

  return {
    campaignObject: persisted,
    reply: renderChangeSummary(summary),
    changed: true,
    intentKind: "retone_proposal",
  };
}

async function undoLastChange(input: RunInput): Promise<StudioCopilotResult> {
  try {
    const versions = await CampaignObjectPersistenceService.listVersions(
      input.supabase,
      input.campaignObject.id
    );
    if (versions.length < 2) {
      return {
        campaignObject: input.campaignObject,
        reply: "This is the earliest version of the campaign — there's nothing to undo yet.",
        changed: false,
        intentKind: "undo_last_change",
      };
    }
    const previous = await CampaignObjectPersistenceService.loadVersion(
      input.supabase,
      input.campaignObject.id,
      versions[1]!.version
    );
    if (!previous) {
      return {
        campaignObject: input.campaignObject,
        reply: "I couldn't load the previous version to undo. Please try again.",
        changed: false,
        intentKind: "undo_last_change",
      };
    }

    const restored = appendChangeLog(previous.campaignObject, {
      summary: `Reverted to version ${versions[1]!.version}`,
      intent: "undo_last_change",
      overallScoreAfter: overallScore(previous.campaignObject),
      appliedAt: new Date().toISOString(),
    });
    const persisted = await persistVersion(
      input.supabase,
      input.conversationId,
      input.userId,
      restored
    );
    return {
      campaignObject: persisted,
      reply: `✅ Undone. The campaign is back to the state before the last change (version ${versions[1]!.version}).`,
      changed: true,
      intentKind: "undo_last_change",
    };
  } catch {
    return {
      campaignObject: input.campaignObject,
      reply:
        "I couldn't undo the last change — version history isn't available for this campaign yet.",
      changed: false,
      intentKind: "undo_last_change",
    };
  }
}

/**
 * Restore a specific earlier version: load its snapshot and save it as a new
 * current version (forward-restore — the history is preserved, never rewritten).
 */
async function restoreVersion(input: RunInput, version: number): Promise<StudioCopilotResult> {
  if (!Number.isFinite(version) || version < 1) {
    return {
      campaignObject: input.campaignObject,
      reply: "Please tell me which version number to restore (for example \"restore version 2\").",
      changed: false,
      intentKind: "restore_version",
    };
  }
  try {
    const target = await CampaignObjectPersistenceService.loadVersion(
      input.supabase,
      input.campaignObject.id,
      version
    );
    if (!target) {
      return {
        campaignObject: input.campaignObject,
        reply: `I couldn't find version ${version} for this campaign.`,
        changed: false,
        intentKind: "restore_version",
      };
    }
    const restored = appendChangeLog(target.campaignObject, {
      summary: `Restored version ${version}`,
      intent: "restore_version",
      overallScoreAfter: overallScore(target.campaignObject),
      appliedAt: new Date().toISOString(),
    });
    const persisted = await persistVersion(
      input.supabase,
      input.conversationId,
      input.userId,
      restored
    );
    return {
      campaignObject: persisted,
      reply: `✅ Restored version ${version}. The studio now reflects that earlier state (saved as a new version, so nothing is lost).`,
      changed: true,
      intentKind: "restore_version",
    };
  } catch {
    return {
      campaignObject: input.campaignObject,
      reply: "I couldn't restore that version — version history isn't available yet.",
      changed: false,
      intentKind: "restore_version",
    };
  }
}

async function answerQuestion(
  input: RunInput,
  digest: CampaignContextDigest,
  question: string,
  provider: LlmProvider
): Promise<StudioCopilotResult> {
  try {
    const response = await provider.complete({
      messages: [
        {
          role: "system",
          content:
            "You are the Thinkway Campaign Copilot. Answer the user's question about THIS campaign using only the context provided. Be concise and specific. Do not invent creators, numbers, or facts not in the context.",
        },
        {
          role: "user",
          content: `Campaign context:\n${renderDigestForPrompt(digest)}\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0.2,
    });
    const answer = response.content?.trim();
    if (answer) {
      return {
        campaignObject: input.campaignObject,
        reply: answer,
        changed: false,
        intentKind: "answer_question",
      };
    }
  } catch {
    // Fall through to a grounded deterministic answer.
  }

  return {
    campaignObject: input.campaignObject,
    reply: deterministicAnswer(digest),
    changed: false,
    intentKind: "answer_question",
  };
}

function deterministicAnswer(digest: CampaignContextDigest): string {
  const tierSummary = Object.entries(digest.tierCounts)
    .map(([tier, count]) => `${count} ${tier}`)
    .join(", ");
  return [
    `Here's where **${digest.campaignName}** stands:`,
    digest.objective ? `Objective: ${digest.objective}` : null,
    digest.platforms.length ? `Platforms: ${digest.platforms.join(", ")}` : null,
    digest.budget
      ? `Budget: ${digest.budget.amount.toLocaleString()} ${digest.budget.currency}`
      : null,
    `Creator slate (${digest.slate.length}): ${tierSummary || "none"}`,
    digest.overallScore != null ? `Overall score: ${digest.overallScore}/100` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function fallbackClarify(digest: CampaignContextDigest): string {
  const tierSummary = Object.entries(digest.tierCounts)
    .map(([tier, count]) => `${count} ${tier}`)
    .join(", ");
  return `Your current campaign has ${digest.slate.length} creators (${tierSummary || "none"}). What would you like to change — the creators, budget, timeline, audience, or strategy?`;
}
