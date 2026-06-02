import type { ReactNode } from "react";
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageFallbackProps = {
  title: string;
  description?: string;
  hint?: string;
  onRetry?: () => void;
  children?: ReactNode;
  variant?: "warning" | "error";
};

export function PageFallback({
  title,
  description,
  hint,
  onRetry,
  children,
  variant = "warning",
}: PageFallbackProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-3xl border px-6 py-12 text-center",
        variant === "error"
          ? "border-destructive/30 bg-destructive/5"
          : "border-amber-500/30 bg-amber-500/5"
      )}
      role="alert"
    >
      <AlertTriangleIcon
        className={cn(
          "size-10",
          variant === "error" ? "text-destructive" : "text-amber-600 dark:text-amber-400"
        )}
        aria-hidden
      />
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? (
          <p className="max-w-lg text-sm text-muted-foreground">{description}</p>
        ) : null}
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCwIcon className="size-3.5" data-icon="inline-start" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}
