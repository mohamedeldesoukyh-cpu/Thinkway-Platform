import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CopilotChangeLogEntry } from "@/features/campaign-intelligence/types/campaign-object";
import type { PerformanceSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignOutputKind } from "@/features/campaign-outputs/output-types";
import { getOutputDefinition } from "@/features/campaign-outputs/output-catalog";
import {
  markStaleCampaignOutputs,
  staleCampaignOutputKinds,
} from "@/features/campaign-outputs/output-registry";
import {
  resolveOutputKind,
  runCompareVersions,
  runExplainStaleness,
  runExportOutput,
  runGenerateOutput,
  runOpenOutput,
  runPreviewOutput,
} from "@/features/campaign-outputs/copilot/output-copilot";
import { runReviewCampaign } from "@/features/campaign-outputs/director/director-copilot";
import { generateCampaignOutput } from "@/features/campaign-outputs/output-registry";
import {
  mutateMediaPlanSchedule,
  prepareMediaPlanRegenerate,
} from "@/features/campaign-outputs/media-plan-mutations";
import { MEDIA_PLAN_REGENERATE_DISABLED_MESSAGE } from "@/lib/media-plan";
import { saveCampaignObject } from "@/features/campaign-intelligence/services/campaign-object-store";
import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { isCampaignPlanLockedForEdits, APPROVED_PLAN_EDIT_BLOCKED_MESSAGE } from "@/lib/domains/commercial/campaign-plan-approval";
import { getDefaultLlmProvider } from "@/features/ai/llm";
import type { LlmProvider } from "@/features/ai/types/llm";

import { mergeBriefIntoCampaignObject } from "../merge-campaign-brief";
import { reoptimizeCampaignAfterApply } from "../apply-draft-reoptimize";
import { getStudioDraft, stageDraftChange, withStudioDraft } from "../studio-draft";
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
  /** UI directive: focus this output in the Outputs Center. */
  outputNavigate?: CampaignOutputKind;
  /** UI directive: open this output's preview. */
  outputPreview?: CampaignOutputKind;
};

