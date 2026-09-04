"use client";

import { useEffect } from "react";

import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { PwaSplash } from "@/components/pwa/pwa-splash";
import { PwaUpdatePrompt } from "@/components/pwa/pwa-update-prompt";
import { getReleaseInfo } from "@/lib/release/release-info";

/**
 * Replace any controlling worker. Legacy workers used `respondWith(fetch())`,
 * which fails under Vercel Deployment Protection (SSO) and surfaces as
 * FetchEvent network errors / blank client trees on Dig.
 */
async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const { protocol, hostname } = window.location;
  const isLocal =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  if (protocol !== "https:" && !isLocal) return;

  const release = getReleaseInfo();
  const swUrl = `/sw.js?v=${encodeURIComponent(`${release.version}.${release.build}`)}`;

  try {
    const existing = await navigator.serviceWorker.getRegistrations();
    await Promise.all(existing.map((registration) => registration.unregister()));
  } catch {
    /* ignore */
  }

  try {
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: "/",
      updateViaCache: "none",
    });
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
