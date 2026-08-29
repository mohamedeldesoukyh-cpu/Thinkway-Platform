import assert from "node:assert/strict";
import { test } from "node:test";

import { buildTranslatedScriptBodies } from "./apply-translation";
import { businessVersionForSave, scriptOriginBadge } from "./policy";
import {
  buildScriptTranslationSystemPrompt,
  buildScriptTranslationUserPrompt,
  splitScriptTranslationChunks,
  translateCampaignScriptText,
} from "./translate-script";
import { campaignScriptTranslateJobId } from "./translation-job";
import {
  availableScriptTranslateTargets,
  decideExplicitTranslation,
  decideTranslationApply,
  isHumanTranslationStale,
  oppositeScriptLanguage,
  scriptRegenerateConfirmMessage,
  scriptRetryTargetLanguage,
  scriptSourceChanged,
  shouldQueueTranslationAfterSave,
  translationRevisionOrigins,
  translationStatusBanner,
} from "./translation-policy";
import type { CampaignScriptMasterView, ScriptLanguage, ScriptOrigin, ScriptTextOrigin } from "./types";
import type { LlmProvider } from "@/features/ai/types/llm";

function view(overrides: Partial<CampaignScriptMasterView> = {}): CampaignScriptMasterView {
  return {
    scriptId: "script-1",
    campaignHeaderId: "campaign-1",
    currentRevisionId: "rev-1",
    revisionNumber: 1,
    businessVersion: "v1",
    sourceLanguage: "en",
    bodyEn: "Film one 15-second Reel. Mention @brand and use #SummerLaunch.",
    bodyAr: "",
    enOrigin: "source",
    arOrigin: "generated",
    actorKind: "internal",
    actorLabel: "Mona",
    createdAt: "2026-08-28T18:00:00.000Z",
    origin: "internal",
    originalFileName: null,
    originalStorageBucket: null,
    originalStoragePath: null,
    originalMimeType: null,
    originalFileSize: null,
    assignmentDeliverableId: null,
    assignmentPostScheduleId: null,
    translationStatus: "idle",
    translationTargetLanguage: null,
    translationSourceRevisionId: null,
    translationError: null,
    translationAttempts: 0,
    translationUpdatedAt: null,
    ...overrides,
  };
}

type MemoryJobResult =
  | { outcome: "applied"; script: CampaignScriptMasterView }
  | { outcome: "discarded"; reason: string; script: CampaignScriptMasterView }
  | { outcome: "failed"; message: string; script: CampaignScriptMasterView };

async function runMemoryTranslationJob(input: {
  script: CampaignScriptMasterView;
  sourceRevisionId: string;
  targetLanguage: ScriptLanguage;
  forceRegenerate?: boolean;
  translate: () => Promise<{ ok: true; text: string } | { ok: false; message: string }>;
  mutateBeforeWrite?: (script: CampaignScriptMasterView) => CampaignScriptMasterView;
}): Promise<MemoryJobResult> {
  let current = input.script;
  const payload = {
    expectedSourceRevisionId: input.sourceRevisionId,
    targetLanguage: input.targetLanguage,
    forceRegenerate: Boolean(input.forceRegenerate),
  };

  const first = decideTranslationApply({ script: current, ...payload });
  if (first.action === "discard") {
    return { outcome: "discarded", reason: first.reason, script: current };
  }

  const translated = await input.translate();
  if (!translated.ok) {
    return {
      outcome: "failed",
      message: translated.message,
      script: {
        ...current,
        translationStatus: "failed",
        translationError: translated.message,
        translationTargetLanguage: input.targetLanguage,
      },
    };
  }

  if (input.mutateBeforeWrite) current = input.mutateBeforeWrite(current);

  const second = decideTranslationApply({ script: current, ...payload });
  if (second.action === "discard") {
    return { outcome: "discarded", reason: second.reason, script: current };
  }

  const bodies = buildTranslatedScriptBodies({
    sourceLanguage: second.sourceLanguage,
    targetLanguage: second.targetLanguage,
    sourceBody: second.sourceBody,
    translatedBody: translated.text,
  });
  const origins = translationRevisionOrigins(second.sourceLanguage);
  const applied: CampaignScriptMasterView = {
    ...current,
    currentRevisionId: "rev-translated",
    revisionNumber: current.revisionNumber + 1,
    businessVersion: businessVersionForSave(current.businessVersion, false),
    sourceLanguage: second.sourceLanguage,
    bodyEn: bodies.bodyEn,
    bodyAr: bodies.bodyAr,
    enOrigin: origins.enOrigin,
    arOrigin: origins.arOrigin,
    actorKind: "internal",
    actorLabel: "Thinkway",
    translationStatus: "generated",
    translationTargetLanguage: second.targetLanguage,
    translationSourceRevisionId: "rev-translated",
    translationError: null,
  };
  return { outcome: "applied", script: applied };
}

