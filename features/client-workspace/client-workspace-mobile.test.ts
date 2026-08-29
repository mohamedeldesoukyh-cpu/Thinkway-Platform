import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

test("Client Workspace mobile CSS stacks Overview, Shortlist, Commercial, and chrome", () => {
  const css = readFileSync(resolve("features/client-workspace/styles/client-review-ref.css"), "utf8");
  const creators = readFileSync(
    resolve("features/client-workspace/components/creators-workspace.tsx"),
    "utf8"
  );

  assert.equal(css.includes(".ov-analysis{grid-template-columns:1fr"), true);
  assert.equal(css.includes(".ov-exec-txt{min-width:0;flex-basis:100%}"), true);
  assert.equal(css.includes(".ov-strat{grid-template-columns:1fr"), true);
  assert.equal(css.includes(".journey-h{display:none}"), true);
  assert.equal(css.includes("header.bar .sp{display:none;}"), true);
  assert.equal(css.includes("flex:1 1 100%"), true);
  assert.equal(css.includes(".fstats{grid-template-columns:1fr 1fr}"), true);
  assert.equal(css.includes(".segs{display:flex;flex-wrap:nowrap"), true);
  assert.equal(css.includes(".cc-remove{"), true);
  assert.equal(css.includes(".send-row{"), true);
  assert.equal(css.includes(".cm-total{font-size:24px}"), true);
  assert.equal(css.includes(".dacts .btn,"), true);

  assert.equal(creators.includes('className="cc-remove"'), true);
  assert.equal(creators.includes('style={{ margin: "8px 8px 0 0" }}'), false);
});
