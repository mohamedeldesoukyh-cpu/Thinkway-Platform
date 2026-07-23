import Link from "next/link";

import { cn } from "@/lib/utils";

import {
  DISCOVERY_SUB_NAV_PAGES,
  type DiscoveryPageIdentity,
} from "@/features/discovery/components/discovery-page-identity";

type DiscoverySubNavProps = {
  activeHref: string;
};

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

/**
 * Discovery tab bar — matches thinkway-client-quotations.html
 * `.d-subnav` / `.d-tabs` / `.d-tab`.
 */
export function DiscoverySubNav({ activeHref }: DiscoverySubNavProps) {
  return (
    <div className="shrink-0 border-b border-[var(--tw-border)] bg-background px-4 pt-3 dark:bg-background">
      <nav
        aria-label="Discovery"
        className="flex flex-wrap items-center gap-1 pb-3"
      >
        {DISCOVERY_SUB_NAV_PAGES.map((page) => {
          const isActive = isDiscoveryTabActive(activeHref, page);
          const Icon = page.icon;
          return (
            <Link
              key={page.href}
              href={page.href}
              className={cn(
                "inline-flex items-center gap-[7px] rounded-[20px] px-[13px] py-[7px] text-[12.5px] font-bold transition-colors",
                isActive
                  ? "bg-[var(--blue-light)] text-[var(--blue-text)] dark:bg-blue-950/40 dark:text-blue-300"
                  : "text-[var(--text-2)] hover:bg-[var(--surface)] dark:text-muted-foreground dark:hover:bg-muted/60 dark:hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span>{page.navLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
