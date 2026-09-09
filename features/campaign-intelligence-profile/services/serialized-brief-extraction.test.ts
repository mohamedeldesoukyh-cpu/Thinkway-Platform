/**
 * Serialized document brief → extraction — production-path regression.
 *
 * Every document upload (.docx / .pdf / .pptx) reaches extraction through
 *
 *   StructuredBriefDocument → serializeStructuredBrief() → runCampaignIntelligencePipeline()
 *
 * and `serializeStructuredBrief()` writes section titles as `Section: <title>`
 * and heading blocks as bare text — neither carries a colon after the label.
 * The label parsers required one, so objective, audience, deliverables, key
 * message, call to action and tone silently vanished from every uploaded brief
 * while the same brief in colon form extracted perfectly. No test covered the
 * serializer's output as extraction input, which is why the gap survived.
 *
 * These tests feed the real serializer's output into the real pipeline.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { extractCampaignFacts } from "@/features/campaign-director/facts/extract-campaign-facts";

import { profileToCampaignFacts } from "./profile-to-facts";
import { runCampaignIntelligencePipeline } from "./run-intelligence-pipeline";
import { serializeStructuredBrief } from "./structured-brief-parser/serialize";
import { applyStructuredBriefFields } from "./structured-brief-parser/extract-profile-fields";
import { createEmptyCampaignIntelligenceProfile } from "../types/profile";
import type { StructuredBriefDocument } from "./structured-brief-parser/types";

/**
 * Faithful shape of a parsed Tafareeh Tea .docx: section titles carry the field
 * labels, one section uses a bare heading block, deliverables are a bullet list.
 */
const TAFAREEH_DOCUMENT: StructuredBriefDocument = {
  title: "Tafareeh Tea — Campaign Brief",
  sourceFormat: "docx",
  parserMode: "docx_ooxml_tables",
  sections: [
    {
      title: "Campaign Objective",
      blocks: [
        {
          type: "paragraph",
          text: "Build awareness for Tafareeh Tea and encourage people to try and buy the product.",
        },
      ],
    },
    {
      title: "Target Audience",
      blocks: [
        { type: "paragraph", text: "Egyptian tea drinkers, mainly young adults and families." },
      ],
    },
    {
      title: "Key Message",
      blocks: [
        {
          type: "paragraph",
          text: "Rich, strong tea integrated naturally into everyday Egyptian life.",
        },
      ],
    },
    {
      title: "Call to Action",
      blocks: [{ type: "paragraph", text: "Try Tafareeh Tea." }],
    },
    {
      title: "Tone of Voice",
      blocks: [
        { type: "paragraph", text: "Natural, relatable, positive, Egyptian, not overly scripted." },
      ],
    },
    {
      title: "Campaign Goal",
      blocks: [{ type: "paragraph", text: "Awareness -> Interest -> Trial" }],
    },
    {
      // No section title — the label arrives as a bare heading block instead.
      blocks: [
        { type: "heading", level: 2, text: "Creator Deliverables" },
        {
          type: "list",
          ordered: false,
          items: ["1 Instagram Reel", "1 Instagram Story", "Mirror the Reel to TikTok"],
        },
      ],
    },
    {
      title: "Market",
      blocks: [{ type: "paragraph", text: "Egypt" }],
    },
  ],
};

const TAFAREEH_LLM_TEXT = serializeStructuredBrief(TAFAREEH_DOCUMENT);

async function runUpload(document: StructuredBriefDocument) {
  const { profile } = await runCampaignIntelligencePipeline({
    briefText: serializeStructuredBrief(document),
    briefTextSource: "upload",
    structuredParserOutput: document,
  });
  return { profile, facts: profileToCampaignFacts(profile) };
}

// The serializer's actual output shape — the premise the rest of the file rests on.

test("serializeStructuredBrief writes heading-style labels with no colon after the label", () => {
  assert.match(TAFAREEH_LLM_TEXT, /^Section: Campaign Objective$/m);
  assert.match(TAFAREEH_LLM_TEXT, /^Section: Target Audience$/m);
  assert.match(TAFAREEH_LLM_TEXT, /^Creator Deliverables$/m);
  // Not a single `Campaign Objective:` anywhere — the colon the parsers wanted.
  assert.doesNotMatch(TAFAREEH_LLM_TEXT, /Campaign Objective\s*:/);
});

// Production path: document → serializer → pipeline.

