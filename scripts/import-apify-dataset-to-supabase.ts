#!/usr/bin/env node
/**
 * Bulk-import completed Apify dataset/run exports into Supabase without new actor runs.
 *
 * Reads a local JSON export OR fetches stored dataset items via Apify storage API
 * (read-only — does not launch enrichment actors).
 *
 * Run:
 *   npm run import:apify-dataset -- --file=./exports/instagram-profiles.json --platform=instagram
 *   npm run import:apify-dataset -- --dataset-id=abc123XYZ --platform=instagram
 *   npm run import:apify-dataset -- --run-id=run_abc123 --platform=tiktok --upload-avatars
 *   npm run import:apify-dataset -- --file=./export.json --platform=instagram --dry-run --limit=10
 */
import "@/lib/performance/script-env-preload";

import { readFileSync } from "node:fs";
import path from "node:path";

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { groupApifyRowsIntoCreators } from "@/lib/discovery/apify-dataset-grouping";
import { fetchApifyDatasetItems } from "@/lib/discovery/apify-dataset-search";
import { importApifyStoredPayloadWithDnaPipeline } from "@/lib/discovery/apify-import-pipeline";
import { isSocialPlatform, type SocialPlatform } from "@/lib/social/platforms";
import {
  createScriptSupabase,
  formatScriptErrorWithDiagnostics,
  parseCliArgs,
} from "@/lib/performance/script-env";

async function resolveDatasetIdFromRun(runId: string, token: string): Promise<string> {
  const response = await fetch(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Apify run lookup failed (${response.status}): ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    data?: { defaultDatasetId?: string };
  };
  const datasetId = payload.data?.defaultDatasetId;
  if (!datasetId) {
    throw new Error(`Apify run ${runId} has no defaultDatasetId.`);
  }
  return datasetId;
}

function loadRowsFromFile(filePath: string): Record<string, unknown>[] {
  const absolute = path.resolve(filePath);
  const raw = readFileSync(absolute, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (Array.isArray(parsed)) {
    return parsed.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object" && !Array.isArray(row)
    );
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.items)) {
      return obj.items.filter(
        (row): row is Record<string, unknown> =>
          Boolean(row) && typeof row === "object" && !Array.isArray(row)
      );
    }
  }

  throw new Error("JSON file must be an array of Apify items or { items: [...] }.");
}

function cliString(
  args: Record<string, string | boolean>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const file = cliString(args, "file", "f");
  const datasetId = cliString(args, "dataset-id", "dataset");
  const runId = cliString(args, "run-id", "run");
  const platformArg = cliString(args, "platform", "p");
  const dryRun = args["dry-run"] === true;
  const uploadAvatars = args["upload-avatars"] === true;
  const limitRaw = cliString(args, "limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const apifyRunId = cliString(args, "apify-run-id", "run") ?? null;

  if (!file && !datasetId && !runId) {
    console.error(
      "Usage: npm run import:apify-dataset -- --file=./export.json --platform=instagram\n" +
        "   or: npm run import:apify-dataset -- --dataset-id=DATASET_ID --platform=instagram\n" +
        "   or: npm run import:apify-dataset -- --run-id=RUN_ID --platform=tiktok [--upload-avatars] [--dry-run] [--limit=N]"
    );
    process.exit(1);
  }

  if (!platformArg) {
    console.error("--platform is required (instagram | tiktok | youtube).");
    process.exit(1);
  }

  const platformKey = canonicalPlatformKey(platformArg);
  if (!isSocialPlatform(platformKey)) {
    console.error(`Unsupported platform: ${platformArg}`);
    process.exit(1);
  }
  const platform = platformKey as SocialPlatform;

  let rows: Record<string, unknown>[] = [];
  let sourceLabel = "";

  if (file) {
    rows = loadRowsFromFile(file);
    sourceLabel = `file:${path.resolve(file)}`;
  } else {
    const token = process.env.APIFY_TOKEN?.trim();
    if (!token) {
      console.error("APIFY_TOKEN is required for --dataset-id or --run-id (storage read only).");
      process.exit(1);
    }

    const resolvedDatasetId = datasetId ?? (await resolveDatasetIdFromRun(runId!, token));
    rows = await fetchApifyDatasetItems(resolvedDatasetId, token);
    sourceLabel = datasetId
      ? `dataset:${resolvedDatasetId}`
      : `run:${runId}→dataset:${resolvedDatasetId}`;
  }

  const bundles = groupApifyRowsIntoCreators(rows, platform);
  const selected = typeof limit === "number" && Number.isFinite(limit) ? bundles.slice(0, limit) : bundles;

  console.log(
    `[import:apify-dataset] source=${sourceLabel} platform=${platform} rows=${rows.length} creators=${bundles.length} processing=${selected.length} dryRun=${dryRun}`
  );

  if (selected.length === 0) {
    console.error("No creators could be grouped from the export. Check platform and JSON shape.");
    process.exit(1);
  }

  if (dryRun) {
    for (const bundle of selected.slice(0, 20)) {
      console.log(
        `  @${bundle.username} profileRows=${bundle.profileRows.length} postRows=${bundle.postRows.length}`
      );
    }
    if (selected.length > 20) {
      console.log(`  ... and ${selected.length - 20} more`);
    }
    process.exit(0);
  }

  const supabase = createScriptSupabase();
  let imported = 0;
  let merged = 0;
  let failed = 0;

  for (const bundle of selected) {
    try {
      const result = await importApifyStoredPayloadWithDnaPipeline(supabase, {
        platform,
        username: bundle.username,
        profileUrl: bundle.profileUrl,
        profileRows: bundle.profileRows,
        postRows: bundle.postRows,
        apifyRunId,
        uploadAvatar: uploadAvatars,
      });

      if (result.ok) {
        if (result.merged) merged += 1;
        else imported += 1;
        console.log(
          `[ok] @${bundle.username} influencer=${result.influencerId} snapshot=${result.snapshotId} ${result.message}`
        );
      } else {
        failed += 1;
        console.error(`[fail] @${bundle.username} ${result.message}`);
      }
    } catch (error) {
      failed += 1;
      console.error(`[fail] @${bundle.username} ${formatScriptErrorWithDiagnostics(error)}`);
    }
  }

  console.log(
    `\nDone: imported=${imported} merged=${merged} failed=${failed} total=${selected.length}`
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(formatScriptErrorWithDiagnostics(error));
  process.exit(1);
});
