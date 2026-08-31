"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

export type PortalNavItem = {
  href: string;
  label: string;
  badge?: number;
  icon?: ComponentType<{ className?: string }>;
};

export type PortalNavVariant = "pills" | "compact";

export function isPortalNavActive(pathname: string, href: string): boolean {
  if (href === "/creator-portal" || href === "/client-portal") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalNav({
  items,
  variant = "pills",
}: {
  items: PortalNavItem[];
  variant?: PortalNavVariant;
}) {
  const pathname = usePathname();
  const compact = variant === "compact";

  return (
    <nav className={compact ? "space-y-0.5" : "space-y-1"} aria-label="Workspace">
      {items.map((item) => {
        const active = isPortalNavActive(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              compact
                ? cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "font-normal text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )
                : cn(
                    "flex min-h-11 items-center justify-between rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground/80 hover:bg-muted hover:text-foreground"
                  )
            }
          >
            <span className="flex min-w-0 items-center gap-2">
              {compact && Icon ? (
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                  aria-hidden
                />
              ) : null}
              <span className="truncate">{item.label}</span>
            </span>
            {item.badge && item.badge > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  compact
                    ? active
                      ? "bg-background text-foreground"
                      : "bg-muted text-muted-foreground"
                    : active
                      ? "bg-white/20"
                      : "bg-primary/10 text-primary"
                )}
              >
                {item.badge > 9 ? "9+" : item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
