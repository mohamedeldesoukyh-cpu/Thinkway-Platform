import { strict as assert } from "node:assert";
import { test } from "node:test";

import { outputActionCommand } from "./output-commands";
import { OUTPUT_CATALOG } from "../output-catalog";
import { parseStudioIntentFallback } from "@/features/campaign-studio/services/copilot/studio-copilot-parse";

/**
 * Every Outputs Center action must resolve — through the SAME Copilot parser the
 * chat uses — to the matching intent for the SAME output. This proves buttons
 * and chat share one execution path (no duplicate logic).
 */

const GENERATABLE = OUTPUT_CATALOG.filter((d) => typeof d.generate === "function").map((d) => d.kind);

test("generate/regenerate/export commands round-trip to the right intent + output for every generatable kind", () => {
  for (const kind of GENERATABLE) {
    const gen = parseStudioIntentFallback(outputActionCommand("generate", kind));
    assert.equal(gen.kind, "generate_output", kind);
    assert.equal((gen as { output?: string }).output, kind, `generate ${kind}`);

    const regen = parseStudioIntentFallback(outputActionCommand("regenerate", kind));
    assert.equal(regen.kind, "regenerate_output", kind);
    assert.equal((regen as { output?: string }).output, kind, `regenerate ${kind}`);

    const exp = parseStudioIntentFallback(outputActionCommand("export", kind));
    assert.equal(exp.kind, "export_output", kind);
    assert.equal((exp as { output?: string }).output, kind, `export ${kind}`);
  }
});

test("open/preview/compare/explain commands route to the Center ops for the right output", () => {
  const kind = "media_plan" as const;
  assert.equal(parseStudioIntentFallback(outputActionCommand("open", kind)).kind, "open_output");
  assert.equal(parseStudioIntentFallback(outputActionCommand("preview", kind)).kind, "preview_output");
  const cmp = parseStudioIntentFallback(outputActionCommand("compare", kind));
  assert.equal(cmp.kind, "compare_output_versions");
  assert.equal((cmp as { output?: string }).output, kind);
  const why = parseStudioIntentFallback(outputActionCommand("explain_staleness", kind));
  assert.equal(why.kind, "explain_output_staleness");
  assert.equal((why as { output?: string }).output, kind);
});
