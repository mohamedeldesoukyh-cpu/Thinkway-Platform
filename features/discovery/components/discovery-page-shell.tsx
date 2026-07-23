import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { cn } from "@/lib/utils";

import {
  DISCOVERY_PAGE_IDENTITY,
  DiscoveryPageHeader,
  type DiscoveryPageKey,
} from "./discovery-page-identity";

export type DiscoveryPageShellVariant = "list" | "workspace" | "flush";

type DiscoveryPageShellProps = {
  page: DiscoveryPageKey;
  /** Override Discovery topnav active matching (defaults to page identity href). */
  activeHref?: string;
  /**
   * list — lavender canvas + padded scroll region + optional page header
   * workspace — campaign-surface / muted workspace (detail pages)
   * flush — full-bleed content under the shell topbar (Creator Search)
   */
  variant?: DiscoveryPageShellVariant;
  /** When false, skip DiscoveryPageHeader (e.g. flush workspaces with their own top bar). */
  showHeader?: boolean;
  headerActions?: ReactNode;
  /** Extra chrome above children (e.g. back bar on detail pages). */
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function DiscoveryPageShell({
  page,
  activeHref,
  variant = "list",
  showHeader = variant !== "flush",
  headerActions,
  toolbar,
  children,
  className,
  contentClassName,
}: DiscoveryPageShellProps) {
  const identity = DISCOVERY_PAGE_IDENTITY[page];
  const href = activeHref ?? identity.href;

  return (
    <DashboardShell
      title={identity.title}
      description={identity.description}
      hidePageHeader
      containedMain
      discoveryNavActiveHref={href}
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      headerClassName="h-14 px-4 py-0 md:px-4"
    >
      <PlatformErrorBoundary surface="generic">
        <div
          className={cn(
            "flex h-full min-h-0 flex-col overflow-hidden",
            className
          )}
        >
          {toolbar}
          {variant === "flush" ? (
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-hidden",
                contentClassName
              )}
            >
              {children}
            </div>
          ) : variant === "workspace" ? (
            <div
              className={cn(
                "thinkway-campaign-workspace flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[var(--camp-surface)]",
                contentClassName
              )}
              data-campaign-workspace-scroll
            >
              {showHeader ? (
                <div className="space-y-4 p-4 md:p-5">
                  <DiscoveryPageHeader
                    identity={identity}
                    actions={headerActions}
                  />
                  {children}
                </div>
              ) : (
                children
              )}
            </div>
          ) : (
            /* HTML `.content`: page-head sits on lavender canvas; only children are card-bounded. */
            <div
              className={cn(
                "min-h-0 flex-1 space-y-4 overflow-y-auto bg-[var(--lavender)] px-4 pt-5 pb-[60px] dark:bg-background",
                contentClassName
              )}
            >
              {showHeader ? (
                <DiscoveryPageHeader
                  identity={identity}
                  actions={headerActions}
                />
              ) : null}
              {children}
            </div>
          )}
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
