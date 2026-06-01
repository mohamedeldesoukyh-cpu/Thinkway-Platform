"use client";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AssignmentExpandToggleProps = {
  expanded: boolean;
  onToggle: () => void;
  ariaLabel: string;
  className?: string;
};

export function AssignmentExpandToggle({
  expanded,
  onToggle,
  ariaLabel,
  className,
}: AssignmentExpandToggleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("shrink-0 text-muted-foreground", className)}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={ariaLabel}
    >
      {expanded ? (
        <ChevronDownIcon className="size-4" />
      ) : (
        <ChevronRightIcon className="size-4" />
      )}
    </Button>
  );
}
