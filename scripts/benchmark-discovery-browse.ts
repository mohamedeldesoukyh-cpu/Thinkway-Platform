/**
 * Discovery browse performance benchmark (current branch).
 * Run: npx tsx scripts/benchmark-discovery-browse.ts
 */
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { browseUnifiedCreators } from "@/lib/creators/unified-browse";

function loadEnv(path: string) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(".env.local");
loadEnv(".env");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env — cannot run live browse benchmark");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const started = performance.now();
  const result = await browseUnifiedCreators(
    supabase,
    { page: 1, pageSize: 50 },
    "benchmark"
  );
  const elapsedMs = Math.round(performance.now() - started);
  const payload = JSON.stringify(result.creators);
  const feedThumbCount = result.creators.reduce(
    (sum, creator) => sum + (creator.recent_publications?.length ?? 0),
    0
  );

  const report = {
    measuredAt: new Date().toISOString(),
    branchNote:
      "Current branch includes slimRecentPublicationsForBrowse feed thumbs in browse payload",
    browseParams: { page: 1, pageSize: 50 },
    elapsedMs,
    creatorCount: result.creators.length,
    total: result.total,
    payloadBytes: Buffer.byteLength(payload, "utf8"),
    payloadKb: Math.round((Buffer.byteLength(payload, "utf8") / 1024) * 10) / 10,
    feedPublicationSlots: feedThumbCount,
    avgPayloadBytesPerCreator:
      result.creators.length > 0
        ? Math.round(Buffer.byteLength(payload, "utf8") / result.creators.length)
        : 0,
  };

  const outDir = "docs/validation-artifacts/discovery-release-readiness";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    `${outDir}/browse-benchmark-current.json`,
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
