import type {
  CampaignScriptMasterView,
  ScriptLanguage,
  ScriptTextOrigin,
  ScriptTranslationStatus,
} from "./types";
import { SCRIPT_TRANSLATION_STATUSES } from "./types";
import { scriptLanguageLabel } from "./policy";

export function oppositeScriptLanguage(language: ScriptLanguage): ScriptLanguage {
  return language === "en" ? "ar" : "en";
}

export function scriptBodyForLanguage(
  language: ScriptLanguage,
  bodyEn: string,
  bodyAr: string
): string {
  return language === "en" ? bodyEn : bodyAr;
}

export function scriptOriginForLanguage(
  language: ScriptLanguage,
  enOrigin: ScriptTextOrigin,
  arOrigin: ScriptTextOrigin
): ScriptTextOrigin {
  return language === "en" ? enOrigin : arOrigin;
}

export function isScriptTranslationStatus(
  value: string | null | undefined
): value is ScriptTranslationStatus {
  return SCRIPT_TRANSLATION_STATUSES.includes(value as ScriptTranslationStatus);
}

export function scriptSourceChanged(
  previous: Pick<CampaignScriptMasterView, "sourceLanguage" | "bodyEn" | "bodyAr"> | null,
  next: Pick<CampaignScriptMasterView, "sourceLanguage" | "bodyEn" | "bodyAr">
): boolean {
  if (!previous) return true;
  if (previous.sourceLanguage !== next.sourceLanguage) return true;
  return (
    scriptBodyForLanguage(previous.sourceLanguage, previous.bodyEn, previous.bodyAr) !==
    scriptBodyForLanguage(next.sourceLanguage, next.bodyEn, next.bodyAr)
  );
}

/** Saving never queues translation. Translation starts only from Translate. */
export function shouldQueueTranslationAfterSave(): { queue: false } {
  return { queue: false };
}

export function translationSourceForTarget(targetLanguage: ScriptLanguage): ScriptLanguage {
  return oppositeScriptLanguage(targetLanguage);
}

export function availableScriptTranslateTargets(
  bodyEn: string,
  bodyAr: string
): ScriptLanguage[] {
  const targets: ScriptLanguage[] = [];
  if (bodyEn.trim()) targets.push("ar");
  if (bodyAr.trim()) targets.push("en");
  return targets;
}

export function emptySourceTranslationMessage(targetLanguage: ScriptLanguage): string {
  const sourceName = scriptLanguageLabel(translationSourceForTarget(targetLanguage));
  const targetName = scriptLanguageLabel(targetLanguage);
  return `Add the ${sourceName} script before translating to ${targetName}.`;
}

export function sameLanguageTranslationMessage(): string {
  return "Choose a different language to translate into.";
}

export type ExplicitTranslationDecision =
  | {
      ok: true;
      sourceLanguage: ScriptLanguage;
      targetLanguage: ScriptLanguage;
      requiresConfirmation: boolean;
    }
  | {
      ok: false;
      code: "empty_source" | "same_language";
      message: string;
    };

export function decideExplicitTranslation(input: {
  bodyEn: string;
  bodyAr: string;
  enOrigin: ScriptTextOrigin;
  arOrigin: ScriptTextOrigin;
  targetLanguage: ScriptLanguage;
  sourceLanguage?: ScriptLanguage;
}): ExplicitTranslationDecision {
  const sourceLanguage =
    input.sourceLanguage ?? translationSourceForTarget(input.targetLanguage);
  if (sourceLanguage === input.targetLanguage) {
    return { ok: false, code: "same_language", message: sameLanguageTranslationMessage() };
  }
  const sourceBody = scriptBodyForLanguage(sourceLanguage, input.bodyEn, input.bodyAr);
  if (!sourceBody.trim()) {
    return {
      ok: false,
      code: "empty_source",
      message: emptySourceTranslationMessage(input.targetLanguage),
    };
  }
  const targetBody = scriptBodyForLanguage(input.targetLanguage, input.bodyEn, input.bodyAr);
  const targetOrigin = scriptOriginForLanguage(input.targetLanguage, input.enOrigin, input.arOrigin);
  return {
    ok: true,
    sourceLanguage,
    targetLanguage: input.targetLanguage,
    requiresConfirmation: targetOrigin === "human_edited" && Boolean(targetBody.trim()),
  };
}

export type TranslationApplyDiscardReason =
  | "missing_script"
  | "empty_source"
  | "stale_source"
  | "human_edited"
  | "same_language";

