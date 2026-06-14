"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { PortalNavItem } from "@/components/layout/portal-nav";

export function PortalMobileNav({ items }: { items: PortalNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2 md:hidden">
      {items.map((item) => {
        const active =
          item.href === "/creator-portal" || item.href === "/client-portal"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {item.label}
            {item.badge && item.badge > 0 ? ` (${item.badge})` : ""}
          </Link>
        );
      })}
    </nav>
  );
}
