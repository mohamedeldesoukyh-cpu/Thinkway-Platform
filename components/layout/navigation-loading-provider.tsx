"use client";

import type { ReactNode } from "react";
import { Suspense, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { PREVIEW_NAVIGATION_EVENT } from "@/lib/navigation/preview-navigation";

import { ThinkwayPageLoader } from "@/components/layout/thinkway-page-loader";

type NavigationLoadingProviderProps = {
  children: ReactNode;
};

function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function shouldStartNavigation(event: MouseEvent, pathname: string): boolean {
  if (event.defaultPrevented || isModifiedClick(event)) return false;
  // The client entrance provides its own pending presentation.
  if (event.target instanceof Element && event.target.closest("[data-client-entrance-cta]")) return false;

  const target = event.target;
  if (!(target instanceof Element)) return false;

  const anchor = target.closest("a[href]");
  if (!anchor || anchor.getAttribute("target") === "_blank") return false;
  if (anchor.hasAttribute("download")) return false;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // API file downloads keep the current page URL — never show route loading.
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname === pathname && url.search === window.location.search) return false;

  return true;
}

/**
 * Overlay-only navigator feedback. Kept as a sibling of `children` so route
 * trees do not re-render when the overlay toggles (hydration + memory win).
 */
function NavigationLoadingOverlay() {
  const router = useRouter();
  const [previewPending, startPreviewTransition] = useTransition();
  const [previewClosing, setPreviewClosing] = useState(false);
  const previewReturn = useRef<{ from: string; preview: string } | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [isNavigating, setIsNavigating] = useState(false);

  useLayoutEffect(() => {
    function navigate(event: Event) {
      const detail = (event as CustomEvent<{ href: string; close: boolean }>).detail;
      if (!detail || typeof detail.href !== "string") return;
      const destination = new URL(detail.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      const href = destination.pathname + destination.search + destination.hash;
      setPreviewClosing(detail.close);
      startPreviewTransition(() => {
        if (detail.close) {
          const entry = previewReturn.current;
          previewReturn.current = null;
          if (entry?.preview === window.location.pathname) router.back();
          else router.push(href, { scroll: false });
        } else if (/\/preview\/?$/.test(window.location.pathname)) {
          if (previewReturn.current) previewReturn.current.preview = destination.pathname;
          router.replace(href, { scroll: false });
        } else {
          previewReturn.current = { from: window.location.pathname, preview: destination.pathname };
          router.push(href, { scroll: false });
        }
      });
    }
    window.addEventListener(PREVIEW_NAVIGATION_EVENT, navigate);
    return () => window.removeEventListener(PREVIEW_NAVIGATION_EVENT, navigate);
  }, [router]);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname, search]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!shouldStartNavigation(event, pathname)) return;
      setIsNavigating(true);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname]);

  // Failsafe: downloads / aborted navigations never change the URL.
  useEffect(() => {
    if (!isNavigating) return;
    const timer = window.setTimeout(() => setIsNavigating(false), 8000);
    return () => window.clearTimeout(timer);
  }, [isNavigating]);

  if (previewPending) return createPortal(
    <div role="status" aria-live="polite" style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", background: "#08063f", color: "#fff" }}>
      <span>{previewClosing ? "Returning to document…" : "Preparing preview…"}</span>
    </div>, document.body);

  if (!isNavigating) return null;

  return (
    <div className="thinkway-navigation-loading-overlay" aria-hidden={false}>
      <ThinkwayPageLoader label="Loading page" />
    </div>
  );
}

/** Shows the Thinkway loader immediately when the user clicks an in-app link. */
export function NavigationLoadingProvider({ children }: NavigationLoadingProviderProps) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <NavigationLoadingOverlay />
      </Suspense>
    </>
  );
}
