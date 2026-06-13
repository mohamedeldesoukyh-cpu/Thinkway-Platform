"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  GripVerticalIcon,
  StarIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useReportsHubPreferences } from "@/hooks/use-reports-hub-preferences";
import { REPORT_HUB_LINKS_BY_ID } from "@/lib/reports/report-hub-links";
import { getReportsHubDisplayOrder } from "@/lib/reports/reports-hub-preferences";
import { cn } from "@/lib/utils";

export function ReportsHubView() {
  const {
    order,
    favoriteSet,
    viewMode,
    moveReport,
    toggleFavorite,
    setViewMode,
    hydrated,
  } = useReportsHubPreferences();

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const displayOrder = useMemo(
    () => getReportsHubDisplayOrder(order, favoriteSet),
    [order, favoriteSet]
  );

  const visibleOrder = useMemo(
    () =>
      viewMode === "favorites"
        ? displayOrder.filter((id) => favoriteSet.has(id))
        : displayOrder,
    [displayOrder, favoriteSet, viewMode]
  );

  const clearDragState = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (toDisplayIndex: number) => {
    if (dragIndex == null || dragIndex === toDisplayIndex) {
      clearDragState();
      return;
    }

    const fromId = visibleOrder[dragIndex];
    const toId = visibleOrder[toDisplayIndex];
    if (!fromId || !toId) {
      clearDragState();
      return;
    }

    const fromOrderIndex = order.indexOf(fromId);
    const toOrderIndex = order.indexOf(toId);
    if (fromOrderIndex < 0 || toOrderIndex < 0) {
      clearDragState();
      return;
    }

    moveReport(fromOrderIndex, toOrderIndex);
    clearDragState();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Drag to reorder · Star to favorite
        </p>

        <div
          className="inline-flex items-center rounded-lg border border-border/70 bg-muted/30 p-0.5"
          role="group"
          aria-label="Report view"
        >
          {(
            [
              { value: "all", label: "All reports" },
              { value: "favorites", label: "Favorites" },
            ] as const
          ).map((option) => {
            const active = viewMode === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={active ? "default" : "ghost"}
                className={cn(
                  "h-7 px-2.5 text-xs",
                  !active && "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={active}
                onClick={() => setViewMode(option.value)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>

      {hydrated && viewMode === "favorites" && visibleOrder.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No favorites yet — star reports to add them
        </p>
      ) : (
      <div
        className={cn(
          "grid gap-3 md:grid-cols-3 xl:grid-cols-4",
          !hydrated && "opacity-0"
        )}
      >
        {visibleOrder.map((reportId, index) => {
          const report = REPORT_HUB_LINKS_BY_ID[reportId];
          if (!report) return null;

          const Icon = report.icon;
          const isFavorite = favoriteSet.has(reportId);

          return (
            <Card
              key={reportId}
              size="sm"
              className={cn(
                "h-auto gap-3 transition-shadow",
                dragOverIndex === index &&
                  dragIndex !== index &&
                  "ring-2 ring-[var(--brand-product)]/40",
                dragIndex === index && "opacity-50"
              )}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverIndex(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(index);
              }}
            >
              <CardHeader className="gap-1 pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <span
                      draggable
                      title="Drag to reorder"
                      aria-label={`Reorder ${report.title}`}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(index));
                        setDragIndex(index);
                      }}
                      onDragEnd={clearDragState}
                      className={cn(
                        "mt-0.5 inline-flex shrink-0 cursor-grab touch-none items-center rounded-md p-1",
                        "text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
                      )}
                    >
                      <GripVerticalIcon className="size-3.5" aria-hidden />
                    </span>
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <Icon className={`size-4 ${report.tint}`} />
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={
                      isFavorite
                        ? `Remove ${report.title} from favorites`
                        : `Add ${report.title} to favorites`
                    }
                    aria-pressed={isFavorite}
                    onClick={() => toggleFavorite(reportId)}
                    className={cn(
                      "shrink-0 text-muted-foreground hover:text-amber-500",
                      isFavorite && "text-amber-500 hover:text-amber-600"
                    )}
                  >
                    <StarIcon
                      className={cn("size-3.5", isFavorite && "fill-current")}
                      aria-hidden
                    />
                  </Button>
                </div>

                <CardTitle className="mt-2 text-sm">{report.title}</CardTitle>
                <CardDescription className="line-clamp-2 text-xs leading-snug">
                  {report.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                  <Link href={report.href}>
                    Open report
                    <ArrowRightIcon data-icon="inline-end" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}
    </div>
  );
}
