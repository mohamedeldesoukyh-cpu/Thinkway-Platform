/**
 * Before/after measurement for avatar + publication-preview request path.
 *
 * Usage:
 *   npx tsx scripts/measure-media-proxy.ts
 *
 * Simulates a creator grid fan-out against the fail-fast resolvers (no HTTP auth).
 * Reports latency percentiles, cache hit rate, external request count, and placeholder rate.
 *
 * Optional live CDN probe (counts as external):
 *   MEDIA_PROXY_LIVE_CDN=1 MEDIA_PROXY_CDN_URL=https://... npx tsx scripts/measure-media-proxy.ts
 */
import {
  resolveCreatorAvatarForHttpRequest,
} from "@/lib/creators/creator-avatar-proxy";
import {
  resolvePublicationPreviewForHttpRequest,
} from "@/lib/creators/publication-preview-proxy";
import {
  getMediaProxyMetrics,
  mediaProxyCacheKey,
  resetMediaProxyMetricsForTests,
  setMediaProxyCachePositive,
} from "@/lib/creators/media-proxy-cache";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

function summarize(latenciesMs: number[]) {
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

async function timeMs(fn: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

function warmHalfGrid(gridSize: number, kind: "avatar" | "preview") {
  const tiny = new Uint8Array([1, 2, 3, 4]).buffer;
  const half = Math.floor(gridSize / 2);
  for (let i = 0; i < half; i++) {
    if (kind === "avatar") {
      const src = `https://scontent.cdninstagram.com/v/measure-avatar-${i}.jpg`;
      setMediaProxyCachePositive(
        mediaProxyCacheKey({ kind: "avatar", src, profileUrl: null }),
        tiny,
        "image/jpeg"
      );
    } else {
      setMediaProxyCachePositive(
        mediaProxyCacheKey({
          kind: "preview",
          src: `https://scontent.cdninstagram.com/v/measure-preview-${i}.jpg`,
          postUrl: null,
        }),
        tiny,
        "image/jpeg"
      );
    }
  }
}

async function runGrid(
  label: string,
  resolveOne: (i: number) => Promise<{ ok: boolean }>,
  count: number,
  warm: () => void
) {
  resetMediaProxyMetricsForTests();
  warm();
  resetMediaProxyMetricsForTests({ clearCache: false });

  const latencies: number[] = [];
  let okCount = 0;
  let failCount = 0;

  const gridStart = performance.now();
  await Promise.all(
    Array.from({ length: count }, async (_, i) => {
      const ms = await timeMs(async () => {
        const result = await resolveOne(i);
        if (result.ok) okCount += 1;
        else failCount += 1;
      });
      latencies.push(ms);
    })
  );
  const gridMs = performance.now() - gridStart;
  const metrics = getMediaProxyMetrics();
  const lookups = metrics.hits + metrics.misses + metrics.negativeHits;
  const hitRate =
    lookups === 0 ? 0 : (metrics.hits + metrics.negativeHits) / lookups;

  return {
    label,
    gridCount: count,
    gridRenderMs: Math.round(gridMs),
    latency: summarize(latencies.map((n) => Math.round(n * 100) / 100)),
    okCount,
    failCount,
    failedImageRate: count === 0 ? 0 : failCount / count,
    cacheHitRate: Math.round(hitRate * 1000) / 1000,
    externalRequests: metrics.externalRequests,
    metrics,
  };
}

async function main() {
  const gridSize = Number(process.env.MEDIA_PROXY_GRID_SIZE ?? "48");

  console.log("--- Media proxy (avatar / publication preview) measurement ---");
  console.log(`gridSize=${gridSize}`);

  const avatarWarm = await runGrid(
    "avatar_request_path_half_cached",
    async (i) => {
      const src = `https://scontent.cdninstagram.com/v/measure-avatar-${i}.jpg`;
      // Uncached indices: profile-only miss (no CDN fetch) → instant placeholder.
      if (i < Math.floor(gridSize / 2)) {
        return resolveCreatorAvatarForHttpRequest({ src });
      }
      return resolveCreatorAvatarForHttpRequest({
        src: null,
        profileUrl: `https://www.instagram.com/creator_${i}/`,
      });
    },
    gridSize,
    () => warmHalfGrid(gridSize, "avatar")
  );

  const previewWarm = await runGrid(
    "preview_request_path_half_cached",
    async (i) => {
      if (i < Math.floor(gridSize / 2)) {
        return resolvePublicationPreviewForHttpRequest({
          src: `https://scontent.cdninstagram.com/v/measure-preview-${i}.jpg`,
        });
      }
      return resolvePublicationPreviewForHttpRequest({
        src: null,
        postUrl: `https://www.instagram.com/p/measure_${i}/`,
      });
    },
    gridSize,
    () => warmHalfGrid(gridSize, "preview")
  );

  let liveCdn: Record<string, unknown> | null = null;
  if (process.env.MEDIA_PROXY_LIVE_CDN === "1" && process.env.MEDIA_PROXY_CDN_URL) {
    const url = process.env.MEDIA_PROXY_CDN_URL;
    resetMediaProxyMetricsForTests();
    const ms = await timeMs(() =>
      resolvePublicationPreviewForHttpRequest({ src: url })
    );
    const second = await timeMs(() =>
      resolvePublicationPreviewForHttpRequest({ src: url })
    );
    liveCdn = {
      url,
      firstMs: Math.round(ms),
      secondCachedMs: Math.round(second),
      metrics: getMediaProxyMetrics(),
    };
  }

  console.log(
    JSON.stringify(
      {
        avatar: avatarWarm,
        publicationPreview: previewWarm,
        liveCdn,
        notes: [
          "Request path never scrapes HTML / oEmbed / OpenGraph.",
          "Uncached profile/post-only rows return 404 placeholders instantly (needsRefresh).",
          "Exports still use fetchCreatorAvatarImage / fetchPublicationPreviewImage (full path).",
          "Compare gridRenderMs + latency p95 + externalRequests before/after deploy.",
        ],
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
