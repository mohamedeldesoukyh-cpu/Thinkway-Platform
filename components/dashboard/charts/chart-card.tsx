import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ChartCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  minHeight?: number;
};

export function ChartCard({
  title,
  description,
  children,
  className,
  minHeight = 200,
}: ChartCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm",
        className
      )}
    >
      <div className="border-b border-border/40 px-4 py-2.5 md:px-5">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? (
          <p className="text-[11px] leading-snug text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="px-4 pt-2 pb-4 md:px-5" style={{ minHeight }}>
        {children}
      </div>
    </div>
  );
}
