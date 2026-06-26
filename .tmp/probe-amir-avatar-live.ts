#!/usr/bin/env node
import "@/lib/performance/script-env-preload";
import { createScriptSupabase } from "@/lib/performance/script-env";
import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import { tryApifyProvider } from "@/lib/performance/metrics-collector/providers/apify";
import { pickApifyAuthorAvatarUrl } from "@/lib/performance/apify-author-avatar";

const PUB_ID = "02e7e3eb-649c-426a-88e6-6c456dcf541a"; // Amir Youssef IG

async function main() {
  const supabase = createScriptSupabase();
  const { data: pub } = await supabase
    .from("campaign_publications")
    .select("id, content_url, platform, publication_type")
    .eq("id", PUB_ID)
    .single();

  if (!pub?.content_url) throw new Error("no pub");

  const env = getMetricsCollectorEnv();
  if (!env.apifyToken) throw new Error("no apify token");

  const result = await tryApifyProvider({
    publication: { content_url: pub.content_url },
    platform: "instagram",
    contentUrl: pub.content_url,
    env,
  });

  console.log("authorAvatarUrl:", result.responseSummary?.authorAvatarUrl ?? "MISSING");
  console.log("summary keys:", Object.keys(result.responseSummary ?? {}));

  // Dump avatar-related keys from raw payload if we can re-fetch
  const runResponse = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(env.apifyInstagramActorId!)}/run-sync-get-dataset-items?token=${env.apifyToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directUrls: [pub.content_url], resultsType: "posts", resultsLimit: 1 }),
      signal: AbortSignal.timeout(120_000),
    }
  );
  const items = (await runResponse.json()) as unknown[];
  const row = items[0] as Record<string, unknown>;
  const avatarKeys = Object.entries(row ?? {}).filter(([k, v]) => {
    const lk = k.toLowerCase();
    return (
      lk.includes("avatar") ||
      lk.includes("profilepic") ||
      lk.includes("profile_pic") ||
      lk.includes("owner")
    );
  });
  console.log("\nAvatar-related top-level keys:");
  for (const [k, v] of avatarKeys) {
    console.log(`  ${k}:`, typeof v === "string" ? v.slice(0, 100) : JSON.stringify(v)?.slice(0, 200));
  }
  const owner = row?.owner as Record<string, unknown> | undefined;
  if (owner) {
    console.log("\nowner keys:", Object.keys(owner));
    for (const [k, v] of Object.entries(owner)) {
      if (k.toLowerCase().includes("pic") || k.toLowerCase().includes("avatar")) {
        console.log(`  owner.${k}:`, v);
      }
    }
  }
  console.log("\npickApifyAuthorAvatarUrl:", pickApifyAuthorAvatarUrl("instagram", row));
}

main().catch(console.error);
