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
  buildCampaignContextDigest,
  buildChangeSummary,
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
};

/** The Campaign Copilot: interpret → execute deterministically → persist → summarize. */
export async function runStudioCopilot(input: RunInput): Promise<StudioCopilotResult> {
  const provider = input.provider ?? getDefaultLlmProvider();
  const digest = buildCampaignContextDigest(input.campaignObject);
  const intent = await interpretStudioMessage(input.message, digest, provider);

  switch (intent.kind) {
    case "remove_creators":
      return removeCreators(input, digest, intent);
    case "undo_last_change":
      return undoLastChange(input);
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

async function removeCreators(
  input: RunInput,
  digest: CampaignContextDigest,
  intent: Extract<StudioCopilotIntent, { kind: "remove_creators" }>
): Promise<StudioCopilotResult> {
  const { targets, unmatchedNames } = resolveRemovalTargets(input.campaignObject, {
    tier: intent.tier,
    names: intent.names,
  });

  if (targets.length === 0) {
    const askedTier = intent.tier ? `${intent.tier} ` : "";
    const present = Object.entries(digest.tierCounts)
      .map(([tier, count]) => `${count} ${tier}`)
      .join(", ");
    return {
      campaignObject: input.campaignObject,
      reply:
        `I couldn't find any ${askedTier}creators to remove in this campaign. ` +
        `The current slate is: ${present || "empty"}.` +
        (unmatchedNames.length ? ` No match for: ${unmatchedNames.join(", ")}.` : ""),
      changed: false,
      intentKind: "remove_creators",
    };
  }

  // Stage every removal, then apply + re-optimize in one deterministic pass.
  let draft = getStudioDraft(input.campaignObject);
  for (const change of planRemovalChanges(targets)) {
    draft = stageDraftChange(draft, change);
  }
  const staged = withStudioDraft(input.campaignObject, draft);
  const applied = applyStudioDraftChanges(staged);
  const reoptimized = await reoptimizeCampaignAfterApply(
    input.supabase,
    applied.campaignObject
  );

  const scoreBefore = digest.overallScore;
  const scoresAfter = (reoptimized.sections.performance.data as PerformanceSectionData | undefined)
    ?.campaignScores;

  const tierLabel = intent.tier ? `${intent.tier} ` : "";
  const headline = "Campaign updated successfully.";
  const changes = [
    `Removed ${targets.length} ${tierLabel}creator${targets.length === 1 ? "" : "s"} (${targets
      .map((t) => t.displayName)
      .join(", ")}).`,
    "Re-optimized the slate and refreshed creator roles.",
    "Recalculated campaign scores, budget allocation, and the presentation.",
  ];
  if (intent.reason?.trim()) changes.push(`Reason noted: ${intent.reason.trim()}`);

  const summary = buildChangeSummary({
    headline,
    changes,
    scoreBefore,
    scoresAfter,
    creatorsRemoved: targets.length,
  });

  const logged = appendChangeLog(reoptimized, {
    summary: `Removed ${targets.length} ${tierLabel}creator${targets.length === 1 ? "" : "s"}`.trim(),
    intent: "remove_creators",
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
    intentKind: "remove_creators",
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
