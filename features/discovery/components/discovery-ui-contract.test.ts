/**
 * Discovery UI Contract — regression guard against architectural drift.
 * Run: npm run test:discovery-ui-contract
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const CODE_EXTENSIONS = new Set([".ts", ".tsx"]);
const DOC_EXTENSIONS = new Set([".md", ".mdc"]);

const SCAN_ROOTS = [
  "features/discovery",
  "features/creators/picker",
  "app/(dashboard)/discovery",
];

const ALLOWED_GLASS_FLYOUT = new Set([
  path.normalize("features/discovery/components/design-system/discovery-selection-flyout.tsx"),
]);

const ALLOWED_EXACT_ROW_DEFINITION = path.normalize(
  "features/discovery/components/discovery-creator-exact-row.tsx"
);

const EXACT_ROW_REEXPORT = path.normalize(
  "features/discovery/components/creator-search/creator-search-exact-row.tsx"
);

const VIEW_MODEL_CANONICAL = path.normalize(
  "features/discovery/view-models/discovery-creator-view-model.ts"
);

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, out);
    } else if (CODE_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function rel(file: string): string {
  return path.normalize(path.relative(ROOT, file));
}

function scanFiles(): string[] {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    walk(path.join(ROOT, root), files);
  }
  return files;
}

function read(file: string): string {
  return fs.readFileSync(file, "utf8");
}

const violations: string[] = [];

function fail(message: string) {
  violations.push(message);
}

// --- Shim must be removed ---
const shimPath = path.join(ROOT, "features/discovery/components/creator-result-row.tsx");
if (fs.existsSync(shimPath)) {
  fail("creator-result-row.tsx shim still exists — remove after zero imports");
}

const files = scanFiles();

for (const file of files) {
  const r = rel(file);
  if (r.endsWith("discovery-ui-contract.test.ts")) continue;
  const content = read(file);

  if (content.includes("creator-result-row")) {
    fail(`${r}: imports deprecated creator-result-row`);
  }

  if (/\bCreatorResultRow\b/.test(content) || /\bCreatorResultGridHeader\b/.test(content)) {
    fail(`${r}: references removed grid row/header components`);
  }

  if (/\bconst\s+TH_CLASS\b/.test(content) || /\bconst\s+TD_CLASS\b/.test(content)) {
    fail(`${r}: local table cell classes — use DISCOVERY_TABLE_* or exact-row layout`);
  }

  if (
    /import[\s\S]*\bGlassSelectionFlyout\b/.test(content) &&
    !ALLOWED_GLASS_FLYOUT.has(r)
  ) {
    fail(`${r}: use DiscoverySelectionFlyout instead of GlassSelectionFlyout directly`);
  }

  if (/\bexport function buildDiscoveryCreatorViewModel\b/.test(content) && r !== VIEW_MODEL_CANONICAL) {
    fail(`${r}: duplicate ViewModel — extend discovery-creator-view-model.ts`);
  }

  if (
    /\bexport const DiscoveryCreatorExactRow\b/.test(content) &&
    r !== ALLOWED_EXACT_ROW_DEFINITION
  ) {
    fail(`${r}: duplicate DiscoveryCreatorExactRow — extend canonical row via slots`);
  }

  if (/\bfunction CreatorSelectionRow\b/.test(content) || /\bfunction PanelSelectionRow\b/.test(content)) {
    fail(`${r}: legacy selection row layout — use DiscoveryCreatorExactRow`);
  }
}

// Re-export file must stay thin
if (fs.existsSync(path.join(ROOT, EXACT_ROW_REEXPORT))) {
  const reexport = read(path.join(ROOT, EXACT_ROW_REEXPORT));
  if (reexport.includes("memo(function")) {
    fail(`${EXACT_ROW_REEXPORT}: must re-export canonical row only, not define row inline`);
  }
}

// Contract docs must exist
for (const doc of ["docs/DISCOVERY_UI_CONTRACT.md", "docs/DISCOVERY_ARCHITECTURE.md"]) {
  if (!fs.existsSync(path.join(ROOT, doc))) {
    fail(`Missing required doc: ${doc}`);
  }
}

// Design system barrel must export canonical row
const barrel = read(path.join(ROOT, "features/discovery/components/design-system/index.ts"));
if (!barrel.includes("DiscoveryCreatorExactRow")) {
  fail("design-system/index.ts must export DiscoveryCreatorExactRow");
}

if (violations.length > 0) {
  console.error("Discovery UI Contract violations:\n");
  for (const v of violations) {
    console.error(`  • ${v}`);
  }
  process.exit(1);
}

console.log("features/discovery/components/discovery-ui-contract.test.ts — all checks passed");
