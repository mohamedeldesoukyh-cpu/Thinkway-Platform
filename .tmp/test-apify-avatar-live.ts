#!/usr/bin/env node
import "@/lib/performance/script-env-preload";
import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import { tryApifyProvider } from "@/lib/performance/metrics-collector/providers/apify";
import { pickApifyAuthorAvatarUrl } from "@/lib/performance/apify-author-avatar";

const TESTS = [
  { platform: "instagram", url: "https://www.instagram.com/reel/DBwYpV0xK9a/" },
  { platform: "tiktok", url: "https://www.tiktok.com/@apifyoffice/video/7200360993149553925" },
];

async function main() {
  const env = getMetricsCollectorEnv();
  if (!env.apifyToken) {
    console.error("APIFY_TOKEN missing");
    process.exit(1);
  }

  for (const test of TESTS) {
    console.log(`\n=== ${test.platform} ===`);
    console.log(`URL: ${test.url}`);
    const result = await tryApifyProvider({
      publication: { content_url: test.url },
      platform: test.platform,
      contentUrl: test.url,
      env,
    });
    console.log(`metrics: ${result.metrics ? "yes" : "no"} error: ${result.error ?? "none"}`);
    const avatar = result.responseSummary?.authorAvatarUrl;
    console.log(`responseSummary.authorAvatarUrl: ${avatar ?? "MISSING"}`);

    if (result.requestPayload) {
      // Raw probe for avatar field names
      const actorId =
        test.platform === "tiktok" ? env.apifyTikTokActorId : env.apifyInstagramActorId;
      const input =
        test.platform === "tiktok"
          ? { postURLs: [test.url], resultsPerPage: 1, shouldDownloadVideos: false, shouldDownloadCovers: false }
          : { directUrls: [test.url], resultsLimit: 1 };
      const probe = await fetch(
        `https://api.apify.com/v2/acts/${encodeURIComponent(actorId!)}/run-sync-get-dataset-items?token=${env.apifyToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(120_000),
        }
      );
      const items = (await probe.json()) as unknown[];
      const row = items[0] as Record<string, unknown> | undefined;
      if (row) {
        const avatarKeys = Object.keys(row).filter((k) =>
          /avatar|profile|owner|author/i.test(k)
        );
        console.log("avatar-related keys:", avatarKeys.join(", ") || "(none)");
        const picked = pickApifyAuthorAvatarUrl(test.platform, row);
        console.log("pickApifyAuthorAvatarUrl:", picked ?? "null");
        if (!picked) {
          console.log("owner:", JSON.stringify(row.owner)?.slice(0, 200));
          console.log("authorMeta:", JSON.stringify(row.authorMeta)?.slice(0, 200));
        }
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
