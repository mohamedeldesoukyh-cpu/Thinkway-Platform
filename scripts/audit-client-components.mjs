/**
 * Phase 3 — classify "use client" modules (heuristic, no behavior changes).
 *
 * Usage: node scripts/audit-client-components.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["app", "features", "components", "hooks", "lib"];
const CLIENT_HINTS = [
  /\buse(State|Effect|Ref|Memo|Callback|Reducer|LayoutEffect|Transition|DeferredValue)\b/,
  /\buse(Router|Pathname|SearchParams|Params)\b/,
  /\bfrom ["']next\/(navigation|dynamic)["']/,
  /\bwindow\.|document\.|localStorage|sessionStorage/,
  /\bonClick=|\bonChange=|\bonSubmit=/,
  /\bcreatePortal\b/,
];
const LAZY_HINTS = [
  /Sheet|Dialog|Drawer|Modal|Preview|Editor|Chart|Map|Export|Pdf|Pptx|Presentation|Forecast|Analytics|Outputs|Studio|DNA|Compare/i,
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function classify(file, source) {
  const base = path.basename(file);
  const mustClient =
    CLIENT_HINTS.some((re) => re.test(source)) ||
    /Provider|Context\.Provider/.test(source);
  const lazyCandidate = LAZY_HINTS.some((re) => re.test(base) || re.test(file));
  if (!mustClient) {
    return "can_become_server";
  }
  if (lazyCandidate) return "can_dynamically_import";
  return "must_remain_client";
}

const rows = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const source = fs.readFileSync(file, "utf8");
    if (!/^["']use client["'];/m.test(source)) continue;
    const rel = file.replaceAll("\\", "/");
    const bytes = Buffer.byteLength(source);
    rows.push({
      file: rel,
      kb: Math.round((bytes / 1024) * 10) / 10,
      class: classify(rel, source),
    });
  }
}

rows.sort((a, b) => b.kb - a.kb);

const summary = rows.reduce((acc, row) => {
  acc[row.class] = (acc[row.class] ?? 0) + 1;
  return acc;
}, {});

const over100 = rows.filter((r) => r.kb >= 100);

console.log(
  JSON.stringify(
    {
      totalClientModules: rows.length,
      summary,
      over100kb: over100.slice(0, 40),
      top40BySize: rows.slice(0, 40),
      note: "Heuristic only — verify before converting to Server Components.",
    },
    null,
    2
  )
);
