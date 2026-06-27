import Link from "next/link";

import { cn } from "@/lib/utils";

import {
  DISCOVERY_SUB_NAV_PAGES,
  DiscoveryPageIconBadge,
} from "@/features/discovery/components/discovery-page-identity";

type DiscoverySubNavProps = {
  activeHref: string;
};

export function DiscoverySubNav({ activeHref }: DiscoverySubNavProps) {
  return (
    <nav
      aria-label="Discovery"
      className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border bg-background/95 px-2 py-1.5 md:px-3"
    >
      {DISCOVERY_SUB_NAV_PAGES.map((page) => {
        const isActive = activeHref === page.href;
        return (
          <Link
            key={page.href}
            href={page.href}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <DiscoveryPageIconBadge identity={page} size="sm" />
            <span className={cn(isActive && "font-semibold")}>{page.navLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
