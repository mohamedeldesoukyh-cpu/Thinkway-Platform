"use client";

import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type PlatformV6KpiCellProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  iconStroke?: string;
  iconBg?: string;
  valueClassName?: string;
  accent?: string;
};

function PlatformV6KpiCell({
  label,
  value,
  icon: Icon,
  iconStroke = "#0057FF",
  iconBg = "var(--blue-light)",
  valueClassName,
  accent,
}: PlatformV6KpiCellProps) {
  return (
    <div
      className="platform-v6-kpi-cell"
      style={{ "--kpi-accent": accent ?? iconStroke } as CSSProperties}
    >
      <div className="platform-v6-kpi-lbl">
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-[4px] p-[2px]"
          style={{ background: iconBg, color: iconStroke }}
        >
          <Icon aria-hidden className="size-[13px]" strokeWidth={2} style={{ color: iconStroke }} />
        </span>
        <span className="platform-v6-kpi-lbl-text">{label}</span>
      </div>
      <div className={cn("platform-v6-kpi-val", valueClassName)}>{value}</div>
    </div>
  );
}

export type PlatformV6KpiItem = PlatformV6KpiCellProps & { id: string };

export function PlatformV6KpiStrip({
  items,
  className,
  columns = 4,
  layout = "grid",
}: {
  items: PlatformV6KpiItem[];
  className?: string;
  columns?: number;
  layout?: "grid" | "flex";
}) {
  return (
    <div
      className={cn("platform-v6-kpi-strip", className)}
      style={
        layout === "grid"
          ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
          : undefined
      }
    >
      {items.map((item) => (
        <PlatformV6KpiCell key={item.id} {...item} />
      ))}
    </div>
  );
}
