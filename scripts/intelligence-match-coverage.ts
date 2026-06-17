/**
 * Match confidence coverage simulation — handle + fuzzy name paths.
 * Usage: npx tsx scripts/intelligence-match-coverage.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { bestFuzzyMatch } from "@/lib/intelligence/entity-resolution/fuzzy";
import {
  normalizeHandle,
  normalizeName,
} from "@/lib/intelligence/entity-resolution/normalize";
import { resolveInfluencer } from "@/lib/intelligence/entity-resolution/matchers";

config({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey?.startsWith("eyJ")) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or valid SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAll<T>(
  label: string,
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

async function main() {
  const [warehouse, infRes, handleRes, campaignLinkedRows] = await Promise.all([
    fetchAll("int_influencers", (from, to) =>
      supabase
        .schema("intelligence")
        .from("int_influencers")
        .select("id, display_name_raw, username, match_confidence, country, tier")
        .range(from, to)
    ),
    supabase.from("influencers").select("id, display_name"),
    supabase.from("influencer_platform_accounts").select("influencer_id, handle"),
    fetchAll("int_campaigns", (from, to) =>
      supabase
        .schema("intelligence")
        .from("int_campaigns")
        .select("int_influencer_id")
        .not("int_influencer_id", "is", null)
        .range(from, to)
    ),
  ]);

  if (infRes.error) throw new Error(`influencers: ${infRes.error.message}`);
  if (handleRes.error) throw new Error(`handles: ${handleRes.error.message}`);
  const opsInfluencers = (infRes.data ?? []).map((r) => ({ id: r.id, label: r.display_name }));
  const opsHandles = handleRes.data ?? [];
  const campaignLinkedIds = new Set(
    campaignLinkedRows.map((r) => r.int_influencer_id as string)
  );

  const handleSet = new Set(
    opsHandles.map((h) => normalizeHandle(h.handle)).filter(Boolean)
  );

  const handleMatchIds = new Set<string>();
  for (const row of warehouse) {
    const candidates = [
      normalizeHandle(row.username),
      normalizeHandle(row.display_name_raw?.startsWith("@") ? row.display_name_raw : null),
    ].filter(Boolean);
    if (candidates.some((c) => handleSet.has(c))) {
      handleMatchIds.add(row.id);
    }
  }

  const fuzzyMatchIds = new Set<string>();
  for (const row of warehouse) {
    const match = bestFuzzyMatch(row.display_name_raw, opsInfluencers, 0.84);
    if (match) fuzzyMatchIds.add(row.id);
  }

  const unionMatchIds = new Set([...handleMatchIds, ...fuzzyMatchIds]);
  const overlap = [...handleMatchIds].filter((id) => fuzzyMatchIds.has(id)).length;

  const resolveMatchIds = new Set<string>();
  for (const row of warehouse) {
    const masters = {
      groups: [],
      clients: [],
      brands: [],
      influencers: opsInfluencers.map((i) => ({ id: i.id, name: i.label })),
      handles: opsHandles,
      headers: [],
      lines: [],
      overrides: [],
    };
    const resolved = resolveInfluencer(masters, row.display_name_raw, row.username);
    if (resolved.resolvedInfluencerId) resolveMatchIds.add(row.id);
  }

  const currentMatched = warehouse.filter((r) => Number(r.match_confidence ?? 0) > 0).length;
  const total = warehouse.length;

  const pct = (n: number) => ((n / total) * 100).toFixed(2);

  console.log("\n=== Match Coverage Simulation ===\n");
  console.log(`Warehouse total:              ${total}`);
  console.log(`Current match_confidence > 0: ${currentMatched} (${pct(currentMatched)}%)`);
  console.log(`Path (a) handle exact match:  ${handleMatchIds.size} (${pct(handleMatchIds.size)}%)`);
  console.log(`Path (b) fuzzy name >= 0.84:  ${fuzzyMatchIds.size} (${pct(fuzzyMatchIds.size)}%)`);
  console.log(`Overlap (a ∩ b):              ${overlap}`);
  console.log(`Union (a ∪ b):                ${unionMatchIds.size} (${pct(unionMatchIds.size)}%)`);
  console.log(`resolveInfluencer replay:     ${resolveMatchIds.size} (${pct(resolveMatchIds.size)}%)`);

  const linkedTotal = [...campaignLinkedIds].filter((id) =>
    warehouse.some((w) => w.id === id)
  ).length;
  const linkedUnion = [...unionMatchIds].filter((id) => campaignLinkedIds.has(id)).length;
  console.log(`\nCampaign-linked influencers:  ${linkedTotal}`);
  console.log(`Campaign-linked union match:    ${linkedUnion} (${pct(linkedUnion)}% of warehouse; ${((linkedUnion / linkedTotal) * 100).toFixed(2)}% of linked)`);

  const usernamePresentNoHandle = warehouse.filter((r) => {
    const u = normalizeHandle(r.username);
    return u && !handleSet.has(u);
  }).length;
  const noUsername = warehouse.filter((r) => !normalizeHandle(r.username)).length;
  const usernameWithHandle = warehouse.filter((r) => {
    const u = normalizeHandle(r.username);
    return u && handleSet.has(u);
  }).length;

  console.log("\n=== Failure buckets ===\n");
  console.log(`No username on warehouse row:           ${noUsername} (${pct(noUsername)}%)`);
  console.log(`Username present, no handle in ops:       ${usernamePresentNoHandle} (${pct(usernamePresentNoHandle)}%)`);
  console.log(`Username present, handle exists in ops:   ${usernameWithHandle} (${pct(usernameWithHandle)}%)`);

  const linkedNullUsername = warehouse.filter(
    (r) => campaignLinkedIds.has(r.id) && !normalizeHandle(r.username)
  ).length;
  console.log(`Campaign-linked with null username:      ${linkedNullUsername}`);

  const fuzzyBelowThreshold = warehouse.filter((r) => {
    if (handleMatchIds.has(r.id)) return false;
    const match = bestFuzzyMatch(r.display_name_raw, opsInfluencers, 0);
    return match !== null && match.score < 0.84;
  }).length;
  const fuzzyNoNeedle = warehouse.filter((r) => !r.display_name_raw?.trim()).length;
  console.log(`Display name fuzzy below 0.84 (excl handle hits): ${fuzzyBelowThreshold}`);
  console.log(`Empty display name:                       ${fuzzyNoNeedle}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
