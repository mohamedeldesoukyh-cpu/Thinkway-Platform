import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  DISCOVERY_COLS,
  DISCOVERY_GRID_MIN_W,
  type DiscoveryColsKey,
} from "./discovery-suite-cols";

type DiscoverySuiteGridProps = {
  cols: DiscoveryColsKey | string;
  minWidth?: number;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  scrollerClassName?: string;
};

/**
 * Spec §3 grid engine — one `--cols` shared by header, rows, footer.
 */
export function DiscoverySuiteGrid({
  cols,
  minWidth,
  header,
  children,
  footer,
  className,
  scrollerClassName,
}: DiscoverySuiteGridProps) {
  const track =
    typeof cols === "string" && cols in DISCOVERY_COLS
      ? DISCOVERY_COLS[cols as DiscoveryColsKey]
      : typeof cols === "string"
        ? cols
        : DISCOVERY_COLS.shortlists;
  const floor =
    minWidth ??
    (typeof cols === "string" && cols in DISCOVERY_GRID_MIN_W
      ? DISCOVERY_GRID_MIN_W[cols as DiscoveryColsKey]
      : undefined);

  return (
    <div className={cn("tw-c", className)}>
      <div className={cn("tw-sc", scrollerClassName)}>
        <div
          className="tw-g-wrap"
          style={
            {
              "--cols": track,
              minWidth: floor ? `${floor}px` : undefined,
            } as CSSProperties
          }
          role="grid"
        >
          <div className="tw-g tw-hr" role="row">
            {header}
          </div>
          {children}
          {footer ? (
            <div className="tw-g tw-ft" role="row">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type DiscoverySuiteRowProps = {
  children: ReactNode;
  className?: string;
  selected?: boolean;
  warn?: boolean;
  bad?: boolean;
  onClick?: () => void;
};

export function DiscoverySuiteRow({
  children,
  className,
  selected,
  warn,
  bad,
  onClick,
}: DiscoverySuiteRowProps) {
  return (
    <div
      className={cn(
        "tw-g tw-r",
        selected && "sel",
        warn && "wrn",
        bad && "bad",
        className
      )}
      role="row"
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function DiscoverySuiteCell({
  children,
  className,
  align = "start",
}: {
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  return (
    <div
      className={cn(align === "end" && "tw-rr", className)}
      role="gridcell"
    >
      {children}
    </div>
  );
}
