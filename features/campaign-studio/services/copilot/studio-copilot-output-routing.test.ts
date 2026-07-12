import assert from "node:assert/strict";
import test from "node:test";

import { parseStudioIntentFallback, parseToolCallIntent } from "./studio-copilot-parse";

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

test("content-editing phrasings are NOT hijacked by output routing", () => {
  // These must still route to authoring / facts / slate edits, not output generation.
  assert.equal(parseStudioIntentFallback("rewrite the strategy to be more premium").kind, "author_section");
  assert.equal(parseStudioIntentFallback("make it more executive").kind, "author_section");
  assert.equal(parseStudioIntentFallback("set the budget to EGP 2M").kind, "update_budget");
  assert.equal(parseStudioIntentFallback("remove the celebrity creators").kind, "remove_creators");
  assert.equal(parseStudioIntentFallback("add parenting creators").kind, "add_creators");
});

test("tool-call path maps output tools to typed intents", () => {
  assert.deepEqual(
    parseToolCallIntent({ name: "generate_output", arguments: JSON.stringify({ output: "media_plan" }) }),
    { kind: "generate_output", output: "media_plan" }
  );
  assert.deepEqual(
    parseToolCallIntent({ name: "export_output", arguments: JSON.stringify({ output: "full_strategy" }) }),
    { kind: "export_output", output: "full_strategy" }
  );
  // Unknown output value is coerced to undefined, not passed through.
  assert.deepEqual(
    parseToolCallIntent({ name: "regenerate_output", arguments: JSON.stringify({ output: "bogus" }) }),
    { kind: "regenerate_output", output: undefined }
  );
});
