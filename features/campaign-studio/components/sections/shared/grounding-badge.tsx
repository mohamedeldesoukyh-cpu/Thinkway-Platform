"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  SOURCE_COLORS,
  SOURCE_LABELS,
  type GroundedElement,
  type GroundingSource,
} from "../../../services/grounding-types";

type GroundingBadgeProps = {
  source: GroundingSource;
  confidence?: number;
  className?: string;
  size?: "sm" | "md";
};

export function GroundingBadge({
  source,
  confidence,
  className,
  size = "sm",
}: GroundingBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold",
        size === "sm" ? "text-[9px]" : "text-[10px]",
        SOURCE_COLORS[source],
        className
      )}
    >
      {SOURCE_LABELS[source]}
      {confidence != null ? ` · ${confidence}%` : ""}
    </Badge>
  );
}

type GroundingFooterProps = {
  grounding: GroundedElement;
  className?: string;
};

export function GroundingFooter({ grounding, className }: GroundingFooterProps) {
  return (
    <div className={cn("mt-2 space-y-1 border-t border-border/40 pt-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <GroundingBadge source={grounding.source} confidence={grounding.confidence} />
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">{grounding.reason}</p>
      {grounding.evidence ? (
        <p className="text-[9px] italic text-muted-foreground/80">Evidence: {grounding.evidence}</p>
      ) : null}
    </div>
  );
}
