import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageAlertVariant = "error" | "warning" | "info";

const VARIANT_CLASS: Record<PageAlertVariant, string> = {
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100",
  info: "border-brand-blue/30 bg-accent text-foreground",
};

type PageAlertProps = {
  variant?: PageAlertVariant;
  children: ReactNode;
  className?: string;
};

export function PageAlert({ variant = "error", children, className }: PageAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        VARIANT_CLASS[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
