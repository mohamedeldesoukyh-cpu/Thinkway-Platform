"use client";

import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  selectedCount: number;
  totalVisible?: number;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onClear?: () => void;
  selectAllLabel?: string;
  deselectAllLabel?: string;
  className?: string;
  children?: ReactNode;
  showSelectAll?: boolean;
  showClear?: boolean;
};

export function CreatorSelectionToolbar({
  selectedCount,
  totalVisible,
  onSelectAll,
  onDeselectAll,
  onClear,
  selectAllLabel = "Select all",
  deselectAllLabel = "Deselect all",
  className,
  children,
  showSelectAll = true,
  showClear = true,
}: Props) {
  const allSelected =
    totalVisible != null && totalVisible > 0 && selectedCount >= totalVisible;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-sm",
        selectedCount > 0 && "border-primary/20 bg-primary/5 px-3 py-2",
        className
      )}
    >
      <span className="text-muted-foreground">
        {selectedCount} selected
        {totalVisible != null ? ` · ${totalVisible} visible` : ""}
      </span>

      {showSelectAll && onSelectAll ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={allSelected && onDeselectAll ? onDeselectAll : onSelectAll}
        >
          {allSelected ? deselectAllLabel : selectAllLabel}
        </Button>
      ) : null}

      {children}

      {showClear && selectedCount > 0 && onClear ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto h-7 gap-1 text-xs text-muted-foreground"
          onClick={onClear}
        >
          <XIcon className="size-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
