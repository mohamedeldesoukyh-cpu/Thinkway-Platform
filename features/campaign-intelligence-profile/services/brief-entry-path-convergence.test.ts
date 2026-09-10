/**
 * Brief entry paths must converge on one canonical Campaign Intelligence result.
 *
 * Three ways a brief enters the platform:
 *
 *   1. Copilot typed brief   → create-campaign workflow → ensureWorkflowCampaignIntelligenceProfile
 *   2. Copilot attached file  → Studio Intake dropzone → uploadCampaignBriefAction
 *   3. Studio Intake upload   → uploadCampaignBriefAction
 *
 * All three run `runCampaignIntelligencePipeline`; none of them may fork a
 * second extraction, a second profile for the same campaign, or a second Intake
 * state. What broke was not the pipeline but the routing around it:
 *
 * - A first upload into an open campaign resolved as a LIBRARY create, so the
 *   action answered `brand_selection` and persisted nothing. The file uploaded,
 *   the analysis was thrown away, and Intake stayed empty.
 * - Copilot's paperclip pushed /studio?start=upload unconditionally, leaving the
 *   campaign and opening the New Campaign dialog — a second conversation and a
 *   second profile for a brief that belonged to the campaign on screen.
 *
 * These tests pin the routing decisions and the shared pipeline result. The
 * Supabase writes around them are not exercised here.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { buildKerastaseEgyptDocx } from "../fixtures/build-kerastase-docx";
import {
  linkRequiresBrandSelection,
  resolveBriefUploadProfileTarget,
} from "./brief-upload-profile-target";
import { hasValidatedIntelligence } from "./get-validated-intelligence";
import { nextStepForCampaignBriefUpload } from "./next-step-for-brief-upload";
import { profileToCampaignFacts } from "./profile-to-facts";
import { runCampaignIntelligencePipeline } from "./run-intelligence-pipeline";
import { parseStructuredBriefDocument } from "./structured-brief-parser";
import type { CampaignIntelligenceProfile } from "../types/profile";

const CONVERSATION = "conv-kerastase-1";

/** What each entry path hands to the pipeline, exactly as the action does. */
let cachedBrief:
  | Promise<{
      llmText: string;
      plainText: string;
      document: Awaited<ReturnType<typeof parseStructuredBriefDocument>>["document"];
    }>
  | undefined;
function kerastaseBriefText() {
  cachedBrief ??= (async () => {
    const parsed = await parseStructuredBriefDocument(
      await buildKerastaseEgyptDocx(),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "kerastase-egypt-brief.docx"
    );
    return { llmText: parsed.llmText, plainText: parsed.plainText, document: parsed.document };
  })();
  return cachedBrief;
}

function factsOf(profile: CampaignIntelligenceProfile) {
  const facts = profileToCampaignFacts(profile);
  return {
    brandName: facts.brandName,
    industry: facts.industry,
    objective: facts.objective,
    audience: facts.audience,
    budget: facts.budget,
    durationWeeks: facts.durationWeeks,
    geography: facts.geography,
    platforms: facts.platforms,
    deliverables: facts.deliverables,
    kpis: facts.kpis,
  };
}

// ---------------------------------------------------------------------------
// A · Studio direct upload — analysis must start and persist, not stall on a
// brand picker.

test("A — a first Studio upload persists instead of stalling on brand selection", () => {
  const target = resolveBriefUploadProfileTarget({
    conversationId: CONVERSATION,
    existingProfileId: null,
  });

  assert.equal(target.ownsConversation, true);
  assert.equal(
    linkRequiresBrandSelection({ brandId: null, allowMissingBrand: target.allowMissingBrand }),
    false,
    "a campaign with no CRM brand must still receive its first brief"
  );

  // The action's answer for an owned conversation is a completed workspace, so
  // Intake applies it directly. `select_brand` here is what left Intake empty.
  const step = nextStepForCampaignBriefUpload({
    ok: true,
    phase: "complete",
    workspace: { profileId: "profile-1" },
  } as never);
  assert.equal(step.kind, "apply_workspace");
});

// ---------------------------------------------------------------------------
// B + D + E · Intake reads the persisted result; the workflow does not re-extract.

