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
  /** When false, skip outer `.tw-c` (parent already provides the card). */
  framed?: boolean;
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
  framed = true,
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

  const colStyle = {
    "--cols": track,
  } as CSSProperties;

  const body = (
    <div className={cn("tw-sc", scrollerClassName)}>
      <div style={{ minWidth: floor ? `${floor}px` : undefined }}>
        <div className="tw-g tw-hr" style={colStyle} role="row">
          {header}
        </div>
        {/* Rows inherit --cols via React clone — set on each DiscoverySuiteRow below via context, or wrap children */}
        <div style={colStyle}>{children}</div>
        {footer ? (
          <div className="tw-g tw-ft" style={colStyle} role="row">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!framed) {
    return <div className={className}>{body}</div>;
  }

  return <div className={cn("tw-c", className)}>{body}</div>;
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
  children?: ReactNode;
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
