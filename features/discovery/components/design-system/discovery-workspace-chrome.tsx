import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const DISCOVERY_WORKSPACE_TOOLBAR_CLASS =
  "flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-2 md:px-6";

export const DISCOVERY_WORKSPACE_INNER_CLASS =
  "mx-auto w-full max-w-[1800px] px-4 py-5 md:px-6 md:py-6";

export const DISCOVERY_WORKSPACE_ACTION_BAR_CLASS =
  "flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-3 md:px-5";

type DiscoveryWorkspaceToolbarProps = {
  backHref: string;
  backLabel: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

/** Detail workspace top bar — back link, optional meta, right actions. */
export function DiscoveryWorkspaceToolbar({
  backHref,
  backLabel,
  actions,
  meta,
  className,
}: DiscoveryWorkspaceToolbarProps) {
  return (
    <div className={cn(DISCOVERY_WORKSPACE_TOOLBAR_CLASS, className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
        {meta ? (
          <>
            <span className="hidden h-4 w-px bg-[#E6EAF2] dark:bg-border sm:block" aria-hidden />
            <div className="text-[12px] font-semibold text-foreground">{meta}</div>
          </>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

type DiscoveryWorkspaceActionBarProps = {
  leading?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Flush workspace action row (Compare, Search sub-regions). */
export function DiscoveryWorkspaceActionBar({
  leading,
  meta,
  actions,
  className,
}: DiscoveryWorkspaceActionBarProps) {
  return (
    <div className={cn(DISCOVERY_WORKSPACE_ACTION_BAR_CLASS, className)}>
      {leading}
      {meta ? <span className="text-[12px] font-semibold text-foreground">{meta}</span> : null}
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
