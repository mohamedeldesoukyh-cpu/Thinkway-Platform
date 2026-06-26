#!/usr/bin/env node
/**
 * One-off audit: list discovery + internal creators for demo/seed classification.
 * Run: npx tsx scripts/audit-discovery-creators.ts
 */
import "@/lib/performance/script-env-preload";

import { writeFileSync } from "node:fs";
import path from "node:path";

import { createScriptSupabase } from "@/lib/performance/script-env";

type Category =
  | "imported_real"
  | "seed_data"
  | "demo_data"
  | "test_data"
  | "unknown";

type AuditRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  source: string | null;
  created_at: string;
  imported_from: string | null;
  discovery_source: string | null;
  follower_count: number | null;
  entity: "influencer" | "discovered_profile";
  category: Category;
  category_reason: string;
};

const MOCK_USERNAME_RE = /^tw_[a-z]+_[a-z]{2}_\d{2}$/i;
const FAKE_USERNAME_PATTERNS = [
  /^test[_-]?/i,
  /^demo[_-]?/i,
  /test_user/i,
  /demo_creator/i,
  /john_doe/i,
  /\.example$/i,
  /@creator\.mail$/i,
  /^mayastyles$/i,
  /^alex@creator\.example$/i,
];

function isFakeUsername(username: string | null): boolean {
  if (!username) return false;
  if (MOCK_USERNAME_RE.test(username)) return true;
  return FAKE_USERNAME_PATTERNS.some((re) => re.test(username));
}

function isMockMetadata(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata) return false;
  const source = String(metadata.source ?? "");
  if (source === "mock_seed") return true;
  if (metadata.seed_reason != null || metadata.seed_method != null) return true;
  return false;
}

function classifyInfluencer(row: {
  id: string;
  display_name: string;
  email: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  has_import_source: boolean;
  import_source_name: string | null;
  import_file_id: string | null;
  username: string | null;
  profile_url: string | null;
  follower_count: number | null;
  has_platform_account: boolean;
}): { category: Category; reason: string } {
  if (row.has_import_source && row.import_file_id) {
    return { category: "imported_real", reason: `creator_sources import (${row.import_source_name})` };
  }

  const email = row.email ?? "";
  const notes = row.notes ?? "";
  if (email.endsWith(".example") || notes.includes("Seed") || notes.includes("seed")) {
    return { category: "seed_data", reason: "seed.sql pattern (example email or seed notes)" };
  }
  if (row.display_name === "Maya Styles" || row.display_name === "Alex Chen") {
    return { category: "seed_data", reason: "seed.sql commented demo influencers" };
  }

  if (isFakeUsername(row.username)) {
    return { category: "demo_data", reason: `fake username pattern: ${row.username}` };
  }

  if (!row.has_platform_account) {
    return { category: "unknown", reason: "no platform accounts" };
  }

  if (!row.profile_url && !row.username) {
    return { category: "unknown", reason: "missing profile URL and username" };
  }

  if (row.has_import_source && !row.import_file_id) {
    return { category: "unknown", reason: "creator_sources without import file" };
  }

  return { category: "imported_real", reason: "manual/internal vendor record" };
}

function classifyDiscoveredProfile(row: {
  id: string;
  username: string;
  display_name: string | null;
  profile_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  influencer_id: string | null;
  follower_count: number | null;
  discovery_methods: string[];
}): { category: Category; reason: string } {
  if (isMockMetadata(row.metadata)) {
    return { category: "demo_data", reason: "metadata.source=mock_seed (discovery worker fallback)" };
  }

  if (isFakeUsername(row.username)) {
    return { category: "demo_data", reason: `tw_ mock username pattern: ${row.username}` };
  }

  if (row.display_name && row.metadata?.seed_reason) {
    return { category: "demo_data", reason: "seed_reason in metadata" };
  }

  if (!row.profile_url?.trim()) {
    return { category: "unknown", reason: "missing profile_url" };
  }

  if (row.influencer_id) {
    return { category: "imported_real", reason: "promoted to influencer" };
  }

  return { category: "unknown", reason: "organic discovery profile (needs manual review)" };
}

