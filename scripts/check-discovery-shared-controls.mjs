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

const files = execFileSync("git", ["ls-files", "app", "features", "components"], { encoding: "utf8" }).trim().split("\n");
const importers = files.filter((file) => /\.[jt]sx?$/.test(file) && !file.includes(".test.") && fs.readFileSync(file, "utf8").includes('import "@/app/styles/discovery-suite.css"'));
assert.deepEqual(importers, ["app/(dashboard)/discovery/layout.tsx"], "Review shared-style dependency before adding another legacy-sheet importer");
const layout = fs.readFileSync(importers[0], "utf8");
assert.ok(layout.indexOf('import "@/app/styles/discovery.css"') >= 0);
assert.ok(layout.indexOf('import "@/app/styles/discovery.css"') < layout.indexOf('import "@/app/styles/discovery-suite.css"'));
console.log(`Verified ${expected.length} shared control rules, foundation import order and motion overrides.`);
