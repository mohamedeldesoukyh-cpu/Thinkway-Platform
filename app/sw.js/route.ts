import { getReleaseInfo } from "@/lib/release/release-info";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Service worker served dynamically so each deploy changes the script bytes
 * (build id comment) and triggers the browser update lifecycle.
 */
export function GET() {
  const release = getReleaseInfo();
  const buildId = `${release.version}+${release.build}`;

  const body = `/* Thinkway Platform SW ${buildId} */
/* Network-only — no stale asset cache. */
const BUILD_ID = ${JSON.stringify(buildId)};

self.addEventListener("install", (event) => {
  // Do not auto skipWaiting on update; client prompts the user first.
  // First install still reaches "waiting" until SKIP_WAITING or activate.
  void BUILD_ID;
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
