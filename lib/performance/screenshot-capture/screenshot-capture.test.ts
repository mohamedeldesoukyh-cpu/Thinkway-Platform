import { existsSync } from "node:fs";
import path from "node:path";

import { config } from "dotenv";

import { pickApifyPreviewImageUrl } from "@/lib/performance/apify-preview-image";
import { tryApifyThumbnail } from "@/lib/performance/screenshot-capture/providers/apify-thumbnail";
import { getScreenshotCaptureEnv } from "@/lib/performance/screenshot-capture/config";
import { fetchImageBuffer } from "@/lib/performance/screenshot-capture/storage";

const root = process.cwd();
if (existsSync(path.join(root, ".env.local"))) config({ path: path.join(root, ".env.local") });
config({ path: path.join(root, ".env") });
config({ path: path.join(root, "services/discovery-worker/.env") });

const INSTAGRAM_URL =
  process.env.INSTAGRAM_SCREENSHOT_TEST_URL?.trim() ||
  "https://www.instagram.com/p/DXywMywIwgb/";

async function runApifyFieldProbe() {
  const sample = {
    displayUrl: "https://example.com/preview.jpg",
    type: "Video",
  };
  const url = pickApifyPreviewImageUrl(sample);
  if (url !== sample.displayUrl) {
    throw new Error(`pickApifyPreviewImageUrl failed: ${url}`);
  }
  console.log("[screenshot-capture-test] pickApifyPreviewImageUrl ok");
}

async function runInstagramApifyThumbnail() {
  const env = getScreenshotCaptureEnv();
  if (!env.apifyToken) {
    console.log("[screenshot-capture-test] skip Instagram Apify — APIFY_TOKEN not set");
    return;
  }

  const attempt = await tryApifyThumbnail({
    platform: "instagram",
    contentUrl: INSTAGRAM_URL,
    env,
  });

  if (!attempt.imageUrl) {
    throw new Error(`Apify thumbnail failed: ${attempt.error ?? attempt.skippedReason ?? "empty"}`);
  }

  const buffer = await fetchImageBuffer(attempt.imageUrl, { referer: INSTAGRAM_URL });
  if (!buffer?.length) {
    throw new Error("fetchImageBuffer failed for Apify displayUrl");
  }

  console.log(
    "[screenshot-capture-test] instagram apify ok",
    attempt.imageUrl.slice(0, 72),
    `${buffer.length} bytes`
  );
}

async function run() {
  await runApifyFieldProbe();
  await runInstagramApifyThumbnail();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
