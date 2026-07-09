#!/usr/bin/env node
/**
 * Restore influencers.primary_avatar_url from Creator DNA (no enrichment).
 *
 *   npx tsx scripts/restore-avatars-from-dna.ts --dry-run
 *   npx tsx scripts/restore-avatars-from-dna.ts
 *   npx tsx scripts/restore-avatars-from-dna.ts --limit=200 --offset=0
 */
import "@/lib/performance/script-env-preload";

import { restoreAllInfluencerAvatarsFromDna } from "@/lib/creators/restore-avatar-from-dna";
import {
  createScriptSupabase,
  formatScriptErrorWithDiagnostics,
  parseCliArgs,
  requireScriptEnvVars,
} from "@/lib/performance/script-env";

const args = parseCliArgs(process.argv.slice(2));
const dryRun = Boolean(args["dry-run"]);
const limit = Number(args.limit ?? "500");
const offset = Number(args.offset ?? "0");

async function main() {
  requireScriptEnvVars(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const supabase = createScriptSupabase();

  if (dryRun) {
    console.log(
      `[restore-avatars-from-dna] dry-run — would scan DNA rows ${offset}..${offset + limit - 1}`
    );
    return;
  }

  const result = await restoreAllInfluencerAvatarsFromDna(supabase, { limit, offset });
  console.log(
    `[restore-avatars-from-dna] scanned=${result.scanned} restored=${result.restored} skipped=${result.skipped}`
  );
  if (result.influencerIds.length > 0) {
    console.log(`[restore-avatars-from-dna] restored ids: ${result.influencerIds.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(formatScriptErrorWithDiagnostics(error));
  process.exit(1);
});