export type TranslationApplyDecision =
  | {
      action: "apply";
      sourceBody: string;
      sourceLanguage: ScriptLanguage;
      targetLanguage: ScriptLanguage;
    }
  | { action: "discard"; reason: TranslationApplyDiscardReason };

export function decideTranslationApply(input: {
  script: Pick<
    CampaignScriptMasterView,
    | "currentRevisionId"
    | "sourceLanguage"
    | "bodyEn"
    | "bodyAr"
    | "enOrigin"
    | "arOrigin"
  > | null;
  expectedSourceRevisionId: string;
  targetLanguage: ScriptLanguage;
  forceRegenerate: boolean;
}): TranslationApplyDecision {
  if (!input.script) return { action: "discard", reason: "missing_script" };
  if (input.script.currentRevisionId !== input.expectedSourceRevisionId) {
    return { action: "discard", reason: "stale_source" };
  }

  const sourceLanguage = translationSourceForTarget(input.targetLanguage);
  if (sourceLanguage === input.targetLanguage) {
    return { action: "discard", reason: "same_language" };
  }

  const sourceBody = scriptBodyForLanguage(
    sourceLanguage,
    input.script.bodyEn,
    input.script.bodyAr
  );
  if (!sourceBody.trim()) return { action: "discard", reason: "empty_source" };

  const targetOrigin = scriptOriginForLanguage(
    input.targetLanguage,
    input.script.enOrigin,
    input.script.arOrigin
  );
  if (targetOrigin === "human_edited" && !input.forceRegenerate) {
    return { action: "discard", reason: "human_edited" };
  }

  return {
    action: "apply",
    sourceBody,
    sourceLanguage,
    targetLanguage: input.targetLanguage,
  };
}

export function isHumanTranslationStale(
  script: Pick<
    CampaignScriptMasterView,
    | "sourceLanguage"
    | "enOrigin"
    | "arOrigin"
    | "currentRevisionId"
    | "translationSourceRevisionId"
  >
): boolean {
  const targetLanguage = oppositeScriptLanguage(script.sourceLanguage);
  const targetOrigin = scriptOriginForLanguage(targetLanguage, script.enOrigin, script.arOrigin);
  if (targetOrigin !== "human_edited") return false;
  if (!script.translationSourceRevisionId) return false;
  return script.translationSourceRevisionId !== script.currentRevisionId;
}

export function scriptRegenerateConfirmMessage(targetLanguage: ScriptLanguage): string {
  const name = scriptLanguageLabel(targetLanguage);
  return `This will replace the current ${name} translation with a new AI-generated translation. Continue?`;
}

export function translationRevisionOrigins(sourceLanguage: ScriptLanguage): {
  enOrigin: ScriptTextOrigin;
  arOrigin: ScriptTextOrigin;
} {
  if (sourceLanguage === "en") {
    return { enOrigin: "source", arOrigin: "generated" };
  }
  return { enOrigin: "generated", arOrigin: "source" };
}

export function translationStatusBanner(input: {
  sourceLanguage: ScriptLanguage;
  translationStatus: ScriptTranslationStatus;
  translationTargetLanguage: ScriptLanguage | null;
  translationError: string | null;
  staleHumanTranslation: boolean;
}): string | null {
  const targetName = scriptLanguageLabel(
    input.translationTargetLanguage ?? oppositeScriptLanguage(input.sourceLanguage)
  );
  if (input.translationStatus === "pending") {
    return `${targetName} translation pending. It will appear here when generation finishes.`;
  }
  if (input.translationStatus === "failed") {
    const detail = input.translationError?.trim();
    return detail
      ? `${targetName} translation failed. ${detail}`
      : `${targetName} translation failed. Retry to generate it again.`;
  }
  if (input.staleHumanTranslation) {
    return `The ${targetName} translation was edited by a person and may be out of sync with the original. Translate only if you want to replace it.`;
  }
  return null;
}

export function scriptRetryTargetLanguage(
  script: Pick<
    CampaignScriptMasterView,
    "bodyEn" | "bodyAr" | "translationStatus" | "translationTargetLanguage"
  >
): ScriptLanguage | null {
  if (script.translationStatus !== "failed") return null;
  if (script.translationTargetLanguage) return script.translationTargetLanguage;
  return availableScriptTranslateTargets(script.bodyEn, script.bodyAr)[0] ?? null;
}
