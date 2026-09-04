import { getReleaseInfo } from "@/lib/release/release-info";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Service worker served dynamically so each deploy changes the script bytes
 * (build id comment) and triggers the browser update lifecycle.
 *
 * Intentionally does NOT intercept fetch. A prior `respondWith(fetch())`
 * broke Dig pages when Vercel Deployment Protection / SSO rejected the
 * worker's credential-less subresource fetches (FetchEvent network error).
 */
export function GET() {
  const release = getReleaseInfo();
  const buildId = `${release.version}+${release.build}`;

  const body = `/* Thinkway Platform SW ${buildId} */
/* Update beacon only — do not intercept network. */
const BUILD_ID = ${JSON.stringify(buildId)};

self.addEventListener("install", () => {
  void BUILD_ID;
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
