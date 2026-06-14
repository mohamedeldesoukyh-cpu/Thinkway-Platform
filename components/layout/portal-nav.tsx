"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type PortalNavItem = {
  href: string;
  label: string;
  badge?: number;
};

export function PortalNav({ items }: { items: PortalNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
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
              "flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground/80 hover:bg-muted hover:text-foreground"
            )}
          >
            <span>{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  active ? "bg-white/20" : "bg-primary/10 text-primary"
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
