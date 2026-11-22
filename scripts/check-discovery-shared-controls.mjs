import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import postcss from "postcss";

// The legacy sheet is only used after the frozen foundation. These exact shared
// rules must remain available there; local overrides and motion rules stay local.
const foundation = fs.readFileSync("app/styles/discovery.css", "utf8");
const legacy = fs.readFileSync("app/styles/discovery-suite.css", "utf8");
const expected = JSON.parse(fs.readFileSync("scripts/tests/discovery-shared-controls.json", "utf8"));
const normalize = (css) => css.replace(/\s+/g, " ").trim();
const rules = new Set(postcss.parse(foundation).nodes.filter((node) => node.type === "rule").map((node) => normalize(node.toString())));
for (const { selector, css } of expected) {
  assert.ok(rules.has(normalize(css)), `Missing equivalent foundation rule: ${selector}`);
}
assert.match(legacy, /\.discovery-suite \.tw-sw\{[^}]*transition:background/);
assert.match(legacy, /\.discovery-suite \.tw-spin\{[^}]*animation:tw-spin/);

// A rule that matches the foundation may still restore an earlier legacy
// override. Preserve the original sequence for these selectors (including the
// masthead's gradient and decorative ring), not just their presence somewhere.
const cascadeFixtures = JSON.parse(fs.readFileSync("scripts/tests/discovery-cascade-overrides.json", "utf8"));
const legacyRules = postcss.parse(legacy).nodes.filter((node) => node.type === "rule");
for (const { selector, rules: sequence } of cascadeFixtures) {
  assert.deepEqual(
    legacyRules.filter((node) => node.selector === selector).map((node) => normalize(node.toString())),
    sequence.map(normalize),
    `Legacy cascade changed for ${selector}`,
  );
}

const files = execFileSync("git", ["ls-files", "app", "features", "components"], { encoding: "utf8" }).trim().split("\n");
const importers = files.filter((file) => /\.[jt]sx?$/.test(file) && !file.includes(".test.") && fs.readFileSync(file, "utf8").includes('import "@/app/styles/discovery-suite.css"'));
assert.deepEqual(importers, ["app/(dashboard)/discovery/layout.tsx"], "Review shared-style dependency before adding another legacy-sheet importer");
const layout = fs.readFileSync(importers[0], "utf8");
assert.ok(layout.indexOf('import "@/app/styles/discovery.css"') >= 0);
assert.ok(layout.indexOf('import "@/app/styles/discovery.css"') < layout.indexOf('import "@/app/styles/discovery-suite.css"'));
console.log(`Verified ${expected.length} shared control rules, foundation import order and motion overrides.`);