test("B/E — a persisted Studio profile satisfies the workflow's reuse guard", async () => {
  const { llmText } = await kerastaseBriefText();
  const { profile } = await runCampaignIntelligencePipeline({
    briefText: llmText,
    briefTextSource: "upload",
  });

  // ensureWorkflowCampaignIntelligenceProfile returns the existing row when
  // this is true, so navigating Copilot → Studio runs no second extraction.
  assert.equal(
    hasValidatedIntelligence(profile),
    true,
    "without validated intelligence the workflow would re-extract the same brief"
  );
});

test("D — an in-flight upload is never answered as a brand decision", () => {
  // Navigating away mid-analysis must not turn the pending result into a
  // brand-picker branch that discards it.
  for (const existingProfileId of [null, "profile-existing"]) {
    const target = resolveBriefUploadProfileTarget({
      conversationId: CONVERSATION,
      existingProfileId,
    });
    assert.equal(target.ownsConversation, true);
    assert.equal(target.allowMissingBrand, true);
  }
});

// ---------------------------------------------------------------------------
// C + G · Copilot-attached brief lands on the campaign on screen.

test("C/G — an upload into an open campaign reuses that campaign's profile", () => {
  const target = resolveBriefUploadProfileTarget({
    conversationId: CONVERSATION,
    existingProfileId: "profile-7a9b1208",
  });

  assert.equal(target.mode, "link");
  assert.equal(
    target.linkProfileId,
    "profile-7a9b1208",
    "a replacement updates the campaign's row — it must not orphan it"
  );
  assert.equal(target.ownsConversation, true);
});

test("C — a library upload with no campaign keeps the brand detour", () => {
  const target = resolveBriefUploadProfileTarget({ conversationId: null });

  assert.equal(target.ownsConversation, false);
  assert.equal(target.allowMissingBrand, false);
  assert.equal(linkRequiresBrandSelection({ brandId: null }), true);
});

// ---------------------------------------------------------------------------
// F · Replacement is a fresh analysis of the SAME campaign, not a new profile.

test("F — replacing a brief re-analyzes in place and yields the same canonical facts", async () => {
  const { llmText, plainText } = await kerastaseBriefText();

  // Upload uses the structured llmText; the workflow arm may fall back to the
  // flattened plain text. Both must land on the same canonical facts, or the
  // three paths would disagree on the same document.
  const { document } = await kerastaseBriefText();
  const [first, second] = await Promise.all([
    runCampaignIntelligencePipeline({
      briefText: llmText,
      briefTextSource: "upload",
      structuredParserOutput: document,
    }),
    runCampaignIntelligencePipeline({
      briefText: llmText,
      briefTextSource: "upload",
      structuredParserOutput: document,
    }),
  ]);

  assert.deepEqual(
    factsOf(first.profile),
    factsOf(second.profile),
    "the same brief must extract identically — re-analysis is not a coin flip"
  );

  const fromPlain = await runCampaignIntelligencePipeline({
    briefText: plainText,
    briefTextSource: "upload",
  });
  const structured = factsOf(first.profile);
  const flattened = factsOf(fromPlain.profile);
  for (const key of ["brandName", "industry", "budget", "durationWeeks", "geography"] as const) {
    assert.deepEqual(
      flattened[key],
      structured[key],
      `${key} must not depend on which brief text an entry path supplies`
    );
  }
});

// ---------------------------------------------------------------------------
// One pipeline, one canonical result.

test("every entry path produces the same canonical Campaign Facts", async () => {
  const { llmText, document } = await kerastaseBriefText();

  // Studio Intake upload, the Copilot attachment (which now routes to that same
  // dropzone) and the New Campaign dialog all call the identical action, so the
  // only inputs are the brief text and the structured document it parsed.
  const { profile } = await runCampaignIntelligencePipeline({
    briefText: llmText,
    briefTextSource: "upload",
    structuredParserOutput: document,
  });
  const facts = factsOf(profile);

  assert.equal(facts.brandName, "Kérastase");
  assert.equal(facts.industry, "Beauty & Personal Care");
  assert.deepEqual(facts.budget, { amount: 3_000_000, currency: "EGP" });
  assert.equal(facts.durationWeeks, 4);
  assert.match(facts.audience ?? "", /Women aged 20[–-]40 in Egypt/i);
  assert.ok((facts.deliverables ?? []).length > 0);
  assert.ok((facts.kpis ?? []).length > 0);
});
