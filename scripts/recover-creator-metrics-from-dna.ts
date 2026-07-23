/**
 * One-time recovery: backfill influencer_platform_accounts from creator_dna documents.
 *
 * Usage:
 *   npx tsx scripts/recover-creator-metrics-from-dna.ts --dry-run
 *   npx tsx scripts/recover-creator-metrics-from-dna.ts --execute
 *   npx tsx scripts/recover-creator-metrics-from-dna.ts --dry-run --handles square_stock,hgabr
 */
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { parseCreatorDNADocument } from "@/features/creator-dna/services/document-factory";
import { overlayPlatformMetricsFromDna } from "@/lib/creators/dna-browse-hydration";
import type { UnifiedCreatorPlatform } from "@/lib/creators/types";

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

const args = process.argv.slice(2);
const dryRun = !args.includes("--execute");
const handlesArg = args.find((a) => a.startsWith("--handles="));
const handleFilter = handlesArg
  ? new Set(handlesArg.replace("--handles=", "").split(",").map((h) => h.trim().toLowerCase()))
  : null;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function patchIfBetter(
  existing: number | null | undefined,
  incoming: number | null | undefined
): number | null | undefined {
  if (!positive(incoming)) return undefined;
  if (existing == null || existing <= 0) return incoming;
  return undefined;
}

async function fetchAllDna() {
  const rows: Array<{ influencer_id: string; document: unknown }> = [];
  let offset = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("creator_dna")
      .select("influencer_id, document")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function main() {
  console.log(dryRun ? "DRY RUN — no writes" : "EXECUTE — writing updates");
  const dnaRows = await fetchAllDna();
  console.log("Loaded creator_dna rows:", dnaRows.length);

  let candidates = 0;
  let wouldUpdate = 0;
  let updated = 0;
  const samples: Array<Record<string, unknown>> = [];

  for (let i = 0; i < dnaRows.length; i += 100) {
    const chunk = dnaRows.slice(i, i + 100);
    const ids = chunk.map((r) => r.influencer_id);
    const { data: accounts, error } = await supabase
      .from("influencer_platform_accounts")
      .select("id, influencer_id, platform, handle, follower_count, engagement_rate, avg_likes, avg_comments, avg_views")
      .in("influencer_id", ids);
    if (error) throw new Error(error.message);

    const byInfluencer = new Map<string, NonNullable<typeof accounts>>();
    for (const account of accounts ?? []) {
      const list = byInfluencer.get(account.influencer_id) ?? [];
      list.push(account);
      byInfluencer.set(account.influencer_id, list);
    }

    for (const row of chunk) {
      const document = parseCreatorDNADocument(row.document);
      const platformList = byInfluencer.get(row.influencer_id) ?? [];
      if (platformList.length === 0) continue;

      if (handleFilter) {
        const match = platformList.some((p) => handleFilter.has((p.handle ?? "").toLowerCase()));
        if (!match) continue;
      }

      const unifiedPlatforms: UnifiedCreatorPlatform[] = platformList.map((p) => ({
        id: p.id,
        platform: p.platform,
        handle: p.handle,
        profile_url: null,
        follower_count: p.follower_count,
        engagement_rate: p.engagement_rate,
        avg_likes: p.avg_likes,
        avg_comments: p.avg_comments,
        avg_views: p.avg_views,
        audience_country: null,
        is_verified: false,
      }));

      const hydrated = overlayPlatformMetricsFromDna(unifiedPlatforms, document);
      for (const platform of hydrated) {
        const existing = platformList.find((p) => p.id === platform.id);
        if (!existing) continue;

        const patch: Record<string, number> = {};
        const followerPatch = patchIfBetter(existing.follower_count, platform.follower_count);
        const erPatch = patchIfBetter(existing.engagement_rate, platform.engagement_rate);
        const avgLikesPatch = patchIfBetter(existing.avg_likes, platform.avg_likes);
        const avgCommentsPatch = patchIfBetter(existing.avg_comments, platform.avg_comments);
        const avgViewsPatch = patchIfBetter(existing.avg_views, platform.avg_views);

        if (followerPatch != null) patch.follower_count = followerPatch;
        if (erPatch != null) patch.engagement_rate = erPatch;
        if (avgLikesPatch != null) patch.avg_likes = avgLikesPatch;
        if (avgCommentsPatch != null) patch.avg_comments = avgCommentsPatch;
        if (avgViewsPatch != null) patch.avg_views = avgViewsPatch;

        if (Object.keys(patch).length === 0) continue;
        candidates++;
        wouldUpdate++;

        if (samples.length < 20) {
          samples.push({
            handle: existing.handle,
            influencer_id: row.influencer_id,
            account_id: existing.id,
            before: {
              follower_count: existing.follower_count,
              engagement_rate: existing.engagement_rate,
              avg_likes: existing.avg_likes,
            },
            after: patch,
          });
        }

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from("influencer_platform_accounts")
            .update({ ...patch, updated_at: new Date().toISOString() } as never)
            .eq("id", existing.id);
          if (updateError) {
            console.error("Update failed", existing.id, updateError.message);
          } else {
            updated++;
          }
        }
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? "dry-run" : "execute",
        candidates,
        wouldUpdate,
        updated,
        samples,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
