/**
 * The workflow intelligence arm must extract like the direct upload arm.
 *
 * `uploadCampaignBriefAction` passes `structuredParserOutput` into
 * `runCampaignIntelligencePipeline`; `ensureWorkflowCampaignIntelligenceProfile`
 * did not. Deliverables, KPIs, the key message and the CTA are read from a
 * document's own heading + list sections (`applyStructuredBriefFields`), so the
 * workflow arm silently lost all four for a brief stated that way, while the
 * upload arm kept them — the two entry paths disagreed on the same document.
 *
 * The workflow arm now carries the stored document alongside the brief text it
 * chose. Two things have to hold, and both are tested here:
 *
 *   1. Given the same document, both arms produce the same canonical facts.
 *   2. A typed brief, which has no document, still extracts and gains nothing
 *      the brief did not state.
 *
 * The Supabase reads and the elevated writes around this are not exercised:
 * the pairing decision is tested directly, the extraction outcome through the
 * real pipeline.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { buildKerastaseEgyptDocx } from "../fixtures/build-kerastase-docx";
import { resolveStructuredDocumentForBriefText } from "./resolve-brief-text";
import { profileToCampaignFacts } from "./profile-to-facts";
import { runCampaignIntelligencePipeline } from "./run-intelligence-pipeline";
import { parseStructuredBriefDocument } from "./structured-brief-parser";
import type { StructuredBriefDocument } from "./structured-brief-parser/types";
import type { CampaignIntelligenceProfile } from "../types/profile";

let cached:
  | Promise<{ llmText: string; plainText: string; document: StructuredBriefDocument }>
  | undefined;

function kerastase() {
  cached ??= (async () => {
    const parsed = await parseStructuredBriefDocument(
      await buildKerastaseEgyptDocx(),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "kerastase-egypt-brief.docx"
    );
    return { llmText: parsed.llmText, plainText: parsed.plainText, document: parsed.document };
  })();
  return cached;
}

/** The seven fields this parity is about, plus the rest of the canonical set. */
function canonical(profile: CampaignIntelligenceProfile) {
  const facts = profileToCampaignFacts(profile);
  return {
    audience: facts.audience,
    industry: facts.industry,
    deliverables: facts.deliverables,
    kpis: facts.kpis,
    keyMessage: facts.keyMessage,
    callToAction: facts.callToAction,
    budget: facts.budget,
    brandName: facts.brandName,
    objective: facts.objective,
    durationWeeks: facts.durationWeeks,
    geography: facts.geography,
    platforms: facts.platforms,
  };
}

// ---------------------------------------------------------------------------
// The pairing decision.

test("a document-backed text source pairs with the document that produced it", async () => {
  const { document } = await kerastase();
  const other: StructuredBriefDocument = {
    sections: [{ title: "Someone else's brief", blocks: [] }],
  };

  // llm_brief_text and parsed_text are columns of the SAME stored row.
  for (const source of ["llm_brief_text", "parsed_text"] as const) {
    assert.equal(
      resolveStructuredDocumentForBriefText({
        source,
        profileDocument: other,
        storedDocument: document,
      }),
      document,
      `${source} must read the stored row's document, not the profile's`
    );
  }

  // Profile-carried text pairs with the profile's own document.
  assert.equal(
    resolveStructuredDocumentForBriefText({
      source: "profile_structured",
      profileDocument: document,
      storedDocument: other,
    }),
    document
  );
});

test("a raw excerpt yields no document — an excerpt has no sections", () => {
  assert.equal(
    resolveStructuredDocumentForBriefText({
      source: "raw_excerpt",
      storedDocument: { sections: [{ title: "Deliverables", blocks: [] }] },
    }),
    undefined
  );
});

test("an absent or empty document is never handed to the pipeline", () => {
  for (const storedDocument of [null, undefined, { sections: [] }] as const) {
    assert.equal(
      resolveStructuredDocumentForBriefText({ source: "llm_brief_text", storedDocument }),
      undefined,
      "a document with no sections cannot drive the section mapper"
    );
  }
});

// ---------------------------------------------------------------------------
// Kérastase parity — the seven fields, both arms.