test("uploaded document: every labelled field survives the real pipeline", async () => {
  const { facts } = await runUpload(TAFAREEH_DOCUMENT);

  // The pipeline normalises objectives into a list, which drops the full stop.
  assert.equal(
    facts.objective,
    "Build awareness for Tafareeh Tea and encourage people to try and buy the product"
  );
  assert.equal(facts.audience, "Egyptian tea drinkers, mainly young adults and families.");
  assert.deepEqual(facts.deliverables, [
    "1 Instagram Reel",
    "1 Instagram Story",
    "Mirror the Reel to TikTok",
  ]);
  assert.equal(
    facts.keyMessage,
    "Rich, strong tea integrated naturally into everyday Egyptian life."
  );
  assert.equal(facts.callToAction, "Try Tafareeh Tea.");
  assert.deepEqual(facts.toneOfVoice, [
    "Natural",
    "relatable",
    "positive",
    "Egyptian",
    "not overly scripted",
  ]);
  assert.deepEqual(facts.campaignFunnel, ["Awareness", "Interest", "Trial"]);
});

test("uploaded document: the objective is sourced from the brief, never defaulted", async () => {
  const { facts } = await runUpload(TAFAREEH_DOCUMENT);

  // The Dev symptom: a defaulted objective, which then bails out of
  // fillBriefSourcedHeuristicGaps() because its source is not "brief".
  assert.equal(facts.sources.objective, "brief");
  assert.notEqual(facts.objective, "Brand awareness and engagement");
  assert.equal(facts.sources.audience, "brief");
  assert.equal(facts.sources.deliverables, "brief");
});

test("uploaded document: heading labels never leak into the values", async () => {
  const { facts } = await runUpload(TAFAREEH_DOCUMENT);

  for (const value of [facts.objective, facts.audience, facts.keyMessage, facts.callToAction]) {
    assert.doesNotMatch(value ?? "", /^Section:/i);
    assert.doesNotMatch(value ?? "", /^(Campaign Objective|Target Audience|Key Message)\b/i);
  }
  for (const item of facts.deliverables ?? []) {
    assert.doesNotMatch(item, /^Creator Deliverables$/i);
  }
});

// Focused label-format coverage.

test("label formats: `Label: value` on one line", () => {
  const facts = extractCampaignFacts({
    rawMessage: "Objective: Build awareness for Tafareeh Tea.\n\nMarket: Egypt",
  });
  assert.equal(facts.objective, "Build awareness for Tafareeh Tea.");
  assert.equal(facts.sources.objective, "brief");
});

test("label formats: `Label:` with the value on the next line", () => {
  const facts = extractCampaignFacts({
    rawMessage: "Campaign Objective:\nBuild awareness for Tafareeh Tea.\n\nMarket: Egypt",
  });
  assert.equal(facts.objective, "Build awareness for Tafareeh Tea.");
  assert.equal(facts.sources.objective, "brief");
});

test("label formats: `Section: Label` with the value on the next line", () => {
  const facts = extractCampaignFacts({
    rawMessage: "Section: Campaign Objective\nBuild awareness for Tafareeh Tea.\n\nSection: Market\nEgypt",
  });
  assert.equal(facts.objective, "Build awareness for Tafareeh Tea.");
  assert.equal(facts.sources.objective, "brief");
});

test("label formats: bare `Label` heading with the value on the next line", () => {
  const facts = extractCampaignFacts({
    rawMessage: "Campaign Objective\nBuild awareness for Tafareeh Tea.\n\nMarket\nEgypt",
  });
  assert.equal(facts.objective, "Build awareness for Tafareeh Tea.");
  assert.equal(facts.sources.objective, "brief");
});

test("label formats: serialized key/value table row `Label -> value`", () => {
  const facts = extractCampaignFacts({
    rawMessage: "Table:\nCampaign Objective -> Build awareness for Tafareeh Tea\nMarket -> Egypt",
  });
  assert.equal(facts.objective, "Build awareness for Tafareeh Tea");
  assert.equal(facts.sources.objective, "brief");
});

test("label formats: a bare heading with no value beneath never becomes the value", () => {
  const facts = extractCampaignFacts({
    rawMessage: "Section: Campaign Objective\n\nSection: Market\nEgypt",
  });
  assert.equal(facts.sources.objective, "default");
  assert.doesNotMatch(facts.objective ?? "", /objective/i);
});

test("label formats: a heading block does not swallow the section beneath it", () => {
  const facts = extractCampaignFacts({
    rawMessage: [
      "Campaign Objective",
      "Build awareness for Tafareeh Tea.",
      "Target Audience",
      "Egyptian tea drinkers, mainly young adults and families.",
      "Key Message",
      "Rich, strong tea.",
    ].join("\n"),
  });
  assert.equal(facts.objective, "Build awareness for Tafareeh Tea.");
  assert.equal(facts.audience, "Egyptian tea drinkers, mainly young adults and families.");
  assert.equal(facts.keyMessage, "Rich, strong tea.");
});

