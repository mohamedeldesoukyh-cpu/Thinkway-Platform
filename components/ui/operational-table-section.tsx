import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type OperationalTableSectionProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Wide borderless layout for dense operational grids */
  wide?: boolean;
  /** Tighter section header */
  compact?: boolean;
  /** Table fills the frame; title/actions must be rendered outside */
  tableOnly?: boolean;
  /** White rounded card on page background (campaign workspace) */
  cardSurface?: boolean;
  /** Toolbar row inside the card (above table) */
  leading?: ReactNode;
  /** Filters / secondary controls between header and table */
  toolbar?: ReactNode;
  /** Sticky footer row inside the card (assignments: AI Match + Shortlist). */
  footer?: ReactNode;
  /** Assignments tab shell — asgn-wrap / asgn-head-bar / asgn-scroll layout. */
  assignmentsShell?: boolean;
  /**
   * Stretch the section to fill remaining viewport height and scroll the table
   * body internally (Vendor IO and similar dense grids).
   */
  fillHeight?: boolean;
};

/** Card header + flush table (single clean border like campaign assignments). */
export function OperationalTableSection({
  title,
  description,
  actions,
  children,
  className,
  wide = false,
  compact = false,
  tableOnly = false,
  cardSurface = false,
  leading,
  toolbar,
  footer,
  assignmentsShell = false,
  fillHeight = false,
}: OperationalTableSectionProps) {
  const showHeader = !tableOnly && Boolean(title || description || actions);
  const useReferenceSectionCard = cardSurface && tableOnly;
  const useAssignmentsShell = assignmentsShell && tableOnly;

  const sectionHead = leading ? (
    <div
      className={cn(
        "shrink-0",
        cardSurface &&
          (useAssignmentsShell
            ? "thinkway-campaign-asgn-head-bar"
            : "thinkway-campaign-section-head")
      )}
    >
      {leading}
    </div>
  ) : null;

  const sectionToolbar = toolbar ? (
    <div
      className={cn(
        "shrink-0 border-b border-[var(--camp-border)]",
        cardSurface ? "thinkway-campaign-filter-panel border-b" : "border-border/40 px-4 md:px-5",
        !cardSurface && (compact ? "py-1.5" : "py-3")
      )}
    >
      {toolbar}
    </div>
  ) : null;

  const legacyHeader =
    showHeader && !leading ? (
      <CardHeader
        className={cn(
          "flex flex-row flex-wrap items-center justify-between gap-2",
          compact && cardSurface ? "gap-2 px-4 py-2.5 md:px-5" : compact ? "px-0 py-2" : "gap-3 px-4 py-3",
          wide ? "border-b border-border/25" : "border-b border-border",
          !wide && !compact && "px-4"
        )}
      >
        <div className={cn(compact ? "min-w-0" : "space-y-0.5")}>
          <CardTitle
            className={cn(compact ? "text-sm font-semibold" : "text-base font-semibold")}
          >
            {title}
          </CardTitle>
          {description ? (
            <p
              className={cn(
                "text-muted-foreground",
                compact && cardSurface ? "text-[11px] leading-snug" : "text-sm"
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </CardHeader>
    ) : null;

  const tableBody = tableOnly ? (
    <div
      className={cn(
        useAssignmentsShell
          ? "thinkway-campaign-asgn-scroll"
          : "thinkway-campaign-table-scroll",
        fillHeight && "thinkway-campaign-table-scroll--fill min-h-0 flex-1"
      )}
    >
      {children}
    </div>
  ) : (
    children
  );

  const fillShellClass = fillHeight
    ? "flex min-h-0 flex-1 flex-col overflow-hidden"
    : undefined;

  if (useAssignmentsShell) {
    return (
      <div className={cn("thinkway-campaign-asgn-wrap", fillShellClass, className)}>
        {sectionHead}
        {sectionToolbar}
        {legacyHeader}
        {tableBody}
        {footer ? <div className="shrink-0">{footer}</div> : null}
      </div>
    );
  }

  if (useReferenceSectionCard) {
    return (
      <div className={cn("thinkway-campaign-section-card", fillShellClass, className)}>
        {sectionHead}
        {sectionToolbar}
        {legacyHeader}
        {tableBody}
        {footer ? <div className="shrink-0">{footer}</div> : null}
      </div>
    );
  }

  return (
    <Card
      className={cn(
        "overflow-hidden",
        cardSurface
          ? "thinkway-campaign-section-card rounded-[var(--camp-radius-lg)] border-[var(--camp-border)] bg-[var(--camp-white)] shadow-none"
          : wide || tableOnly
            ? "border-0 bg-background shadow-none"
            : "bg-background shadow-sm ring-1 ring-border/70",
        tableOnly && !cardSurface && "rounded-none",
        className
      )}
    >
      {sectionHead}
      {sectionToolbar}
      {legacyHeader}
      <CardContent className="p-0 [&_[data-slot=table-container]]:rounded-none [&_[data-slot=table-container]]:border-0 [&_[data-slot=table-container]]:shadow-none">
        {tableBody}
      </CardContent>
    </Card>
  );
}