test("workflow arm and upload arm produce identical canonical facts for Kérastase", async () => {
  const { llmText, document } = await kerastase();

  // Upload arm: uploadCampaignBriefAction's exact pipeline call.
  const upload = await runCampaignIntelligencePipeline({
    briefText: llmText,
    briefTextSource: "upload",
    structuredParserOutput: document,
  });

  // Workflow arm: what ensureWorkflowCampaignIntelligenceProfile now passes,
  // resolved through the same pairing decision the service uses.
  const workflowDocument = resolveStructuredDocumentForBriefText({
    source: "llm_brief_text",
    storedDocument: document,
  });
  assert.ok(workflowDocument, "the workflow arm must have a document to pass");
  const workflow = await runCampaignIntelligencePipeline({
    briefText: llmText,
    briefTextSource: "upload",
    structuredParserOutput: workflowDocument,
  });

  assert.deepEqual(canonical(workflow.profile), canonical(upload.profile));

  // And the seven fields are actually populated, so parity is not parity on empty.
  const facts = canonical(workflow.profile);
  assert.match(facts.audience ?? "", /Women aged 20[–-]40 in Egypt/i);
  assert.equal(facts.industry, "Beauty & Personal Care");
  assert.ok(
    (facts.deliverables ?? []).some((item) => /Instagram Reel \/ TikTok video/i.test(item)),
    `deliverables missing: ${JSON.stringify(facts.deliverables)}`
  );
  assert.ok(
    (facts.kpis ?? []).some((kpi) => /^engagement rate$/i.test(kpi)),
    `kpis missing: ${JSON.stringify(facts.kpis)}`
  );
  assert.match(facts.keyMessage ?? "", /Professional-level haircare designed around your hair needs/);
  assert.match(facts.callToAction ?? "", /Kérastase/);
  assert.deepEqual(facts.budget, { amount: 3_000_000, currency: "EGP" });
});

test("without the document the workflow arm loses exactly the four section fields", async () => {
  // Pins what the fix is for: the same brief text, minus the document, drops
  // deliverables / KPIs / key message / CTA and keeps everything else.
  const { llmText, document } = await kerastase();

  const withDocument = canonical(
    (
      await runCampaignIntelligencePipeline({
        briefText: llmText,
        briefTextSource: "upload",
        structuredParserOutput: document,
      })
    ).profile
  );
  const withoutDocument = canonical(
    (await runCampaignIntelligencePipeline({ briefText: llmText, briefTextSource: "upload" }))
      .profile
  );

  for (const key of ["deliverables", "kpis", "keyMessage", "callToAction"] as const) {
    assert.ok(
      withDocument[key] != null && withoutDocument[key] == null,
      `${key} is the regression this fix closes — expected present with the document and absent without`
    );
  }
  // Everything the flat text already carried is unaffected either way.
  for (const key of ["audience", "industry", "budget", "brandName", "durationWeeks", "geography"] as const) {
    assert.deepEqual(withoutDocument[key], withDocument[key], `${key} must not depend on the document`);
  }
});

// ---------------------------------------------------------------------------
// A typed brief has no document and must not gain fields.

test("a typed brief with no document stays valid and fabricates nothing", async () => {
  // Both shapes a Copilot-typed brief actually arrives in. Neither has a file,
  // so both take the `structuredParserOutput: undefined` path.
  const shapes = {
    labelled: [
      "Brand: Kérastase",
      "Market: Egypt",
      "Objective: Drive consideration and conversion for premium haircare.",
      "Budget: EGP 3,000,000",
      "Duration: 4 weeks",
      "Platforms: Instagram and TikTok",
    ].join("\n"),
    prose: [
      "We are planning a campaign for Kérastase in Egypt.",
      "The objective is to drive consideration and conversion for premium haircare.",
      "Budget: EGP 3,000,000. Duration: 4 weeks. Platforms: Instagram and TikTok.",
    ].join("\n"),
  };

  for (const [shape, briefText] of Object.entries(shapes)) {
    const { profile } = await runCampaignIntelligencePipeline({
      briefText,
      briefTextSource: "chat",
      // Exactly what the workflow arm passes when there is no stored document.
      structuredParserOutput: undefined,
    });
    const facts = canonical(profile);

    // Still a usable extraction from the flat text alone.
    assert.equal(facts.industry, "Beauty & Personal Care", shape);
    assert.deepEqual(facts.budget, { amount: 3_000_000, currency: "EGP" }, shape);
    assert.equal(facts.durationWeeks, 4, shape);
    assert.deepEqual(facts.geography, ["Egypt"], shape);
    assert.deepEqual(facts.platforms, ["instagram", "tiktok"], shape);

    // Nothing invented for the fields only a document's sections can supply.
    for (const key of ["deliverables", "kpis", "keyMessage", "callToAction"] as const) {
      const value = facts[key];
      assert.ok(
        value == null || (Array.isArray(value) && value.length === 0),
        `${shape}: ${key} must stay empty for a brief that never stated it — got ${JSON.stringify(value)}`
      );
    }
  }

  // A labelled brand line is extracted; unlabelled prose leaves brandName unset
  // rather than guessing one. Pre-existing behaviour, unchanged by this fix and
  // recorded here so a future change to it is a deliberate one.
  const labelled = await runCampaignIntelligencePipeline({
    briefText: shapes.labelled,
    briefTextSource: "chat",
  });
  assert.equal(canonical(labelled.profile).brandName, "Kérastase");
  const prose = await runCampaignIntelligencePipeline({
    briefText: shapes.prose,
    briefTextSource: "chat",
  });
  assert.equal(canonical(prose.profile).brandName, undefined);
});
