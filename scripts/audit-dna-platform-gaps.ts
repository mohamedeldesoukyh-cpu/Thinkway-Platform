/** Audit: DNA vs platform-account metric gaps across full creator_dna table. */
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { parseCreatorDNADocument } from "@/features/creator-dna/services/document-factory";

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
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
  const dnaRows = await fetchAllDna();
  console.log("Total creator_dna rows:", dnaRows.length);

  const gaps: Array<{
    influencer_id: string;
    dnaFollowers: number | null;
    dnaEr: number | null;
    platformFollowers: number | null;
    platformEr: number | null;
    handle: string | null;
  }> = [];

  let dnaHasFollowersPlatformMissing = 0;
  let dnaHasErPlatformMissing = 0;
  let dnaHasAvgNoFollowers = 0;
  let noPlatformAccount = 0;

  for (let i = 0; i < dnaRows.length; i += 100) {
    const chunk = dnaRows.slice(i, i + 100);
    const ids = chunk.map((r) => r.influencer_id);
    const { data: accounts, error } = await supabase
      .from("influencer_platform_accounts")
      .select("influencer_id, platform, handle, follower_count, engagement_rate, avg_likes, avg_comments")
      .in("influencer_id", ids);
    if (error) throw new Error(error.message);

    const byInfluencer = new Map<string, typeof accounts>();
    for (const account of accounts ?? []) {
      const list = byInfluencer.get(account.influencer_id) ?? [];
      list.push(account);
      byInfluencer.set(account.influencer_id, list);
    }

    for (const row of chunk) {
      const doc = parseCreatorDNADocument(row.document);
      const dnaFollowers = doc.metrics.followers.value;
      const dnaEr = doc.metrics.engagementRate.value;
      const dnaAvgLikes = doc.metrics.avgLikes.value;
      const dnaAvgComments = doc.metrics.avgComments.value;
      const platformList = byInfluencer.get(row.influencer_id) ?? [];

      if (platformList.length === 0) {
        if (positive(dnaFollowers) || positive(dnaEr)) noPlatformAccount++;
        continue;
      }

      const dnaPlatform = doc.identity.platform.value;
      const primary =
        platformList.find((p) => p.platform === dnaPlatform) ?? platformList[0] ?? null;

      const pf = primary?.follower_count ?? null;
      const pe = primary?.engagement_rate ?? null;

      if (positive(dnaFollowers) && !positive(pf)) dnaHasFollowersPlatformMissing++;
      if (positive(dnaEr) && !positive(pe)) dnaHasErPlatformMissing++;
      if (
        (positive(dnaAvgLikes) || positive(dnaAvgComments)) &&
        !positive(dnaFollowers) &&
        !positive(pf)
      ) {
        dnaHasAvgNoFollowers++;
      }

      if (
        (positive(dnaFollowers) && !positive(pf)) ||
        (positive(dnaEr) && !positive(pe))
      ) {
        gaps.push({
          influencer_id: row.influencer_id,
          dnaFollowers: dnaFollowers ?? null,
          dnaEr: dnaEr ?? null,
          platformFollowers: pf,
          platformEr: pe,
          handle: primary?.handle ?? null,
        });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        dnaHasFollowersPlatformMissing,
        dnaHasErPlatformMissing,
        dnaHasAvgNoFollowers,
        noPlatformAccount,
        sampleGaps: gaps.slice(0, 15),
      },
      null,
      2
    )
  );

  const { count: nullFollowers } = await supabase
    .from("influencer_platform_accounts")
    .select("id", { count: "exact", head: true })
    .is("follower_count", null);
  const { count: totalAccounts } = await supabase
    .from("influencer_platform_accounts")
    .select("id", { count: "exact", head: true });

  console.log("Platform accounts:", { totalAccounts, nullFollowers });
}

main().catch(console.error);
