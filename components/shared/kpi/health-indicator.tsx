import { cn } from "@/lib/utils";

import { KPI_HEALTH_VALUE_CLASS, type KpiHealthTone } from "./kpi-config";

export type HealthIndicatorProps = {
  tone: KpiHealthTone;
  /** Dot (inline) or ring (card corner accent). */
  variant?: "dot" | "ring";
  className?: string;
  "aria-label"?: string;
};

const DOT_CLASS: Record<KpiHealthTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  neutral: "bg-muted-foreground/50",
};

export function HealthIndicator({
  tone,
  variant = "dot",
  className,
  "aria-label": ariaLabel,
}: HealthIndicatorProps) {
  if (variant === "ring") {
    return (
      <span
        className={cn(
          "inline-block size-2 shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-background",
          KPI_HEALTH_VALUE_CLASS[tone].replace("text-", "ring-"),
          className,
        )}
        aria-label={ariaLabel}
        aria-hidden={!ariaLabel}
      />
    );
  }

  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", DOT_CLASS[tone], className)}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
    />
  );
}
