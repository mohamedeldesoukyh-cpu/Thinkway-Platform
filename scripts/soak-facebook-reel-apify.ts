import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import { detectPublicationPlatform } from "@/lib/performance/metrics-collector/detect-platform";
import { tryApifyProvider } from "@/lib/performance/metrics-collector/providers/apify";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
if (existsSync(path.join(root, ".env"))) config({ path: path.join(root, ".env") });
if (existsSync(path.join(root, ".env.local"))) config({ path: path.join(root, ".env.local") });

async function main() {
  const url = process.argv[2]?.trim() || "https://www.facebook.com/reel/1849794332663999";
  const env = getMetricsCollectorEnv();
  console.log("actor", env.apifyFacebookActorId);

  const detection = detectPublicationPlatform({
    id: "soak",
    campaign_header_id: "soak",
    platform: "facebook",
    content_url: url,
    external_media_id: null,
    publication_type: "facebook_reel",
  });

  const result = await tryApifyProvider({
    publication: { content_url: url },
    platform: detection.platform,
    contentUrl: url,
    env,
  });

  console.log(
    JSON.stringify(
      {
        error: result.error ?? null,
        errorCode: result.errorCode ?? null,
        metrics: result.metrics ?? null,
        publicationDate: result.publicationDate ?? null,
        responseSummary: result.responseSummary ?? null,
      },
      null,
      2
    )
  );

  if (!result.metrics) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
