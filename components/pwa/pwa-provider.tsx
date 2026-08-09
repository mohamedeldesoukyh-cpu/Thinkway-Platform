"use client";

import { useEffect } from "react";

import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { PwaSplash } from "@/components/pwa/pwa-splash";
import { PwaUpdatePrompt } from "@/components/pwa/pwa-update-prompt";
import { getReleaseInfo } from "@/lib/release/release-info";

function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const { protocol, hostname } = window.location;
  const isLocal =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  if (protocol !== "https:" && !isLocal) return;

  const release = getReleaseInfo();
  // Query param must change every deploy (git SHA, deployment id, or build time)
  // so CLI Production deploys still trigger the Update Now / Later prompt.
  const swUrl = `/sw.js?v=${encodeURIComponent(`${release.version}.${release.build}`)}`;

  void navigator.serviceWorker
    .register(swUrl, { scope: "/", updateViaCache: "none" })
    .then((registration) => {
      // First visit: activate waiting worker without a user prompt.
      if (!navigator.serviceWorker.controller && registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      const installing = registration.installing;
      if (!navigator.serviceWorker.controller && installing) {
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        });
      }
      void registration.update().catch(() => {});
    })
    .catch(() => {
      // Non-fatal
    });
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <>
      <PwaSplash />
      {children}
      <PwaInstallPrompt />
      <PwaUpdatePrompt />
    </>
  );
}
