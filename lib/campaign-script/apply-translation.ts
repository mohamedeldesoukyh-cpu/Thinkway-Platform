import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { LlmProvider } from "@/features/ai/types/llm";

import { loadCampaignScriptMaster } from "./load-master";
import { saveCampaignScriptMaster } from "./save-master";
import { loadCampaignScriptAssignmentById } from "./assignments";
import { loadCampaignScriptOverrideView, saveCampaignScriptOverride } from "./save-override";
import { translateCampaignScriptText } from "./translate-script";
import type { CampaignScriptTranslateJobData } from "./translation-job";
import {
  decideTranslationApply,
  translationRevisionOrigins,
  type TranslationApplyDiscardReason,
} from "./translation-policy";
import {
  updateCampaignScriptAssignmentTranslationState,
  updateCampaignScriptTranslationState,
} from "./translation-state";
import type { CampaignScriptMasterView, ScriptLanguage } from "./types";

type Supabase = SupabaseClient<Database>;

export type TranslationJobOutcome =
  | { outcome: "applied"; revisionId: string }
  | { outcome: "discarded"; reason: TranslationApplyDiscardReason }
  | { outcome: "failed"; message: string };

export async function processCampaignScriptTranslationJob(
  supabase: Supabase,
  data: CampaignScriptTranslateJobData,
  options?: { attemptsMade?: number; provider?: LlmProvider }
): Promise<TranslationJobOutcome> {
  if (data.assignmentId) {
    return processAssignmentTranslationJob(supabase, data, options);
  }
  return processMasterTranslationJob(supabase, data, options);
}

async function processMasterTranslationJob(
  supabase: Supabase,
  data: CampaignScriptTranslateJobData,
  options?: { attemptsMade?: number; provider?: LlmProvider }
): Promise<TranslationJobOutcome> {
  const attempts = (options?.attemptsMade ?? 0) + 1;
  const loaded = await loadCampaignScriptMaster(supabase, data.campaignHeaderId);
  const first = decideTranslationApply({
    script: loaded,
    expectedSourceRevisionId: data.sourceRevisionId,
    targetLanguage: data.targetLanguage,
    forceRegenerate: data.forceRegenerate,
  });

  if (first.action === "discard") {
    await handleDiscard(supabase, data.scriptId, loaded, first.reason, data.forceRegenerate);
    return { outcome: "discarded", reason: first.reason };
  }

  const translated = await translateCampaignScriptText({
    sourceLanguage: first.sourceLanguage,
    targetLanguage: first.targetLanguage,
    sourceText: first.sourceBody,
    provider: options?.provider,
  });

  if (!translated.ok) {
    await updateCampaignScriptTranslationState(supabase, data.scriptId, {
      translationStatus: "failed",
      translationTargetLanguage: data.targetLanguage,
      translationSourceRevisionId: data.sourceRevisionId,
      translationError: translated.message,
      translationAttempts: attempts,
    });
    throw new Error(translated.message);
  }

  const latest = await loadCampaignScriptMaster(supabase, data.campaignHeaderId);
  const second = decideTranslationApply({
    script: latest,
    expectedSourceRevisionId: data.sourceRevisionId,
    targetLanguage: data.targetLanguage,
    forceRegenerate: data.forceRegenerate,
  });
  if (second.action === "discard") {
    await handleDiscard(supabase, data.scriptId, latest, second.reason, data.forceRegenerate);
    return { outcome: "discarded", reason: second.reason };
  }

  const bodies = buildTranslatedScriptBodies({
    sourceLanguage: second.sourceLanguage,
    targetLanguage: second.targetLanguage,
    sourceBody: second.sourceBody,
    translatedBody: translated.text,
  });

  const saved = await saveCampaignScriptMaster(supabase, {
    campaignHeaderId: data.campaignHeaderId,
    expectedCurrentRevisionId: data.sourceRevisionId,
    sourceLanguage: second.sourceLanguage,
    bodyEn: bodies.bodyEn,
    bodyAr: bodies.bodyAr,
    actorKind: "internal",
    actorUserId: null,
    actorLabel: "Thinkway",
    origin: latest!.origin,
    reviewId: null,
    originalFileName: latest!.originalFileName,
    changeSummary: data.forceRegenerate ? "Regenerated translation" : "Requested translation",
    bumpBusinessVersion: false,
    originsOverride: translationRevisionOrigins(second.sourceLanguage),
  });

  if (!saved.ok) {
    if (saved.conflict) {
      await handleDiscard(supabase, data.scriptId, saved.script, "stale_source", data.forceRegenerate);
      return { outcome: "discarded", reason: "stale_source" };
    }
    await updateCampaignScriptTranslationState(supabase, data.scriptId, {
      translationStatus: "failed",
      translationTargetLanguage: data.targetLanguage,
      translationSourceRevisionId: data.sourceRevisionId,
      translationError: saved.message,
      translationAttempts: attempts,
    });
    throw new Error(saved.message);
  }

  await updateCampaignScriptTranslationState(supabase, data.scriptId, {
    translationStatus: "generated",
    translationTargetLanguage: data.targetLanguage,
    translationSourceRevisionId: saved.script.currentRevisionId,
    translationError: null,
    translationAttempts: attempts,
  });

  return { outcome: "applied", revisionId: saved.script.currentRevisionId };
}

