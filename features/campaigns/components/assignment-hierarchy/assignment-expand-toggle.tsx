"use client";

import { ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type AssignmentExpandToggleProps = {
  expanded: boolean;
  onToggle: () => void;
  ariaLabel: string;
  className?: string;
};

/** Chevron expand control — matches thinkway-campaign_2.html .chevron. */
export function AssignmentExpandToggle({
  expanded,
  onToggle,
  ariaLabel,
  className,
}: AssignmentExpandToggleProps) {
  return (
    <button
      type="button"
      className={cn("thinkway-campaign-chevron", className)}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-expanded={expanded}
      aria-label={ariaLabel}
    >
      <ChevronRightIcon className="size-2.5" aria-hidden />
    </button>
  );
}
