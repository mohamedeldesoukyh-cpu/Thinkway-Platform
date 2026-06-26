#!/usr/bin/env npx tsx
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
if (existsSync(path.join(root, ".env.local"))) config({ path: path.join(root, ".env.local") });
config({ path: path.join(root, ".env") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Missing env");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const campaignId = "20374f67-1c2f-4df0-b999-124a8d506c3c";

async function main() {
  const { data: pubs, error } = await supabase
    .from("campaign_publications")
    .select(
      "id, platform, content_url, views, likes, comments, metrics_refresh_status, thumbnail_url, influencer_id, engagement_views, engagement_likes, engagement_comments, metrics_provider"
    )
    .eq("campaign_header_id", campaignId);

  if (error) throw error;

  const influencerIds = [...new Set((pubs ?? []).map((p) => p.influencer_id).filter(Boolean))] as string[];
  const { data: influencers } = await supabase
    .from("influencers")
    .select("id, display_name")
    .in("id", influencerIds);

  const names = new Map((influencers ?? []).map((i) => [i.id, i.display_name]));

  const { data: accounts } = await supabase
    .from("influencer_platform_accounts")
    .select("influencer_id, platform, profile_picture_url")
    .in("influencer_id", influencerIds);

  console.log("=== RELEVANT PUBLICATIONS ===");
  for (const p of pubs ?? []) {
    const name = names.get(p.influencer_id) ?? "unknown";
    if (/hussein|shimaa/i.test(name) || p.platform === "tiktok") {
      console.log(JSON.stringify({ name, ...p }, null, 2));
    }
  }

  console.log("\n=== PLATFORM ACCOUNTS ===");
  for (const a of accounts ?? []) {
    const name = names.get(a.influencer_id) ?? "unknown";
    if (/shimaa/i.test(name)) {
      console.log(JSON.stringify({ name, ...a }, null, 2));
    }
  }

  const relevantIds = (pubs ?? [])
    .filter((p) => {
      const name = names.get(p.influencer_id) ?? "";
      return /hussein|shimaa/i.test(name) || p.platform === "tiktok";
    })
    .map((p) => p.id);

  if (relevantIds.length > 0) {
    const { data: logs } = await supabase
      .from("publication_metric_sync_logs")
      .select(
        "publication_id, provider, status, metrics_snapshot, response_summary, created_at"
      )
      .in("publication_id", relevantIds)
      .order("created_at", { ascending: false })
      .limit(20);

    console.log("\n=== RECENT SYNC LOGS ===");
    console.log(JSON.stringify(logs, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
