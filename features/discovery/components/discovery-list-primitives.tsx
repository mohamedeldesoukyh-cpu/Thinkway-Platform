import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Shared Discovery list table header cell — matches Search list typography. */
export const DISCOVERY_TABLE_HEAD_CLASS =
  "h-auto px-3.5 py-[11px] text-[9.5px] font-bold uppercase tracking-[0.5px] text-muted-foreground bg-muted/40";

/** Shared Discovery list table body cell. */
export const DISCOVERY_TABLE_CELL_CLASS =
  "px-3.5 py-3 align-middle text-[12.5px] text-[var(--text-2)] dark:text-muted-foreground";

/** Shared Discovery list table row hover. */
export const DISCOVERY_TABLE_ROW_CLASS = "hover:bg-muted/30";

/** Bordered card shell for Discovery list tables and sections. */
export const DISCOVERY_LIST_CARD_CLASS =
  "overflow-hidden rounded-[var(--radius-lg)] border border-[var(--tw-border)] bg-background";

type DiscoveryListCardProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode;
};

export function DiscoveryListCard({
  children,
  className,
  ...props
}: DiscoveryListCardProps) {
  return (
    <div className={cn(DISCOVERY_LIST_CARD_CLASS, className)} {...props}>
      {children}
    </div>
  );
}
