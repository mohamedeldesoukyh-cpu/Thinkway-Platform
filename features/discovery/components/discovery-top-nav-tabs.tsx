"use client";

import {
  DISCOVERY_SUB_NAV_PAGES,
  type DiscoveryPageIdentity,
} from "@/features/discovery/components/discovery-page-identity";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { cn } from "@/lib/utils";

function isDiscoveryTabActive(activeHref: string, page: DiscoveryPageIdentity): boolean {
  if (activeHref === page.href) return true;
  if (page.key === "intelligence" && activeHref.startsWith("/discovery/intelligence")) {
    return true;
  }
  if (page.key === "shortlists" && activeHref.startsWith("/discovery/shortlists")) {
    return true;
  }
  if (page.key === "quotations" && activeHref.startsWith("/discovery/quotations")) {
    return true;
  }
  if (page.key === "search" && activeHref.startsWith("/discovery/search")) {
    return true;
  }
  if (page.key === "import" && activeHref.startsWith("/discovery/import")) {
    return true;
  }
  if (
    page.key === "campaign-match" &&
    activeHref.startsWith("/discovery/campaign-match")
  ) {
    return true;
  }
  return false;
}

/** Discovery section links for the shell topbar (next to the Thinkway logo). */
export function DiscoveryTopNavTabs({ activeHref }: { activeHref: string }) {
  return (
    <nav
      aria-label="Discovery"
      className="discovery-top-nav-tabs flex min-w-0 flex-1 items-center gap-5 overflow-x-auto"
    >
      {DISCOVERY_SUB_NAV_PAGES.map((page) => {
        const isActive = isDiscoveryTabActive(activeHref, page);
        return (
          <AppNavLink
            key={page.href}
            href={page.href}
            className={cn(
              "shrink-0 text-[13.5px] font-semibold whitespace-nowrap transition-colors",
              isActive
                ? "font-bold text-[var(--blue,#0057FF)] dark:text-blue-400"
                : "text-[#1f2937] hover:text-[var(--blue,#0057FF)] dark:text-foreground dark:hover:text-blue-300"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {page.navLabel}
          </AppNavLink>
        );
      })}
    </nav>
  );
}
