import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const transcript =
  "C:/Users/X13 Yoga G3/.cursor/projects/c-thinkway-platform/agent-transcripts/44e22945-9913-4655-ae97-a974dd5ab2b3/44e22945-9913-4655-ae97-a974dd5ab2b3.jsonl";
const repoRoot = "c:/thinkway-platform";
const lines = fs.readFileSync(transcript, "utf8").split("\n").filter(Boolean);

function normPath(p) {
  return p.replace(/\\/g, "/").replace(/^c:\/thinkway-platform\//i, "");
}

function posix(rel) {
  return rel.split(path.sep).join("/");
}

function readBase(rel) {
  const p = posix(rel);
  try {
    return execSync(`git show "HEAD:${p}"`, {
      encoding: "utf8",
      cwd: repoRoot,
    });
  } catch {
    try {
      return fs.readFileSync(path.join(repoRoot, rel), "utf8");
    } catch {
      return null;
    }
  }
}

const fileStates = new Map();
let writes = 0;
let replaces = 0;
let failed = 0;

function ensure(rel) {
  if (!fileStates.has(rel)) {
    const base = readBase(rel);
    if (base != null) fileStates.set(rel, base);
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
    if (!rel.toLowerCase().includes("quotation")) continue;

    if (name === "Write" && input.contents != null) {
      fileStates.set(rel, input.contents);
      writes++;
      continue;
    }

    if (name !== "StrReplace") continue;
    ensure(rel);
    const cur = fileStates.get(rel);
    if (cur == null) {
      failed++;
      continue;
    }
    if (!cur.includes(input.old_string)) {
      failed++;
      continue;
    }
    fileStates.set(rel, cur.replace(input.old_string, input.new_string));
    replaces++;
  }
}

console.log(
  JSON.stringify({ writes, replaces, failed, files: fileStates.size }, null, 2)
);

for (const [rel, contents] of fileStates) {
  const abs = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
}

const check = [
  "features/quotations/components/quotation-workspace.tsx",
  "features/quotations/components/quotation-workspace-header.tsx",
  "features/quotations/components/quotation-creator-group-rows.tsx",
];
for (const rel of check) {
  const contents = fileStates.get(rel);
  console.log(rel, contents ? contents.length : "MISSING");
}
