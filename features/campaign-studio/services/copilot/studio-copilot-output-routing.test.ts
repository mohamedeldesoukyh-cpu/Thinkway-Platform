import assert from "node:assert/strict";
import test from "node:test";

import {
  parseDeterministicStartDateTimelineIntent,
  parseStudioIntentFallback,
  parseToolCallIntent,
} from "./studio-copilot-parse";

test("fallback routes 'generate'/'create' output commands to generate_output", () => {
  for (const [message, output] of [
    ["Generate a Media Plan.", "media_plan"],
    ["Create a Full Campaign Strategy.", "full_strategy"],
    ["Generate an Executive Proposal.", "executive_proposal"],
    ["Generate only the Timeline.", "posting_timeline"],
    ["Generate a Risk Assessment.", "risk_plan"],
    ["Generate an Amplification Plan.", "amplification_plan"],
    ["Generate only the Executive Summary.", "executive_summary"],
  ] as const) {
    const intent = parseStudioIntentFallback(message);
    assert.equal(intent.kind, "generate_output", message);
    assert.equal((intent as { output?: string }).output, output, message);
  }
});

test("fallback routes 'regenerate'/'rebuild' to regenerate_output", () => {
  for (const [message, output] of [
    ["Regenerate the Media Plan.", "media_plan"],
    ["Rebuild the KPI Forecast.", "kpi_forecast"],
  ] as const) {
    const intent = parseStudioIntentFallback(message);
    assert.equal(intent.kind, "regenerate_output", message);
    assert.equal((intent as { output?: string }).output, output, message);
  }
});

test("fallback routes 'export'/'download' to export_output", () => {
  assert.equal(parseStudioIntentFallback("Export the Strategy.").kind, "export_output");
  assert.equal(parseStudioIntentFallback("Export the Proposal.").kind, "export_output");
  assert.equal(parseStudioIntentFallback("download the media plan").kind, "export_output");
});

test("fallback routes Outputs Center navigation & inspection ops", () => {
  assert.equal(parseStudioIntentFallback("Open the Media Plan.").kind, "open_output");
  assert.equal(parseStudioIntentFallback("Preview the proposal.").kind, "preview_output");
  const why = parseStudioIntentFallback("Why does the Proposal need updating?");
  assert.equal(why.kind, "explain_output_staleness");
  assert.equal((why as { output?: string }).output, "executive_proposal");
  const cmp = parseStudioIntentFallback("Compare version 1 and version 3 of the Media Plan.");
  assert.equal(cmp.kind, "compare_output_versions");
  assert.equal((cmp as { from?: number; to?: number }).from, 1);
  assert.equal((cmp as { from?: number; to?: number }).to, 3);
  assert.equal(parseStudioIntentFallback("Compare the last two versions.").kind, "compare_output_versions");
});

test("content-editing phrasings are NOT hijacked by output routing", () => {
  // These must still route to authoring / facts / slate edits, not output generation.
  assert.equal(parseStudioIntentFallback("rewrite the strategy to be more premium").kind, "author_section");
  assert.equal(parseStudioIntentFallback("make it more executive").kind, "author_section");
  assert.equal(parseStudioIntentFallback("set the budget to EGP 2M").kind, "update_budget");
  assert.equal(parseStudioIntentFallback("remove the celebrity creators").kind, "remove_creators");
  assert.equal(parseStudioIntentFallback("add parenting creators").kind, "add_creators");
});

test("start-date change/move/shift/update routes to update_timeline, never generate", () => {
  for (const message of [
    "Change campaign start date to 24/07/2026.",
    "change the start date to 24/07/2026",
    "Move start date to 2026-07-24",
    "Shift the campaign start to 24/07/2026",
    "Update start date to 24th of July 2026",
    "Reschedule the campaign start date to 24/07/2026",
    "set campaign start date to 24/07/2026",
  ]) {
    const intent = parseDeterministicStartDateTimelineIntent(message);
    assert.ok(intent, message);
    assert.equal(intent!.kind, "update_timeline", message);
    assert.equal(intent!.startDate, "2026-07-24", message);
    assert.equal(parseStudioIntentFallback(message).kind, "update_timeline", message);
  }

  // Explicit regenerate must not be captured by the start-date guard.
  assert.equal(
    parseDeterministicStartDateTimelineIntent(
      "Regenerate the media plan starting 24/07/2026"
    ),
    null
  );
});

test("starting + ending window parses both campaign dates", () => {
  const intent = parseDeterministicStartDateTimelineIntent(
    "Campaign starting sate 24/07/2026 ending 23/08/2026"
  );
  assert.ok(intent);
  assert.equal(intent!.kind, "update_timeline");
  assert.equal(intent!.startDate, "2026-07-24");
  assert.equal(intent!.endDate, "2026-08-23");
  assert.equal(
    parseStudioIntentFallback("Campaign starting 24/07/2026 ending 23/08/2026").kind,
    "update_timeline"
  );
});

test("tool-call path maps output tools to typed intents", () => {
  assert.deepEqual(
    parseToolCallIntent({ id: "c1", name: "generate_output", arguments: JSON.stringify({ output: "media_plan" }) }),
    { kind: "generate_output", output: "media_plan" }
  );
  assert.deepEqual(
    parseToolCallIntent({ id: "c2", name: "export_output", arguments: JSON.stringify({ output: "full_strategy" }) }),
    { kind: "export_output", output: "full_strategy" }
  );
  // Unknown output value is coerced to undefined, not passed through.
  assert.deepEqual(
    parseToolCallIntent({ id: "c3", name: "regenerate_output", arguments: JSON.stringify({ output: "bogus" }) }),
    { kind: "regenerate_output", output: undefined }
  );
});
