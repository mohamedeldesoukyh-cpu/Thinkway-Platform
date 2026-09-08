"use client";

import { useEffect } from "react";

import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { PwaSplash } from "@/components/pwa/pwa-splash";
import { PwaUpdatePrompt } from "@/components/pwa/pwa-update-prompt";
import { getReleaseInfo } from "@/lib/release/release-info";

function isClientReviewPath(pathname: string): boolean {
  return pathname === "/review" || pathname.startsWith("/review/");
}

/**
 * Register the update-beacon service worker.
 *
 * Do NOT unregister+re-register on every load: that clears the controller, then
 * SKIP_WAITING + clients.claim() fires controllerchange, and PwaUpdatePrompt
 * reloads — an infinite freeze/refresh loop (especially in WhatsApp WebView).
 *
 * Client Review (/review) never registers a worker: share links must stay stable.
 */
async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const { protocol, hostname, pathname } = window.location;
  const isLocal =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  if (protocol !== "https:" && !isLocal) return;

  if (isClientReviewPath(pathname)) {
    try {
      const existing = await navigator.serviceWorker.getRegistrations();
      await Promise.all(existing.map((registration) => registration.unregister()));
    } catch {
      /* ignore */
    }
    return;
  }

  const release = getReleaseInfo();
  const swUrl = `/sw.js?v=${encodeURIComponent(`${release.version}.${release.build}`)}`;

  try {
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: "/",
      updateViaCache: "none",
    });
    // First install only: activate quietly. Never reload from here.
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
  } catch {
    // Non-fatal — app works without a service worker.
  }
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void registerServiceWorker();
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