test("1. Save English → no automatic Arabic translation", () => {
  assert.deepEqual(shouldQueueTranslationAfterSave(), { queue: false });
  assert.deepEqual(availableScriptTranslateTargets("English script", ""), ["ar"]);
});

test("2. Save Arabic → no automatic English translation", () => {
  assert.deepEqual(shouldQueueTranslationAfterSave(), { queue: false });
  assert.deepEqual(availableScriptTranslateTargets("", "النص العربي"), ["en"]);
});

test("3. Click Translate → Arabic → translation queued", () => {
  const decision = decideExplicitTranslation({
    bodyEn: "English script",
    bodyAr: "",
    enOrigin: "source",
    arOrigin: "generated",
    targetLanguage: "ar",
  });
  assert.equal(decision.ok, true);
  if (!decision.ok) return;
  assert.equal(decision.sourceLanguage, "en");
  assert.equal(decision.targetLanguage, "ar");
  assert.equal(decision.requiresConfirmation, false);
});

test("4. Click Translate → English → translation queued", () => {
  const decision = decideExplicitTranslation({
    bodyEn: "",
    bodyAr: "النص العربي",
    enOrigin: "generated",
    arOrigin: "source",
    targetLanguage: "en",
  });
  assert.equal(decision.ok, true);
  if (!decision.ok) return;
  assert.equal(decision.sourceLanguage, "ar");
  assert.equal(decision.targetLanguage, "en");
});

test("5. Empty target → translation allowed", async () => {
  const result = await runMemoryTranslationJob({
    script: view(),
    sourceRevisionId: "rev-1",
    targetLanguage: "ar",
    translate: async () => ({ ok: true, text: "صوّر ريل لمدة 15 ثانية." }),
  });
  assert.equal(result.outcome, "applied");
  if (result.outcome !== "applied") return;
  assert.equal(result.script.bodyEn, view().bodyEn);
  assert.equal(result.script.bodyAr, "صوّر ريل لمدة 15 ثانية.");
  assert.equal(result.script.arOrigin, "generated");
});

test("6. Generated target → explicit regeneration allowed", () => {
  const decision = decideExplicitTranslation({
    bodyEn: "English v1.1",
    bodyAr: "Arabic generated v1",
    enOrigin: "source",
    arOrigin: "generated",
    targetLanguage: "ar",
  });
  assert.equal(decision.ok, true);
  if (!decision.ok) return;
  assert.equal(decision.requiresConfirmation, false);
});

test("7. Human-edited target → confirmation required", () => {
  const decision = decideExplicitTranslation({
    bodyEn: "English",
    bodyAr: "Human Arabic",
    enOrigin: "source",
    arOrigin: "human_edited",
    targetLanguage: "ar",
  });
  assert.equal(decision.ok, true);
  if (!decision.ok) return;
  assert.equal(decision.requiresConfirmation, true);
  assert.equal(
    scriptRegenerateConfirmMessage("ar"),
    "This will replace the current Arabic translation with a new AI-generated translation. Continue?"
  );
});

