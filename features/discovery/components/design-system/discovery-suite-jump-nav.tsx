"use client";

import { usePathname } from "next/navigation";

import { AppNavLink } from "@/components/navigation/app-nav-link";
import {
  DISCOVERY_SUB_NAV_PAGES,
  isDiscoveryNavPageActive,
} from "@/features/discovery/components/discovery-page-identity";

const ACTIVE_STYLE = {
  background: "var(--tw-lav)",
  borderColor: "#CDDCFF",
  color: "var(--tw-bi)",
  fontWeight: 600,
} as const;

/**
 * Pack page jumps (`discovery.html` `bar()` → `.tw-jump`).
 * Lives under the frozen masthead — not beside the Thinkway logo.
 */
export function DiscoverySuiteJumpNav({
  activeHref,
}: {
  activeHref?: string;
}) {
  const pathname = usePathname();
  const href = activeHref ?? pathname ?? "";

  return (
    <nav className="tw-jump" aria-label="Discovery">
      {DISCOVERY_SUB_NAV_PAGES.map((page) => {
        const isActive = isDiscoveryNavPageActive(href, page);
        return (
          <AppNavLink
            key={page.href}
            href={page.href}
            aria-current={isActive ? "page" : undefined}
            style={isActive ? ACTIVE_STYLE : undefined}
          >
            {page.navLabel}
          </AppNavLink>
        );
      })}
    </nav>
  );
}
