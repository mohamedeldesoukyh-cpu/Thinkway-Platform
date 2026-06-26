#!/usr/bin/env node
import "@/lib/performance/script-env-preload";
import { enrichCreatorProfile } from "@/lib/social/enrichment/providers/open-graph";

async function main() {
  for (const handle of ["amiryoussef.official", "yorokfreestyle", "shimasaber8"]) {
    const result = await enrichCreatorProfile({
      platform: handle === "shimasaber8" ? "tiktok" : "instagram",
      username: handle,
      profile_url:
        handle === "shimasaber8"
          ? `https://www.tiktok.com/@${handle}`
          : `https://www.instagram.com/${handle}/`,
    });
    console.log(`\n${handle}:`);
    console.log("  profile_picture_url:", result.profile_picture_url?.slice(0, 100) ?? "NONE");
    console.log("  sync_status:", result.sync_status);
  }
}

main().catch(console.error);
