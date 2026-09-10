/**
 * `create-campaign` must not extract the same brief twice.
 *
 * The workflow calls `ensureWorkflowCampaignIntelligenceProfile` twice — at
 * bootstrap (`workflow-engine.ts:281`) and again before `search-creators`
 * (`:481`) — because a brief too short to profile at bootstrap may become
 * profilable later.
 *
 * The second call short-circuits when the conversation's profile clears
 * `hasValidatedIntelligence`. When it does NOT clear it — a brief that names an
 * objective but no market, platform or category still persists a row — the
 * second call re-extracted the identical `request.message`: a second LLM
 * round-trip that, extraction being deterministic, can only produce the same
 * unvalidated profile, then persisted it as a duplicate row for the same
 * conversation.
 *
 * The reuse guard is `profileAlreadyExtractedFromBrief`. These tests pin the
 * guard, and prove the skipped work was genuinely redundant by showing the
 * repeated extraction returns byte-identical intelligence.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { buildKerastaseEgyptDocx } from "../fixtures/build-kerastase-docx";
import { hasValidatedIntelligence } from "./get-validated-intelligence";
import { profileToCampaignFacts } from "./profile-to-facts";
import {
  RAW_BRIEF_EXCERPT_CHARS,
  profileAlreadyExtractedFromBrief,
} from "./resolve-brief-text";
import { runCampaignIntelligencePipeline } from "./run-intelligence-pipeline";
import { parseStructuredBriefDocument } from "./structured-brief-parser";

/** A brief that persists a profile but does not clear the validated gate. */
const UNVALIDATED_BRIEF =
  "We would like to run an influencer activation that lifts product consideration and trial for the new range this quarter.";

/** What both writers store as the profile's excerpt. */
function excerptFor(briefText: string): string {
  return briefText.trim().slice(0, RAW_BRIEF_EXCERPT_CHARS).trim();
}

// ---------------------------------------------------------------------------
// The guard.

test("a profile built from this exact brief is recognised as already extracted", () => {
  assert.equal(
    profileAlreadyExtractedFromBrief({
      rawBriefExcerpt: excerptFor(UNVALIDATED_BRIEF),
      briefText: UNVALIDATED_BRIEF,
    }),
    true
  );
  // Surrounding whitespace is not a different brief.
  assert.equal(
    profileAlreadyExtractedFromBrief({
      rawBriefExcerpt: excerptFor(UNVALIDATED_BRIEF),
      briefText: `\n  ${UNVALIDATED_BRIEF}  \n`,
    }),
    true
  );
});

test("a changed brief is still extracted — the guard never blocks new work", () => {
  assert.equal(
    profileAlreadyExtractedFromBrief({
      rawBriefExcerpt: excerptFor(UNVALIDATED_BRIEF),
      briefText: `${UNVALIDATED_BRIEF} Market: Egypt. Platforms: Instagram.`,
    }),
    false,
    "a replaced or extended brief must re-extract"
  );
  // No excerpt stored, or no text to compare: extract.
  for (const rawBriefExcerpt of [null, undefined, "", "   "] as const) {
    assert.equal(
      profileAlreadyExtractedFromBrief({ rawBriefExcerpt, briefText: UNVALIDATED_BRIEF }),
      false
    );
  }
  assert.equal(
    profileAlreadyExtractedFromBrief({
      rawBriefExcerpt: excerptFor(UNVALIDATED_BRIEF),
      briefText: "   ",
    }),
    false
  );
});

test("the guard compares on the excerpt length both writers actually persist", () => {
  // A brief longer than the excerpt matches on its first RAW_BRIEF_EXCERPT_CHARS,
  // which is all either writer stored — so the comparison is exact, not partial.
  const long = `${"A very long brief. ".repeat(60)}END`;
  assert.ok(long.length > RAW_BRIEF_EXCERPT_CHARS);
  assert.equal(
    profileAlreadyExtractedFromBrief({ rawBriefExcerpt: excerptFor(long), briefText: long }),
    true
  );
  // Two briefs that differ only after the excerpt window are indistinguishable
  // from the stored excerpt. Recorded deliberately: the row is reused, and the
  // reuse is only ever reached for a profile of THIS conversation.
  assert.equal(
    profileAlreadyExtractedFromBrief({
      rawBriefExcerpt: excerptFor(long),
      briefText: `${long} plus a different tail`,
    }),
    true
  );
});

// ---------------------------------------------------------------------------
// The skipped work was redundant.

test("the duplicate case is real: this brief persists but stays unvalidated", async () => {
  const { profile } = await runCampaignIntelligencePipeline({
    briefText: UNVALIDATED_BRIEF,
    briefTextSource: "chat",
  });

  assert.equal(
    hasValidatedIntelligence(profile),
    false,
    "guard: if this cleared the gate the second ensure call would short-circuit and there would be nothing to fix"
  );
  assert.ok(
    profile.objective?.trim(),
    "guard: it is still persistable, which is why a row exists for the second call to find"
  );
});

test("re-extracting the same brief yields identical intelligence — so skipping loses nothing", async () => {
  const [first, second] = await Promise.all([
    runCampaignIntelligencePipeline({ briefText: UNVALIDATED_BRIEF, briefTextSource: "chat" }),
    runCampaignIntelligencePipeline({ briefText: UNVALIDATED_BRIEF, briefTextSource: "chat" }),
  ]);

  const factsOf = (p: typeof first.profile) => {
    const facts = profileToCampaignFacts(p);
    return { ...facts, extractedAt: undefined };
  };

  assert.deepEqual(factsOf(first.profile), factsOf(second.profile));
  assert.equal(
    hasValidatedIntelligence(second.profile),
    hasValidatedIntelligence(first.profile),
    "a repeat extraction cannot promote an unvalidated profile to validated"
  );
});

// ---------------------------------------------------------------------------
// Kérastase — the requested case — takes the pre-existing short-circuit.

test("Kérastase clears the validated gate, so it never reached the duplicate path", async () => {
  const parsed = await parseStructuredBriefDocument(
    await buildKerastaseEgyptDocx(),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "kerastase-egypt-brief.docx"
  );
  const { profile } = await runCampaignIntelligencePipeline({
    briefText: parsed.llmText,
    briefTextSource: "upload",
    structuredParserOutput: parsed.document,
  });

  assert.equal(
    hasValidatedIntelligence(profile),
    true,
    "Kérastase short-circuits on the existing gate — this fix changes nothing for it"
  );

  // And the guard would also hold for it, so the reuse is consistent either way.
  assert.equal(
    profileAlreadyExtractedFromBrief({
      rawBriefExcerpt: excerptFor(parsed.llmText),
      briefText: parsed.llmText,
    }),
    true
  );
});