const SYSTEM_PROMPT = `You are the Thinkway Campaign Copilot. You are permanently editing ONE specific campaign, described in the context below. You already know exactly which campaign this is — NEVER ask the user which campaign or brand they mean.

You do not edit campaign data directly. You choose exactly ONE tool that best matches the user's request. A deterministic engine executes it and regenerates the studio.

Rules:
- To remove creators, call remove_creators (use tier for a whole follower tier, names for specific creators).
- To set or update the campaign brief (client brief, pasted text), call update_brief — this merges strategy and scheduling and never clears the creator slate.
- To move creators between weeks/days or weight publishing across weeks, call reschedule_media_plan — do NOT change campaignStartDate unless the user explicitly asks to change when the campaign starts.
- To change only the campaign start date or total duration, call update_timeline.
- To generate a Campaign Output (Media Plan, Full Campaign Strategy, Executive Proposal, Timeline, KPI Forecast, Budget Allocation, Risk Assessment, Amplification Plan, Creative Concepts, Executive Summary, Presentation, …), call generate_output. To rebuild one after changes, call regenerate_output. To export one, call export_output. Generate ONLY the output the user asked for — never regenerate unrelated outputs.
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
        applyTimelineChange(obj, {
          durationWeeks: intent.durationWeeks,
          startDate: intent.startDate,
        })
      );
    case "reschedule_media_plan":
      return rescheduleMediaPlan(input, digest, intent);
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
    case "update_brief":
      return applyBriefUpdate(input, digest, intent);
    case "author_section":
      return authorSectionEdit(input, digest, intent, provider);
    case "retone_proposal":
      return retoneProposal(input, digest, intent.tone, provider);
    case "generate_output":
      return generateOutputEdit(input, intent.output, { regenerate: false });
    case "regenerate_output":
      return generateOutputEdit(input, intent.output, { regenerate: true });
    case "export_output":
      return exportOutputEdit(input, intent.output);
    case "open_output":
      return openOutputOp(input, intent.output);
    case "preview_output":
      return previewOutputOp(input, intent.output);
    case "explain_output_staleness":
      return explainStalenessOp(input, intent.output);
    case "compare_output_versions":
      return compareVersionsOp(input, intent.output, intent.from, intent.to);
    case "review_campaign":
      return reviewCampaignOp(input);
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
 * Stage slate draft changes only — Copilot must not apply or regenerate the plan.
 * The user commits via Apply Changes in the Creator Slate review UI.
 */
async function stageDraftChanges(
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

  const effects = [
    "changes are staged in the creator slate — click Apply Changes to regenerate the full campaign plan",
  ];

  const summary = buildChangeSummary({
    action: meta.action,
    rationale: meta.rationale,
    effects,
    scoreBefore: digest.overallScore,
  });

  const logged = appendChangeLog(staged, {
    summary: `${meta.logSummary} (staged — not applied)`,
    intent: meta.intentKind,
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
    reply: `${renderChangeSummary(summary)} Use **Apply Changes** in the Creator Slate to commit.`,
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

  return stageDraftChanges(input, digest, changes, {
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
  return stageDraftChanges(input, digest, buildAdditionChanges(picked), {
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
  return stageDraftChanges(input, digest, changes, {
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
async function applyBriefUpdate(
  input: RunInput,
  digest: CampaignContextDigest,
  intent: Extract<StudioCopilotIntent, { kind: "update_brief" }>
): Promise<StudioCopilotResult> {
  const result = mergeBriefIntoCampaignObject(input.campaignObject, intent.briefText);
  if (!result.change) {
    return {
      campaignObject: input.campaignObject,
      reply:
        "I couldn't save that brief — paste at least a few sentences (objective, audience, timing, deliverables). The creator slate was not changed.",
      changed: false,
      intentKind: "update_brief",
    };
  }

  const { campaignObject: next, effect: staleEffect } = applyOutputStaleness(
    result.campaignObject,
    input.campaignObject
  );

  const effects = [
    "the brief is now the strategy source for scheduling and outputs",
    `${digest.slate.length} creator${digest.slate.length === 1 ? "" : "s"} on the slate unchanged`,
  ];
  if (staleEffect) effects.push(staleEffect);

  const summary = buildChangeSummary({
    action: toAction(result.change),
    effects,
  });

  const logged = appendChangeLog(next, {
    summary: result.change,
    intent: "update_brief",
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
    intentKind: "update_brief",
    outputNavigate: "media_plan",
  };
}

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
        "I couldn't apply that change — please restate the exact value (for example \"set the budget to EGP 2,000,000\", \"make it 4 weeks\", or \"start the campaign on 15/07/2026\").",
      changed: false,
      intentKind,
    };
  }

  const reoptimized = await reoptimizeCampaignAfterApply(input.supabase, result.campaignObject);
  const { campaignObject: finalObject, effect: staleEffect } = applyOutputStaleness(
    reoptimized,
    input.campaignObject
  );
  const scoresAfter = (finalObject.sections.performance.data as PerformanceSectionData | undefined)
    ?.campaignScores;

  const effects = ["the studio, budget allocation, and campaign scores were refreshed from the new inputs"];
  if (staleEffect) effects.push(staleEffect);

  const summary = buildChangeSummary({
    action: toAction(result.change),
    effects,
    scoreBefore: digest.overallScore,
    scoresAfter,
  });

  const logged = appendChangeLog(finalObject, {
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

async function rescheduleMediaPlan(
  input: RunInput,
  digest: CampaignContextDigest,
  intent: Extract<StudioCopilotIntent, { kind: "reschedule_media_plan" }>
): Promise<StudioCopilotResult> {
  const result = mutateMediaPlanSchedule(
    input.campaignObject,
    {
      weekWeights: intent.weekWeights,
      moveCreators: intent.moveCreators,
    },
    {
      source: "studio_media_plan_ui",
      actorUserId: input.userId,
      autoForkDraft: true,
    }
  );

  if (!result.ok) {
    return {
      campaignObject: input.campaignObject,
      reply: result.message,
      changed: false,
      intentKind: "reschedule_media_plan",
    };
  }

  if (!result.change) {
    return {
      campaignObject: input.campaignObject,
      reply:
        "I couldn't reschedule the media plan — name the creators and target week (for example \"move Nour to week 3\" or \"weight the first 2 weeks heavier\"). The campaign start date was not changed.",
      changed: false,
      intentKind: "reschedule_media_plan",
    };
  }

  let next = result.campaignObject;
  try {
    ({ campaignObject: next } = generateCampaignOutput(next, "media_plan", {
      origin: "copilot",
    }));
  } catch {
    /* keep schedule meta even if regeneration fails */
  }

  const logged = appendChangeLog(next, {
    summary: result.change,
    intent: "reschedule_media_plan",
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
    reply: `${result.change} The Media Plan calendar was regenerated — the campaign start date is unchanged.`,
    changed: true,
    intentKind: "reschedule_media_plan",
    outputNavigate: "media_plan",
    outputPreview: "media_plan",
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

  const { campaignObject: finalObject, effect: staleEffect } = applyOutputStaleness(
    result.campaignObject,
    input.campaignObject
  );

  const effects = ["only this section changed — the creators, budget, and every other section are untouched"];
  if (staleEffect) effects.push(staleEffect);

  const summary = buildChangeSummary({
    action: toAction(result.change),
    effects,
  });

  const logged = appendChangeLog(finalObject, {
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

/**
 * Campaign Outputs Engine: generate or regenerate a single output, then persist
 * a version. The deterministic Output Generator does the work; the Copilot only
 * routes to it. Only the requested output changes — never anything else.
 */
async function generateOutputEdit(
  input: RunInput,
  output: CampaignOutputKind | undefined,
  options: { regenerate: boolean }
): Promise<StudioCopilotResult> {
  const intentKind: StudioCopilotResult["intentKind"] = options.regenerate
    ? "regenerate_output"
    : "generate_output";
  const kind = output ?? resolveOutputKind(input.message);
  if (!kind) {
    return {
      campaignObject: input.campaignObject,
      reply:
        "Which output would you like me to generate — the Media Plan, the Full Campaign Strategy, the Executive Proposal, the KPI Forecast, or another?",
      changed: false,
      intentKind,
    };
  }

  const { data: head } = await input.supabase
    .from("campaign_objects")
    .select("lifecycle_status")
    .eq("id", input.campaignObject.id)
    .maybeSingle();

  const lifecycle = (head as { lifecycle_status?: string } | null)?.lifecycle_status;
  if (isCampaignPlanLockedForEdits(lifecycle)) {
    return {
      campaignObject: input.campaignObject,
      reply: APPROVED_PLAN_EDIT_BLOCKED_MESSAGE,
      changed: false,
      intentKind,
    };
  }

  let campaignObjectForGenerate = input.campaignObject;
  // Explicit Media Plan regenerate must respect immutable baseline rules.
  if (kind === "media_plan" && options.regenerate) {
    const prepared = prepareMediaPlanRegenerate(input.campaignObject, {
      actorUserId: input.userId,
    });
    if (!prepared.ok) {
      return {
        campaignObject: input.campaignObject,
        reply: prepared.message,
        changed: false,
        intentKind,
      };
    }
    if (!prepared.canRegenerateNow) {
      return {
        campaignObject: prepared.campaignObject,
        reply: prepared.message ?? MEDIA_PLAN_REGENERATE_DISABLED_MESSAGE,
        changed: false,
        intentKind,
      };
    }
    campaignObjectForGenerate = prepared.campaignObject;
  }

  const result = runGenerateOutput(campaignObjectForGenerate, {
    kind,
    regenerate: options.regenerate,
  });
  if (!result.changed) {
    return {
      campaignObject: result.campaignObject,
      reply: result.reply,
      changed: false,
      intentKind,
      outputPreview: result.preview,
    };
  }

  const label = getOutputDefinition(kind)?.label ?? kind;
  const logged = appendChangeLog(result.campaignObject, {
    summary: `${options.regenerate ? "Regenerated" : "Generated"} the ${label} (v${result.record?.version ?? 1})`,
    intent: intentKind,
    overallScoreAfter: overallScore(result.campaignObject),
    appliedAt: new Date().toISOString(),
  });
  const persisted = await persistVersion(input.supabase, input.conversationId, input.userId, logged);

  return { campaignObject: persisted, reply: result.reply, changed: true, intentKind };
}

/** Export a Campaign Output, generating the latest version first if needed. */
async function exportOutputEdit(
  input: RunInput,
  output: CampaignOutputKind | undefined
): Promise<StudioCopilotResult> {
  const kind = output ?? resolveOutputKind(input.message);
  if (!kind) {
    return {
      campaignObject: input.campaignObject,
      reply: "Which output should I export — the Strategy, the Proposal, or the Media Plan?",
      changed: false,
      intentKind: "export_output",
    };
  }

  const result = runExportOutput(input.campaignObject, { kind });
  if (!result.changed) {
    // Nothing new persisted (already current) — just return the rendered export.
    return {
      campaignObject: result.campaignObject,
      reply: result.reply,
      changed: false,
      intentKind: "export_output",
    };
  }

  const label = getOutputDefinition(kind)?.label ?? kind;
  const logged = appendChangeLog(result.campaignObject, {
    summary: `Generated the ${label} for export (v${result.record?.version ?? 1})`,
    intent: "export_output",
    overallScoreAfter: overallScore(result.campaignObject),
    appliedAt: new Date().toISOString(),
  });
  const persisted = await persistVersion(input.supabase, input.conversationId, input.userId, logged);

  return { campaignObject: persisted, reply: result.reply, changed: true, intentKind: "export_output" };
}

/** Resolve the output kind for a Center op, or a clarify prompt if none is given. */
function outputKindOrAsk(
  input: RunInput,
  output: CampaignOutputKind | undefined,
  intentKind: StudioCopilotResult["intentKind"]
): CampaignOutputKind | StudioCopilotResult {
  const kind = output ?? resolveOutputKind(input.message);
  if (kind) return kind;
  return {
    campaignObject: input.campaignObject,
    reply: "Which output do you mean — the Media Plan, the Strategy, the Proposal, or another?",
    changed: false,
    intentKind,
  };
}

/** Open an output in the Outputs Center (navigation directive for the UI). */
async function openOutputOp(
  input: RunInput,
  output: CampaignOutputKind | undefined
): Promise<StudioCopilotResult> {
  const resolved = outputKindOrAsk(input, output, "open_output");
  if (typeof resolved !== "string") return resolved;
  const result = runOpenOutput(input.campaignObject, { kind: resolved });
  return {
    campaignObject: result.campaignObject,
    reply: result.reply,
    changed: false,
    intentKind: "open_output",
    outputNavigate: result.navigate,
  };
}

/** Preview an output; generate the latest version first if needed (then persist). */
async function previewOutputOp(
  input: RunInput,
  output: CampaignOutputKind | undefined
): Promise<StudioCopilotResult> {
  const resolved = outputKindOrAsk(input, output, "preview_output");
  if (typeof resolved !== "string") return resolved;
  const result = runPreviewOutput(input.campaignObject, { kind: resolved });
  if (!result.changed) {
    return {
      campaignObject: result.campaignObject,
      reply: result.reply,
      changed: false,
      intentKind: "preview_output",
      outputPreview: result.preview,
    };
  }
  const label = getOutputDefinition(resolved)?.label ?? resolved;
  const logged = appendChangeLog(result.campaignObject, {
    summary: `Generated the ${label} for preview (v${result.record?.version ?? 1})`,
    intent: "preview_output",
    overallScoreAfter: overallScore(result.campaignObject),
    appliedAt: new Date().toISOString(),
  });
  const persisted = await persistVersion(input.supabase, input.conversationId, input.userId, logged);
  return {
    campaignObject: persisted,
    reply: result.reply,
    changed: true,
    intentKind: "preview_output",
    outputPreview: result.preview,
  };
}

/** Explain precisely why an output needs updating (read-only). */
async function explainStalenessOp(
  input: RunInput,
  output: CampaignOutputKind | undefined
): Promise<StudioCopilotResult> {
  const resolved = outputKindOrAsk(input, output, "explain_output_staleness");
  if (typeof resolved !== "string") return resolved;
  const result = runExplainStaleness(input.campaignObject, { kind: resolved });
  return {
    campaignObject: result.campaignObject,
    reply: result.reply,
    changed: false,
    intentKind: "explain_output_staleness",
  };
}

/** Compare two versions of an output (read-only). */
async function compareVersionsOp(
  input: RunInput,
  output: CampaignOutputKind | undefined,
  from?: number,
  to?: number
): Promise<StudioCopilotResult> {
  const resolved = outputKindOrAsk(input, output, "compare_output_versions");
  if (typeof resolved !== "string") return resolved;
  const result = runCompareVersions(input.campaignObject, { kind: resolved, from, to });
  return {
    campaignObject: result.campaignObject,
    reply: result.reply,
    changed: false,
    intentKind: "compare_output_versions",
    outputNavigate: result.navigate,
  };
}

/** AI Campaign Director: review the campaign and propose improvements (read-only). */
async function reviewCampaignOp(input: RunInput): Promise<StudioCopilotResult> {
  const result = runReviewCampaign(input.campaignObject);
  return {
    campaignObject: result.campaignObject,
    reply: result.reply,
    changed: false,
    intentKind: "review_campaign",
  };
}

/**
 * After an input-changing edit, flip any generated outputs whose inputs changed
 * to "Needs Update" (precise dependency graph) and describe the newly-stale ones
 * so the change summary tells the user what to regenerate.
 */
function applyOutputStaleness(
  edited: CampaignObject,
  before: CampaignObject
): { campaignObject: CampaignObject; effect?: string } {
  const marked = markStaleCampaignOutputs(edited);
  const beforeStale = new Set(staleCampaignOutputKinds(before));
  const newly = staleCampaignOutputKinds(marked).filter((kind) => !beforeStale.has(kind));
  if (newly.length === 0) return { campaignObject: marked };
  const labels = newly.map((kind) => getOutputDefinition(kind)?.label ?? kind).join(", ");
  return {
    campaignObject: marked,
    effect: `${newly.length} output${newly.length === 1 ? "" : "s"} need updating (${labels}) — regenerate from Outputs when ready`,
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