test("8. Cancel human-edited replacement → nothing changes", () => {
  const script = view({
    bodyAr: "Human Arabic",
    arOrigin: "human_edited",
  });
  const decision = decideExplicitTranslation({
    bodyEn: script.bodyEn,
    bodyAr: script.bodyAr,
    enOrigin: script.enOrigin,
    arOrigin: script.arOrigin,
    targetLanguage: "ar",
  });
  assert.equal(decision.ok, true);
  if (!decision.ok) return;
  assert.equal(decision.requiresConfirmation, true);
  const apply = decideTranslationApply({
    script,
    expectedSourceRevisionId: "rev-1",
    targetLanguage: "ar",
    forceRegenerate: false,
  });
  assert.deepEqual(apply, { action: "discard", reason: "human_edited" });
  assert.equal(script.bodyAr, "Human Arabic");
  assert.equal(script.arOrigin, "human_edited");
});

test("9. Confirm human-edited replacement → translation proceeds", async () => {
  const result = await runMemoryTranslationJob({
    script: view({
      bodyAr: "Human Arabic",
      arOrigin: "human_edited",
    }),
    sourceRevisionId: "rev-1",
    targetLanguage: "ar",
    forceRegenerate: true,
    translate: async () => ({ ok: true, text: "ترجمة آلية" }),
  });
  assert.equal(result.outcome, "applied");
  if (result.outcome !== "applied") return;
  assert.equal(result.script.bodyAr, "ترجمة آلية");
  assert.equal(result.script.arOrigin, "generated");
});

test("10. Both languages populated → user must select target explicitly", () => {
  assert.deepEqual(
    availableScriptTranslateTargets("English script", "النص العربي"),
    ["ar", "en"]
  );
  const toArabic = decideExplicitTranslation({
    bodyEn: "English script",
    bodyAr: "النص العربي",
    enOrigin: "source",
    arOrigin: "generated",
    targetLanguage: "ar",
  });
  const toEnglish = decideExplicitTranslation({
    bodyEn: "English script",
    bodyAr: "النص العربي",
    enOrigin: "source",
    arOrigin: "human_edited",
    targetLanguage: "en",
  });
  assert.equal(toArabic.ok && toArabic.targetLanguage === "ar", true);
  assert.equal(toEnglish.ok && toEnglish.targetLanguage === "en", true);
});

test("11. Invalid source → translation prevented", () => {
  const decision = decideExplicitTranslation({
    bodyEn: "   ",
    bodyAr: "",
    enOrigin: "source",
    arOrigin: "generated",
    targetLanguage: "ar",
  });
  assert.equal(decision.ok, false);
  if (decision.ok) return;
  assert.equal(decision.code, "empty_source");
});

test("12. Same-language translation → prevented", () => {
  const decision = decideExplicitTranslation({
    bodyEn: "English script",
    bodyAr: "النص العربي",
    enOrigin: "source",
    arOrigin: "source",
    targetLanguage: "en",
    sourceLanguage: "en",
  });
  assert.equal(decision.ok, false);
  if (decision.ok) return;
  assert.equal(decision.code, "same_language");
});

test("13. Failed translation → Retry remains explicit", () => {
  const failed = view({
    translationStatus: "failed",
    translationError: "OpenAI unavailable",
    translationTargetLanguage: "ar",
  });
  assert.deepEqual(shouldQueueTranslationAfterSave(), { queue: false });
  assert.equal(scriptRetryTargetLanguage(failed), "ar");
  const idle = view({ translationStatus: "idle" });
  assert.equal(scriptRetryTargetLanguage(idle), null);
});

test("14. Stale translation job cannot overwrite newer source", async () => {
  const result = await runMemoryTranslationJob({
    script: view(),
    sourceRevisionId: "rev-1",
    targetLanguage: "ar",
    translate: async () => ({ ok: true, text: "ترجمة قديمة" }),
    mutateBeforeWrite: (script) =>
      view({
        ...script,
        currentRevisionId: "rev-1.1",
        bodyEn: "English v1.1",
        revisionNumber: 2,
        businessVersion: "v1.1",
      }),
  });
  assert.equal(result.outcome, "discarded");
  if (result.outcome !== "discarded") return;
  assert.equal(result.reason, "stale_source");
  assert.equal(result.script.bodyEn, "English v1.1");
  assert.equal(result.script.bodyAr, "");
});

