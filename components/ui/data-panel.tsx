import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DataPanelProps = {
  children: ReactNode;
  className?: string;
};

/** Enterprise data surface — tighter radius than marketing cards. */
export function DataPanel({ children, className }: DataPanelProps) {
  return (
    <div
      data-slot="data-panel"
      className={cn(
        "overflow-hidden rounded-2xl bg-card text-card-foreground shadow-sm ring-1 ring-border/70",
        className
      )}
    >
      {children}
    </div>
  );
}

type DataPanelHeaderProps = {
  title: string;
  meta?: string;
  toolbar?: ReactNode;
  className?: string;
};

export function DataPanelHeader({ title, meta, toolbar, className }: DataPanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {meta ? <p className="text-sm text-muted-foreground">{meta}</p> : null}
      </div>
      {toolbar ? <div className="flex shrink-0 items-center gap-2">{toolbar}</div> : null}
    </div>
  );
}

type DataPanelContentProps = {
  children: ReactNode;
  className?: string;
  flush?: boolean;
};

export function DataPanelContent({ children, className, flush }: DataPanelContentProps) {
  return (
    <div className={cn(flush ? "p-0" : "space-y-5 px-5 py-5", className)}>{children}</div>
  );
}
