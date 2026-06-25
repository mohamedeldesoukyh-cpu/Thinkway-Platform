"use client";

import { ChevronLeftIcon, ChevronRightIcon, type LucideIcon } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OperationalKpiValueSemantic } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { operationalKpiValueClass } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";

export type KpiCarouselItem = {
  id: string;
  label: string;
  value: string;
  icon: LucideIcon;
  accentClass?: string;
  /** Semantic platform coloring for the value text. */
  valueSemantic?: OperationalKpiValueSemantic;
  /** Numeric value for gp/margin semantic coloring. */
  valueNumeric?: number;
  /** Optional secondary line under the value (e.g. reach breakdown). */
  subtext?: string;
  /** Tint value text only — card chrome stays uniform. */
  valueAlert?: "warning" | "danger";
  /** Explicit value text class (overrides valueSemantic / valueAlert). */
  valueClassName?: string;
  /** @deprecated Use valueAlert */
  alert?: "warning" | "danger";
};

type KpiCarouselProps = {
  items: KpiCarouselItem[];
  className?: string;
  /** Side scroll buttons (disable on campaign workspace for grid alignment). */
  showNavigation?: boolean;
};

export function KpiCarousel({ items, className, showNavigation = true }: KpiCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.max(240, el.clientWidth * 0.75);
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className={cn("flex min-w-0 items-stretch gap-2", className)}>
      {showNavigation ? (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="hidden shrink-0 self-center shadow-sm md:inline-flex"
          onClick={() => scroll("left")}
          aria-label="Scroll KPIs left"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
      ) : null}

      <div
        ref={scrollRef}
        className={cn(
          "flex min-w-0 gap-2 overflow-x-auto pb-1 scroll-smooth snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          showNavigation ? "flex-1" : "w-full"
        )}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const valueTone = item.valueAlert ?? item.alert;
          const semanticClass = operationalKpiValueClass(item.valueSemantic, item.valueNumeric);
          return (
            <div
              key={item.id}
              className="flex min-w-[168px] max-w-[168px] shrink-0 snap-start items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  item.accentClass ?? "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] text-muted-foreground">{item.label}</p>
                <p
                  className={cn(
                    "truncate font-heading text-sm font-bold tracking-tight tabular-nums",
                    item.valueClassName ??
                      cn(
                        semanticClass,
                        valueTone === "danger" && "text-destructive",
                        valueTone === "warning" && "text-warning"
                      )
                  )}
                >
                  {item.value}
                </p>
                {item.subtext ? (
                  <p className="truncate text-[10px] text-muted-foreground">{item.subtext}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {showNavigation ? (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="hidden shrink-0 self-center shadow-sm md:inline-flex"
          onClick={() => scroll("right")}
          aria-label="Scroll KPIs right"
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