test("15. Human edit during translation wins", async () => {
  const result = await runMemoryTranslationJob({
    script: view(),
    sourceRevisionId: "rev-1",
    targetLanguage: "ar",
    translate: async () => ({ ok: true, text: "ترجمة آلية" }),
    mutateBeforeWrite: (script) =>
      view({
        ...script,
        currentRevisionId: "rev-human",
        bodyAr: "ترجمة بشرية",
        arOrigin: "human_edited",
        translationStatus: "idle",
      }),
  });
  assert.equal(result.outcome, "discarded");
  if (result.outcome !== "discarded") return;
  assert.ok(result.reason === "stale_source" || result.reason === "human_edited");
  assert.equal(result.script.bodyAr, "ترجمة بشرية");
  assert.equal(result.script.arOrigin, "human_edited");
});

test("16. Duplicate translation jobs remain idempotent", async () => {
  const first = await runMemoryTranslationJob({
    script: view(),
    sourceRevisionId: "rev-1",
    targetLanguage: "ar",
    translate: async () => ({ ok: true, text: "الترجمة" }),
  });
  assert.equal(first.outcome, "applied");
  if (first.outcome !== "applied") return;

  const duplicate = await runMemoryTranslationJob({
    script: first.script,
    sourceRevisionId: "rev-1",
    targetLanguage: "ar",
    translate: async () => ({ ok: true, text: "ترجمة ثانية متعارضة" }),
  });
  assert.equal(duplicate.outcome, "discarded");
  if (duplicate.outcome !== "discarded") return;
  assert.equal(duplicate.reason, "stale_source");
  assert.equal(duplicate.script.bodyAr, "الترجمة");
  assert.equal(
    campaignScriptTranslateJobId("script-1", "rev-1", "ar"),
    campaignScriptTranslateJobId("script-1", "rev-1", "ar")
  );
});

test("17. Internal translation updates shared SSOT", async () => {
  const result = await runMemoryTranslationJob({
    script: view({ origin: "internal" }),
    sourceRevisionId: "rev-1",
    targetLanguage: "ar",
    translate: async () => ({ ok: true, text: "النص العربي" }),
  });
  assert.equal(result.outcome, "applied");
  if (result.outcome !== "applied") return;
  assert.equal(result.script.origin, "internal");
  assert.equal(result.script.bodyAr, "النص العربي");
  assert.equal(result.script.translationStatus, "generated");
});

test("18. Client translation updates shared SSOT", async () => {
  const result = await runMemoryTranslationJob({
    script: view({ origin: "client", actorKind: "client", actorLabel: "Acme" }),
    sourceRevisionId: "rev-1",
    targetLanguage: "ar",
    translate: async () => ({ ok: true, text: "النص العربي" }),
  });
  assert.equal(result.outcome, "applied");
  if (result.outcome !== "applied") return;
  assert.equal(result.script.origin, "client");
  assert.equal(result.script.bodyAr, "النص العربي");
});

test("Arabic source produces English generated bodies without touching source text", async () => {
  const arabic = view({
    sourceLanguage: "ar",
    bodyEn: "",
    bodyAr: "اذكر @brand واستخدم #SummerLaunch",
    enOrigin: "generated",
    arOrigin: "source",
  });
  const result = await runMemoryTranslationJob({
    script: arabic,
    sourceRevisionId: "rev-1",
    targetLanguage: "en",
    translate: async () => ({ ok: true, text: "Mention @brand and use #SummerLaunch" }),
  });
  assert.equal(result.outcome, "applied");
  if (result.outcome !== "applied") return;
  assert.equal(result.script.bodyAr, arabic.bodyAr);
  assert.equal(result.script.bodyEn, "Mention @brand and use #SummerLaunch");
  assert.deepEqual(translationRevisionOrigins("ar"), { enOrigin: "generated", arOrigin: "source" });
});

