import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const transcript =
  "C:/Users/X13 Yoga G3/.cursor/projects/c-thinkway-platform/agent-transcripts/fb3d73f6-b3c6-4a90-b3d7-d9bc214f6312/fb3d73f6-b3c6-4a90-b3d7-d9bc214f6312.jsonl";
const repoRoot = "c:/thinkway-platform";
const rel = "features/quotations/components/quotation-workspace.tsx";

const lines = fs.readFileSync(transcript, "utf8").split("\n").filter(Boolean);
let content = "";
try {
  content = execSync(`git show "HEAD:${rel}"`, { encoding: "utf8", cwd: repoRoot });
} catch {
  content = "";
}

function normPath(p) {
  return p.replace(/\\/g, "/").replace(/^c:\/thinkway-platform\//i, "");
}

for (const line of lines) {
  const obj = JSON.parse(line);
  const parts = obj.message?.content;
  if (!Array.isArray(parts)) continue;
  for (const part of parts) {
    if (part.type !== "tool_use" || normPath(part.input?.path ?? "") !== rel) continue;
    if (part.name === "Write") content = part.input.contents;
    else if (part.name === "StrReplace" && content.includes(part.input.old_string)) {
      content = content.replace(part.input.old_string, part.input.new_string);
    }
  }
}

const out = path.join(repoRoot, "scripts/recovered/workspace-fb3-only.tsx");
fs.writeFileSync(out, content);
console.log(content.length, content.includes("togglePriceExpanded") ? "CORRUPT" : "OK");
console.log(content.includes("QuotationCreatorGroupRows") ? "HAS_GROUPS" : "NO_GROUPS");