async function processAssignmentTranslationJob(
  supabase: Supabase,
  data: CampaignScriptTranslateJobData,
  options?: { attemptsMade?: number; provider?: LlmProvider }
): Promise<TranslationJobOutcome> {
  const assignmentId = data.assignmentId?.trim() ?? "";
  const attempts = (options?.attemptsMade ?? 0) + 1;
  const assignment = await loadCampaignScriptAssignmentById(supabase, assignmentId);
  const loaded = assignment ? await loadCampaignScriptOverrideView(supabase, assignment) : null;
  const first = decideTranslationApply({
    script: loaded,
    expectedSourceRevisionId: data.sourceRevisionId,
    targetLanguage: data.targetLanguage,
    forceRegenerate: data.forceRegenerate,
  });

  if (first.action === "discard") {
    await handleAssignmentDiscard(supabase, assignmentId, loaded, first.reason, data.forceRegenerate);
    return { outcome: "discarded", reason: first.reason };
  }

  const translated = await translateCampaignScriptText({
    sourceLanguage: first.sourceLanguage,
    targetLanguage: first.targetLanguage,
    sourceText: first.sourceBody,
    provider: options?.provider,
  });

  if (!translated.ok) {
    await updateCampaignScriptAssignmentTranslationState(supabase, assignmentId, {
      translationStatus: "failed",
      translationTargetLanguage: data.targetLanguage,
      translationSourceRevisionId: data.sourceRevisionId,
      translationError: translated.message,
      translationAttempts: attempts,
    });
    throw new Error(translated.message);
  }

  const latestAssignment = await loadCampaignScriptAssignmentById(supabase, assignmentId);
  const latest = latestAssignment
    ? await loadCampaignScriptOverrideView(supabase, latestAssignment)
    : null;
  const second = decideTranslationApply({
    script: latest,
    expectedSourceRevisionId: data.sourceRevisionId,
    targetLanguage: data.targetLanguage,
    forceRegenerate: data.forceRegenerate,
  });
  if (second.action === "discard") {
    await handleAssignmentDiscard(supabase, assignmentId, latest, second.reason, data.forceRegenerate);
    return { outcome: "discarded", reason: second.reason };
  }
  if (!latestAssignment) {
    return { outcome: "discarded", reason: "missing_script" };
  }

  const bodies = buildTranslatedScriptBodies({
    sourceLanguage: second.sourceLanguage,
    targetLanguage: second.targetLanguage,
    sourceBody: second.sourceBody,
    translatedBody: translated.text,
  });

  const saved = await saveCampaignScriptOverride(supabase, latestAssignment, {
    expectedCurrentRevisionId: data.sourceRevisionId,
    sourceLanguage: second.sourceLanguage,
    bodyEn: bodies.bodyEn,
    bodyAr: bodies.bodyAr,
    actorKind: "internal",
    actorUserId: null,
    actorLabel: "Thinkway",
    originalFileName: latest?.originalFileName ?? null,
    changeSummary: data.forceRegenerate ? "Regenerated translation" : "Requested translation",
    bumpBusinessVersion: false,
    originsOverride: translationRevisionOrigins(second.sourceLanguage),
  });

  if (!saved.ok) {
    if (saved.conflict) {
      await handleAssignmentDiscard(supabase, assignmentId, saved.script, "stale_source", data.forceRegenerate);
      return { outcome: "discarded", reason: "stale_source" };
    }
    await updateCampaignScriptAssignmentTranslationState(supabase, assignmentId, {
      translationStatus: "failed",
      translationTargetLanguage: data.targetLanguage,
      translationSourceRevisionId: data.sourceRevisionId,
      translationError: saved.message,
      translationAttempts: attempts,
    });
    throw new Error(saved.message);
  }

  await updateCampaignScriptAssignmentTranslationState(supabase, assignmentId, {
    translationStatus: "generated",
    translationTargetLanguage: data.targetLanguage,
    translationSourceRevisionId: saved.script.currentRevisionId,
    translationError: null,
    translationAttempts: attempts,
  });

  return { outcome: "applied", revisionId: saved.script.currentRevisionId };
}

export function buildTranslatedScriptBodies(input: {
  sourceLanguage: ScriptLanguage;
  targetLanguage: ScriptLanguage;
  sourceBody: string;
  translatedBody: string;
}): { bodyEn: string; bodyAr: string } {
  if (input.targetLanguage === "ar") {
    return { bodyEn: input.sourceBody, bodyAr: input.translatedBody };
  }
  return { bodyEn: input.translatedBody, bodyAr: input.sourceBody };
}

async function handleDiscard(
  supabase: Supabase,
  scriptId: string,
  script: CampaignScriptMasterView | null,
  reason: TranslationApplyDiscardReason,
  forceRegenerate: boolean
): Promise<void> {
  if (reason === "human_edited" && !forceRegenerate) {
    await updateCampaignScriptTranslationState(supabase, scriptId, {
      translationStatus: "idle",
      translationError: null,
    });
    return;
  }
  if (reason === "empty_source" || reason === "missing_script" || reason === "same_language") {
    await updateCampaignScriptTranslationState(supabase, scriptId, {
      translationStatus: "idle",
      translationError: null,
    });
    return;
  }
  if (reason === "stale_source" && script?.translationStatus === "pending") {
    return;
  }
}

async function handleAssignmentDiscard(
  supabase: Supabase,
  assignmentId: string,
  script: CampaignScriptMasterView | null,
  reason: TranslationApplyDiscardReason,
  forceRegenerate: boolean
): Promise<void> {
  if (reason === "human_edited" && !forceRegenerate) {
    await updateCampaignScriptAssignmentTranslationState(supabase, assignmentId, {
      translationStatus: "idle",
      translationError: null,
    });
    return;
  }
  if (reason === "empty_source" || reason === "missing_script" || reason === "same_language") {
    await updateCampaignScriptAssignmentTranslationState(supabase, assignmentId, {
      translationStatus: "idle",
      translationError: null,
    });
    return;
  }
  if (reason === "stale_source" && script?.translationStatus === "pending") {
    return;
  }
}
