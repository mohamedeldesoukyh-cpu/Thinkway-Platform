"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  isPortalNavActive,
  type PortalNavItem,
  type PortalNavVariant,
} from "@/components/layout/portal-nav";

export function PortalMobileNav({
  items,
  placement = "chips",
  variant = "pills",
}: {
  items: PortalNavItem[];
  placement?: "chips" | "bottom";
  variant?: PortalNavVariant;
}) {
  const pathname = usePathname();
  const compact = variant === "compact";

  if (placement === "bottom") {
    return (
      <nav
        aria-label="Creator Workspace"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-4">
          {items.map((item) => {
            const active = isPortalNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span className="flex items-center gap-1">
                  {item.label}
                  {item.badge && item.badge > 0 ? (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  if (compact) {
    return (
      <nav
        aria-label="Workspace"
        className="flex gap-1 overflow-x-auto border-b border-border px-4 md:hidden"
      >
        {items.map((item) => {
          const active = isPortalNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative shrink-0 px-2.5 py-2.5 text-[13px] font-medium transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
              {item.badge && item.badge > 0 ? (
                <span className="ml-1 text-[10px] tabular-nums text-muted-foreground">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              ) : null}
              {active ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />
              ) : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2 md:hidden">
      {items.map((item) => {
        const active = isPortalNavActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full px-3 py-2 text-sm font-medium",
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
