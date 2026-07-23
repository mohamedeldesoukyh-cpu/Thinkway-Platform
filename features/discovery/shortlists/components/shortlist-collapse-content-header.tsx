"use client";

import { type ReactNode } from "react";
import { Layers2Icon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { collapseContentPreviewLabel } from "@/lib/discovery/collapse-content";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  creatorCount: number;
  className?: string;
  selectable?: boolean;
  checked?: boolean | "indeterminate";
  selected?: boolean;
  onToggleSelect?: () => void;
  actions?: ReactNode;
};

/** Shared header for two creators bundled as collapse content on a shortlist. */
export function ShortlistCollapseContentHeader({
  label,
  creatorCount,
  className,
  selectable = false,
  checked = false,
  selected = false,
  onToggleSelect,
  actions,
}: Props) {
  return (
    <div
      className={cn(
        "shortlist-collapse-content-header border-b border-primary/25 bg-primary/[0.08]",
        selected && "is-selected",
        className
      )}
    >
      <div className="discovery-search-exact-photo-cell">
        {selectable ? (
          <span
            className="discovery-search-exact-select"
            onClick={(event) => event.stopPropagation()}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={onToggleSelect}
              aria-label={`${checked === true ? "Deselect" : "Select"} ${label} creators`}
            />
          </span>
        ) : null}
      </div>
      <div className="shortlist-collapse-content-header-body">
        <Layers2Icon className="size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold uppercase tracking-[0.06em] text-primary">
            {label}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {collapseContentPreviewLabel(label)} · {creatorCount} creators
          </p>
        </div>
        {actions ? (
          <div className="discovery-search-exact-actions shrink-0">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
