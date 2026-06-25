import Link from "next/link";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/discovery/search", label: "Search" },
  { href: "/discovery/shortlists", label: "Shortlists" },
  { href: "/discovery/quotations", label: "Client Quotations" },
  { href: "/discovery/campaign-match", label: "Campaign Match" },
  { href: "/discovery/import", label: "Import Center" },
] as const;

type DiscoverySubNavProps = {
  activeHref: (typeof NAV_ITEMS)[number]["href"];
};

export function DiscoverySubNav({ activeHref }: DiscoverySubNavProps) {
  return (
    <nav
      aria-label="Discovery"
      className="flex shrink-0 flex-wrap items-center gap-4 border-b border-border bg-background px-4 py-2 text-[12px] md:px-5"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activeHref === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "font-medium transition-colors",
              isActive
                ? "font-semibold text-primary"
                : "text-muted-foreground hover:text-primary"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
