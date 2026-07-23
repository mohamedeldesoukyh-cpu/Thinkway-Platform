"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { ThinkwayPageLoader } from "@/components/layout/thinkway-page-loader";

type NavigationLoadingProviderProps = {
  children: ReactNode;
};

function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function shouldStartNavigation(event: MouseEvent, pathname: string): boolean {
  if (event.defaultPrevented || isModifiedClick(event)) return false;

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [isNavigating, setIsNavigating] = useState(false);

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
      <NavigationLoadingOverlay />
    </>
  );
}
