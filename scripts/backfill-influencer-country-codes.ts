/**
 * Backfill influencers.country_codes from existing DB signals (no Apify).
 *
 *   npm run backfill:influencer-country-codes -- --dry-run
 *   npm run backfill:influencer-country-codes -- --recent-days=30 --missing-only --added-via-url
 *   npm run backfill:influencer-country-codes -- --id=UUID
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- ops script */
import { createClient } from "@supabase/supabase-js";

import { backfillInfluencerCountryCodes } from "@/lib/creators/country-backfill";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey?.startsWith("eyJ")) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or valid SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}) as any;

function argValue(name: string): string | undefined {
  const hit = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}

function argNumber(name: string, fallback: number): number {
  const raw = argValue(name);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const limit = argNumber("--limit", Number.POSITIVE_INFINITY);
  const batchSize = argNumber("--batch-size", 100);
  const influencerId = argValue("--id");
  const recentDays = argValue("--recent-days");
  const missingOnly = hasFlag("--missing-only");
  const addedViaProfileUrl = hasFlag("--added-via-url");

  console.log(
    `Backfilling influencer country_codes from existing data${
      dryRun ? " (dry run)" : ""
    }…`
  );
  if (recentDays) console.log(`  filter: created within ${recentDays} days`);
  if (missingOnly) console.log("  filter: missing country data only");
  if (addedViaProfileUrl) console.log("  filter: Added via Discovery profile link");

  const report = await backfillInfluencerCountryCodes(supabase, {
    dryRun,
    batchSize,
    influencerId,
    limit: Number.isFinite(limit) ? limit : undefined,
    recentDays: recentDays ? Number(recentDays) : undefined,
    missingOnly,
    addedViaProfileUrl,
    onProgress: ({ scanned, updated, unchanged, noSignal }) => {
      console.log(
        `  progress scanned=${scanned} updated=${updated} unchanged=${unchanged} noSignal=${noSignal}`
      );
    },
  });

  console.log("\nDone.");
  console.log(`  scanned:   ${report.scanned}`);
  console.log(`  updated:   ${report.updated}${report.dryRun ? " (dry run)" : ""}`);
  console.log(`  unchanged: ${report.unchanged}`);
  console.log(`  no signal: ${report.noSignal}`);
  console.log(`  skipped:   ${report.skipped}`);
  if (report.dryRun) {
    console.log("\nRe-run without --dry-run to persist changes.");
  }
}

main().catch((error) => {
  console.error("BACKFILL FAILED:", error);
  process.exit(1);
});