test("translation-only revisions keep the business version", () => {
  assert.equal(businessVersionForSave("v1", false), "v1");
  assert.equal(businessVersionForSave("v1.2", false), "v1.2");
  assert.equal(businessVersionForSave("v1", true), "v1.1");
});

test("human-edited translation is stale after the source revision changes", () => {
  const stale = view({
    currentRevisionId: "rev-2",
    bodyEn: "English v1.1",
    bodyAr: "Human Arabic",
    arOrigin: "human_edited",
    translationStatus: "idle",
    translationSourceRevisionId: "rev-1",
  });
  assert.equal(isHumanTranslationStale(stale), true);
  assert.match(
    translationStatusBanner({
      sourceLanguage: "en",
      translationStatus: "idle",
      translationTargetLanguage: "ar",
      translationError: null,
      staleHumanTranslation: true,
    }) ?? "",
    /out of sync/
  );
});

test("pending badge hides a leftover generated body while a job is running", () => {
  assert.equal(
    scriptOriginBadge({
      language: "ar",
      sourceLanguage: "en",
      origin: "generated",
      body: "Old Arabic",
      translationStatus: "pending",
    }),
    "Translation (Arabic) · pending"
  );
});

test("job failure leaves the source script unchanged", async () => {
  const source = view();
  const result = await runMemoryTranslationJob({
    script: source,
    sourceRevisionId: "rev-1",
    targetLanguage: "ar",
    translate: async () => ({ ok: false, message: "OpenAI unavailable" }),
  });
  assert.equal(result.outcome, "failed");
  if (result.outcome !== "failed") return;
  assert.equal(result.script.bodyEn, source.bodyEn);
  assert.equal(result.script.bodyAr, "");
  assert.equal(result.script.currentRevisionId, "rev-1");
  assert.equal(result.script.translationStatus, "failed");
});

test("sourceChanged detects original-language edits only", () => {
  const previous = view();
  assert.equal(scriptSourceChanged(null, previous), true);
  assert.equal(
    scriptSourceChanged(previous, view({ bodyAr: "Human Arabic", arOrigin: "human_edited" })),
    false
  );
  assert.equal(scriptSourceChanged(previous, view({ bodyEn: "English v1.1" })), true);
  assert.equal(oppositeScriptLanguage("en"), "ar");
});

test("translation prompt preserves structure and forbids invented claims", () => {
  const system = buildScriptTranslationSystemPrompt();
  assert.match(system, /Do not invent claims/);
  assert.match(system, /hashtags/);
  const user = buildScriptTranslationUserPrompt({
    sourceLanguage: "en",
    targetLanguage: "ar",
    sourceText: "Mention @brand",
  });
  assert.match(user, /English to Arabic/);
});

test("long scripts split into paragraph chunks", () => {
  const paragraph = "Line\n\n".repeat(20) + "End";
  const chunks = splitScriptTranslationChunks(paragraph, 40);
  assert.ok(chunks.length > 1);
});

test("stub provider is treated as a failed translation, not saved text", async () => {
  const stubProvider: LlmProvider = {
    identity: { id: "openai", name: "OpenAI" },
    async complete() {
      return {
        content: "[OpenAI stub] not a translation",
        model: "gpt-4o-mini",
        providerId: "openai",
        stub: true,
      };
    },
  };
  const result = await translateCampaignScriptText({
    sourceLanguage: "en",
    targetLanguage: "ar",
    sourceText: "Hello",
    provider: stubProvider,
  });
  assert.equal(result.ok, false);
});

test("client and internal origins remain a workspace concern, not a second script copy", () => {
  const origins: ScriptOrigin[] = ["client", "internal"];
  const textOrigins: ScriptTextOrigin[] = ["source", "generated", "human_edited"];
  assert.deepEqual(origins, ["client", "internal"]);
  assert.deepEqual(textOrigins, ["source", "generated", "human_edited"]);
});
