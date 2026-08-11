"use client";

import { ChevronRightIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type CollapsibleWorkspaceSectionProps = {
  title: string;
  /** Shown under the title when collapsed (professional summary line). */
  summary?: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Professional collapsible workspace block — title always visible; body expands on demand.
 */
export function CollapsibleWorkspaceSection({
  title,
  summary,
  badge,
  defaultOpen = false,
  children,
  className,
}: CollapsibleWorkspaceSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
          "hover:bg-muted/40",
          open && "border-b border-border/60 bg-muted/20"
        )}
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground transition-transform",
            open && "rotate-90 text-foreground"
          )}
        >
          <ChevronRightIcon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold tracking-tight text-foreground">{title}</h3>
            {badge}
          </div>
          {!open && summary ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{summary}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {open ? "Collapse" : "Expand"}
        </span>
      </button>
      {open ? <div className="px-4 py-4">{children}</div> : null}
    </section>
  );
}
