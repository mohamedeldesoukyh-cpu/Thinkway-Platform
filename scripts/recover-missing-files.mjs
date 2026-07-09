import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const transcript =
  "C:/Users/X13 Yoga G3/.cursor/projects/c-thinkway-platform/agent-transcripts/44e22945-9913-4655-ae97-a974dd5ab2b3/44e22945-9913-4655-ae97-a974dd5ab2b3.jsonl";
const repoRoot = "c:/thinkway-platform";
const outDir = path.join(repoRoot, "scripts/recovered");
const targets = [
  "features/quotations/components/quotation-workspace-header.tsx",
  "features/quotations/components/quotation-commercial-metrics-band.tsx",
  "features/quotations/components/quotation-creators-totals-strip.tsx",
  "features/quotations/components/quotation-validity-bar.tsx",
  "features/quotations/components/quotation-terms-accordion.tsx",
  "features/quotations/components/quotation-lifecycle-pills.tsx",
  "features/quotations/components/quotation-lifecycle-sheet.tsx",
  "features/quotations/components/quotation-workspace.tsx",
];

const lines = fs.readFileSync(transcript, "utf8").split("\n").filter(Boolean);
const fileStates = new Map();
let writes = 0;
let replaces = 0;
let failed = 0;

function normPath(p) {
  return p.replace(/\\/g, "/").replace(/^c:\/thinkway-platform\//i, "");
}

function readBase(rel) {
  try {
    return execSync(`git show "HEAD:${rel}"`, { encoding: "utf8", cwd: repoRoot });
  } catch {
    return "";
  }
}

function ensure(rel) {
  if (!fileStates.has(rel)) {
    fileStates.set(rel, readBase(rel));
  }
}

for (const line of lines) {
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }
  const content = obj.message?.content;
  if (!Array.isArray(content)) continue;

  for (const part of content) {
    if (part.type !== "tool_use") continue;
    const { name, input } = part;
    if (!input?.path) continue;
    const rel = normPath(input.path);
    if (!targets.includes(rel)) continue;

    if (name === "Write" && input.contents != null) {
      fileStates.set(rel, input.contents);
      writes++;
      continue;
    }

    if (name !== "StrReplace") continue;
    ensure(rel);
    const cur = fileStates.get(rel);
    if (!cur.includes(input.old_string)) {
      failed++;
      continue;
    }
    fileStates.set(rel, cur.replace(input.old_string, input.new_string));
    replaces++;
  }
}

fs.mkdirSync(outDir, { recursive: true });
console.log(JSON.stringify({ writes, replaces, failed }, null, 2));

for (const rel of targets) {
  const contents = fileStates.get(rel);
  const basename = path.basename(rel);
  const corrupt = contents?.includes("togglePriceExpanded") ? " CORRUPT" : "";
  console.log(rel, contents ? contents.length + corrupt : "MISSING");
  if (contents) {
    fs.writeFileSync(path.join(outDir, basename), contents);
  }
}
