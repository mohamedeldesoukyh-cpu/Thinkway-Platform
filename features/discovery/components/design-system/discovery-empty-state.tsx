"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DiscoveryEmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: ReactNode;
  className?: string;
};

/** Centered empty state — matches Search zero-result spacing. */
export function DiscoveryEmptyState({
  title,
  description,
  icon: Icon,
  children,
  className,
}: DiscoveryEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-24 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="flex size-12 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--text-3)]">
          <Icon className="size-6" strokeWidth={1.75} />
        </div>
      ) : null}
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex flex-col items-center gap-2">{children}</div> : null}
    </div>
  );
}
