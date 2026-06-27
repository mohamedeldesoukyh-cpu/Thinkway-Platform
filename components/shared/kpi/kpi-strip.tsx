"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  KpiCard,
  kpiCarouselItemToCardProps,
  type KpiCarouselItem,
} from "./kpi-card";
import {
  KPI_LOADING_SKELETON_COUNT,
  KPI_MIXED_CURRENCY_DEFAULT_LABEL,
  KPI_STRIP_CARD_CLASS,
  KPI_STRIP_CARD_WIDTH,
} from "./kpi-config";

export type { KpiCarouselItem };

export type KpiStripProps = {
  items: KpiCarouselItem[];
  className?: string;
  /** Side scroll buttons (disable on campaign workspace for grid alignment). */
  showNavigation?: boolean;
  /** Horizontal scroll (default) or responsive grid. */
  layout?: "scroll" | "grid";
  /** Tighter cards — pairs well with grid layout. */
  dense?: boolean;
  /** Grid column template when layout is grid. */
  gridClassName?: string;
  loading?: boolean;
  loadingCount?: number;
  /** Renders mixed-currency disclaimer above the strip when truthy. */
  mixedCurrencyNotice?: string | boolean;
  children?: ReactNode;
  footer?: ReactNode;
};

function KpiStripLoadingSkeleton({ count }: { count: number }) {
  return (
    <div className="flex gap-2 overflow-hidden pb-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(KPI_STRIP_CARD_CLASS, KPI_STRIP_CARD_WIDTH)}
        >
          <Skeleton className="size-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function KpiMixedCurrencyNotice({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <p className={cn("text-[11px] text-muted-foreground", className)}>
      {label ?? KPI_MIXED_CURRENCY_DEFAULT_LABEL}
    </p>
  );
}

export function KpiStrip({
  items,
  className,
  showNavigation = true,
  layout = "scroll",
  dense = false,
  gridClassName,
  loading,
  loadingCount = KPI_LOADING_SKELETON_COUNT,
  mixedCurrencyNotice,
  children,
  footer,
}: KpiStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.max(240, el.clientWidth * 0.75);
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {typeof mixedCurrencyNotice === "string" ? (
          <KpiMixedCurrencyNotice label={mixedCurrencyNotice} />
        ) : null}
        <KpiStripLoadingSkeleton count={loadingCount} />
      </div>
    );
  }

  const noticeText =
    mixedCurrencyNotice === true
      ? KPI_MIXED_CURRENCY_DEFAULT_LABEL
      : typeof mixedCurrencyNotice === "string"
        ? mixedCurrencyNotice
        : undefined;

  const stripOptions = { dense, fluid: layout === "grid" };

  if (layout === "grid") {
    return (
      <div className={cn("space-y-2", dense && "flex h-full min-h-0 flex-col", className)}>
        {children}
        {noticeText ? <KpiMixedCurrencyNotice label={noticeText} /> : null}
        <div
          className={cn(
            "grid auto-rows-fr items-stretch gap-1.5",
            dense && "min-h-0 flex-1",
            gridClassName ?? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
          )}
        >
          {items.map((item) => (
            <KpiCard
              key={item.id}
              {...kpiCarouselItemToCardProps(item, stripOptions)}
            />
          ))}
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {children}
      {noticeText ? <KpiMixedCurrencyNotice label={noticeText} /> : null}
      <div className="flex min-w-0 items-stretch gap-2">
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
            showNavigation ? "flex-1" : "w-full",
          )}
        >
          {items.map((item) => (
            <KpiCard
              key={item.id}
              {...kpiCarouselItemToCardProps(item, stripOptions)}
            />
          ))}
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
      {footer}
    </div>
  );
}

/** @deprecated Use KpiStrip — kept for backward-compatible imports. */
export function KpiCarousel(props: KpiStripProps) {
  return <KpiStrip {...props} />;
}