async function main() {
  const supabase = createScriptSupabase();
  const rows: AuditRow[] = [];

  const { data: influencers, error: infErr } = await supabase
    .from("influencers")
    .select(
      "id, display_name, email, notes, metadata, created_at, influencer_platform_accounts(id, username, handle, profile_url, follower_count)"
    );

  if (infErr) throw new Error(`influencers: ${infErr.message}`);

  const { data: creatorSources, error: csErr } = await supabase
    .from("creator_sources")
    .select("influencer_id, source_name, source_file_id");

  if (csErr) throw new Error(`creator_sources: ${csErr.message}`);

  const sourceByInfluencer = new Map<
    string,
    { source_name: string; source_file_id: string | null }
  >();
  for (const cs of creatorSources ?? []) {
    sourceByInfluencer.set(cs.influencer_id, {
      source_name: cs.source_name,
      source_file_id: cs.source_file_id,
    });
  }

  for (const inf of influencers ?? []) {
    const accounts = (inf.influencer_platform_accounts ?? []) as Array<{
      id: string;
      username: string | null;
      handle: string;
      profile_url: string | null;
      follower_count: number | null;
    }>;
    const primary = accounts.find((a) => a.username || a.handle) ?? accounts[0];
    const cs = sourceByInfluencer.get(inf.id);
    const { category, reason } = classifyInfluencer({
      id: inf.id,
      display_name: inf.display_name,
      email: inf.email,
      notes: inf.notes,
      metadata: (inf.metadata as Record<string, unknown>) ?? {},
      created_at: inf.created_at,
      has_import_source: Boolean(cs),
      import_source_name: cs?.source_name ?? null,
      import_file_id: cs?.source_file_id ?? null,
      username: primary?.username ?? primary?.handle ?? null,
      profile_url: primary?.profile_url ?? null,
      follower_count: primary?.follower_count ?? null,
      has_platform_account: accounts.length > 0,
    });

    rows.push({
      id: inf.id,
      username: primary?.username ?? primary?.handle ?? null,
      full_name: inf.display_name,
      source: cs?.source_name ?? (inf.metadata as Record<string, unknown>)?.source?.toString() ?? "internal",
      created_at: inf.created_at,
      imported_from: cs?.source_file_id ?? null,
      discovery_source: null,
      follower_count: primary?.follower_count ?? null,
      entity: "influencer",
      category,
      category_reason: reason,
    });
  }

  const { data: profiles, error: dpErr } = await supabase
    .from("discovered_profiles")
    .select("id, username, display_name, profile_url, metadata, created_at, influencer_id");

  if (dpErr) throw new Error(`discovered_profiles: ${dpErr.message}`);

  const profileIds = (profiles ?? []).map((p) => p.id);
  const metricsByProfile = new Map<string, number>();
  if (profileIds.length > 0) {
    const { data: metrics, error: mErr } = await supabase
      .from("profile_metrics")
      .select("profile_id, followers, captured_at")
      .in("profile_id", profileIds)
      .order("captured_at", { ascending: false });
    if (mErr) throw new Error(`profile_metrics: ${mErr.message}`);
    for (const m of metrics ?? []) {
      if (!metricsByProfile.has(m.profile_id)) {
        metricsByProfile.set(m.profile_id, m.followers);
      }
    }
  }

  const discoverySourcesByProfile = new Map<string, string[]>();
  if (profileIds.length > 0) {
    const { data: ds, error: dsErr } = await supabase
      .from("discovery_sources")
      .select("profile_id, method")
      .in("profile_id", profileIds);
    if (dsErr) throw new Error(`discovery_sources: ${dsErr.message}`);
    for (const d of ds ?? []) {
      const list = discoverySourcesByProfile.get(d.profile_id) ?? [];
      list.push(d.method);
      discoverySourcesByProfile.set(d.profile_id, list);
    }
  }

  for (const p of profiles ?? []) {
    const methods = discoverySourcesByProfile.get(p.id) ?? [];
    const { category, reason } = classifyDiscoveredProfile({
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      profile_url: p.profile_url,
      metadata: (p.metadata as Record<string, unknown>) ?? {},
      created_at: p.created_at,
      influencer_id: p.influencer_id,
      follower_count: metricsByProfile.get(p.id) ?? null,
      discovery_methods: methods,
    });

    const metaSource = (p.metadata as Record<string, unknown>)?.source;

    rows.push({
      id: p.id,
      username: p.username,
      full_name: p.display_name,
      source: metaSource != null ? String(metaSource) : "public_discovery",
      created_at: p.created_at,
      imported_from: null,
      discovery_source: methods.length ? methods.join(",") : null,
      follower_count: metricsByProfile.get(p.id) ?? null,
      entity: "discovered_profile",
      category,
      category_reason: reason,
    });
  }

  const counts = {
    imported_real: 0,
    seed_data: 0,
    demo_data: 0,
    test_data: 0,
    unknown: 0,
  };
  for (const r of rows) counts[r.category] += 1;

  const toDelete = rows.filter(
    (r) =>
      (r.category === "seed_data" ||
        r.category === "demo_data" ||
        r.category === "test_data") &&
      !(r.entity === "influencer" && r.imported_from)
  );

  const outPath = path.join(process.cwd(), ".tmp", "discovery-creator-audit.json");
  writeFileSync(
    outPath,
    JSON.stringify({ counts, rows, toDelete, generated_at: new Date().toISOString() }, null, 2)
  );

  console.log(JSON.stringify({ counts, total: rows.length, toDeleteCount: toDelete.length, outPath }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
