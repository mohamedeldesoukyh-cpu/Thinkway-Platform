"use client";

import { ChevronLeftIcon, ChevronRightIcon, type LucideIcon } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type KpiCarouselItem = {
  id: string;
  label: string;
  value: string;
  icon: LucideIcon;
  accentClass?: string;
  alert?: "warning" | "danger";
};

type KpiCarouselProps = {
  items: KpiCarouselItem[];
  className?: string;
};

export function KpiCarousel({ items, className }: KpiCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.max(240, el.clientWidth * 0.75);
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="absolute top-1/2 left-0 z-10 hidden -translate-x-1/2 -translate-y-1/2 shadow-sm md:flex"
        onClick={() => scroll("left")}
        aria-label="Scroll KPIs left"
      >
        <ChevronLeftIcon className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="absolute top-1/2 right-0 z-10 hidden translate-x-1/2 -translate-y-1/2 shadow-sm md:flex"
        onClick={() => scroll("right")}
        aria-label="Scroll KPIs right"
      >
        <ChevronRightIcon className="size-4" />
      </Button>

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-1 scroll-smooth snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={cn(
                "flex min-w-[168px] max-w-[168px] shrink-0 snap-start items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm",
                item.alert === "danger" &&
                  "border-red-500/40 bg-red-500/5 dark:bg-red-500/10",
                item.alert === "warning" &&
                  "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10"
              )}
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
                    "truncate font-heading text-sm font-bold tracking-tight",
                    item.alert === "danger" && "text-red-600 dark:text-red-400",
                    item.alert === "warning" && "text-amber-700 dark:text-amber-300"
                  )}
                >
                  {item.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