// Deliverables label prefixes.

test("deliverables: qualified heading labels are read as a block", () => {
  for (const label of ["Deliverables", "Creator Deliverables", "Agency Deliverables"]) {
    const facts = extractCampaignFacts({
      rawMessage: `${label}\n- 1 Instagram Reel\n- 1 Instagram Story\n\nMarket: Egypt`,
    });
    assert.deepEqual(facts.deliverables, ["1 Instagram Reel", "1 Instagram Story"], label);
  }
});

test("deliverables: an ordered list keeps its item text, not its numbering", () => {
  const facts = extractCampaignFacts({
    rawMessage: "Creator Deliverables:\n1. 1 Instagram Reel\n2. 1 Instagram Story\n\nMarket: Egypt",
  });
  assert.deepEqual(facts.deliverables, ["1 Instagram Reel", "1 Instagram Story"]);
});

test("deliverables: a qualified table label is no longer dropped by the structured parser", () => {
  const document: StructuredBriefDocument = {
    sections: [
      {
        blocks: [
          {
            type: "table",
            rows: [
              ["Creator Deliverables", "1 Instagram Reel, 1 Instagram Story"],
              ["Agency Deliverables", "Performance report"],
            ],
          },
        ],
      },
    ],
  };

  const profile = applyStructuredBriefFields(createEmptyCampaignIntelligenceProfile(), document);
  assert.deepEqual(profile.deliverables, [
    "1 Instagram Reel",
    "1 Instagram Story",
    "Performance report",
  ]);
});

// Block termination — a labelled block must not absorb the next labelled line.
// These shapes are not colon-and-letters only, and a narrower boundary test let
// each of them be swallowed into the value above.

test("block termination: a label containing digits ends the block", () => {
  const facts = extractCampaignFacts({
    rawMessage: "Objective:\nBuild awareness\nPhase 1: launch\n",
  });
  assert.equal(facts.objective, "Build awareness");
});

test("block termination: a dash-closed label ends the block", () => {
  const facts = extractCampaignFacts({
    rawMessage: "Objective:\nBuild awareness\nAwareness - drive trial\n",
  });
  assert.equal(facts.objective, "Build awareness");
});

test("block termination: an em-dash-closed label ends the block", () => {
  const facts = extractCampaignFacts({
    rawMessage: "Key message:\nStrong tea\nNote — see appendix\n",
  });
  assert.equal(facts.keyMessage, "Strong tea");
});

test("block termination: audience does not absorb the labelled line beneath it", () => {
  const facts = extractCampaignFacts({
    rawMessage: "Target Audience:\nYoung Egyptians\nPhase 1 - launch\n",
  });
  assert.equal(facts.audience, "Young Egyptians");
});

test("block termination: blank lines and bullets still behave as before", () => {
  const blank = extractCampaignFacts({
    rawMessage: "Objective:\nBuild awareness\n\nPhase 1 - launch\n",
  });
  assert.equal(blank.objective, "Build awareness");

  // A bullet is block content, never a new label.
  const bullet = extractCampaignFacts({
    rawMessage: "Objective:\nBuild awareness\n- and drive trial\n",
  });
  assert.equal(bullet.objective, "Build awareness and drive trial");
});

// Deliverables label precision — "Deliverable" is also an ordinary word stem.

test("deliverables: a hyphenated word is not a deliverables label", () => {
  const facts = extractCampaignFacts({
    rawMessage: "Deliverable-based pricing is preferred for this campaign.",
  });
  assert.equal(facts.deliverables, undefined);
});

test("deliverables: explicit separators still open the block", () => {
  assert.deepEqual(
    extractCampaignFacts({ rawMessage: "Creator Deliverables -> 2 reels, 4 stories\nMarket -> Egypt" })
      .deliverables,
    ["2 reels", "4 stories"]
  );
  assert.deepEqual(
    extractCampaignFacts({ rawMessage: "Agency Deliverables: 2 reels, 4 stories\n\nMarket: Egypt" })
      .deliverables,
    ["2 reels", "4 stories"]
  );
  assert.deepEqual(
    extractCampaignFacts({ rawMessage: "Content Deliverables\n- 2 reels\n- 4 stories\n\nMarket: Egypt" })
      .deliverables,
    ["2 reels", "4 stories"]
  );
  assert.deepEqual(
    extractCampaignFacts({ rawMessage: "Deliverable: one reel\n\nMarket: Egypt" }).deliverables,
    ["one reel"]
  );
});
