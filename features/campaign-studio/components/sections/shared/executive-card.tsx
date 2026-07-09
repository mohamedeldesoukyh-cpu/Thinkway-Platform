"use client";

import { cn } from "@/lib/utils";
import type { GroundedElement } from "../../../services/grounding-types";
import { GroundingFooter } from "./grounding-badge";

type ExecutiveCardProps = {
  label: string;
  value: string;
  className?: string;
  accent?: "green" | "purple" | "neutral";
  grounding?: GroundedElement;
};

const ACCENT_STYLES = {
  green: "border-[#1D9E75]/25 bg-[#1D9E75]/5",
  purple: "border-violet-300/40 bg-violet-50/50 dark:border-violet-800/40 dark:bg-violet-950/20",
  neutral: "border-border/60 bg-muted/20",
} as const;

export function ExecutiveCard({
  label,
  value,
  className,
  accent = "neutral",
  grounding,
}: ExecutiveCardProps) {
  if (!value.trim()) return null;

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border px-3 py-2.5 transition-all duration-300 hover:shadow-sm",
        ACCENT_STYLES[accent],
        className
      )}
    >
      <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold leading-snug text-foreground [overflow-wrap:anywhere] [word-break:break-word]">
        {value}
      </p>
      {grounding ? <GroundingFooter grounding={grounding} /> : null}
    </div>
  );
}
