"use client";

import { useMemo, useState } from "react";
import {
  GripVerticalIcon,
  StarIcon,
} from "lucide-react";

import {
  FinanceSuiteDeck,
  FinanceSuiteEmpty,
  FinanceSuiteTile,
} from "@/components/finance/suite";
import { useReportsHubPreferences } from "@/hooks/use-reports-hub-preferences";
import {
  REPORT_HUB_LINKS_BY_ID,
  REPORT_HUB_SUITE_GROUP,
  REPORT_HUB_SUITE_GROUPS,
  REPORT_HUB_SUITE_TILE_VARIANT,
} from "@/lib/reports/report-hub-links";
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

  function renderTile(reportId: (typeof visibleOrder)[number], index: number) {
    const report = REPORT_HUB_LINKS_BY_ID[reportId];
    if (!report) return null;

    const isFavorite = favoriteSet.has(reportId);
    const group = REPORT_HUB_SUITE_GROUP[reportId];
    const variant = REPORT_HUB_SUITE_TILE_VARIANT[group];

    return (
      <div
        key={reportId}
        className={cn(
          "relative",
          dragOverIndex === index && dragIndex !== index && "ring-2 ring-[var(--fs-blue)]/40 rounded-2xl",
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
            "absolute left-3 top-3 z-[2] inline-flex cursor-grab touch-none items-center rounded-md p-1 hover:bg-white/10 active:cursor-grabbing",
            variant === "soft" ? "text-[var(--fs-bi)]" : "text-white/70"
          )}
        >
          <GripVerticalIcon className="size-3.5" aria-hidden />
        </span>
        <button
          type="button"
          className={cn("fs-star", variant === "soft" && "!bg-[rgba(0,87,255,.1)] !text-[var(--fs-bi)]")}
          aria-label={
            isFavorite
              ? `Remove ${report.title} from favorites`
              : `Add ${report.title} to favorites`
          }
          aria-pressed={isFavorite}
          onClick={() => toggleFavorite(reportId)}
        >
          <StarIcon className={cn("size-3", isFavorite && "fill-current")} aria-hidden />
        </button>
        <FinanceSuiteTile
          kicker={group}
          title={report.title}
          description={report.description}
          href={report.href}
          go="Open report"
          variant={variant}
        />
      </div>
    );
  }

  return (
    <div className="thinkway-campaign-section-card">
      <div className="thinkway-campaign-section-head">
        <div className="min-w-0">
          <h2>Performance reports</h2>
          <p>Drag to reorder · star to favourite · {visibleOrder.length} reports</p>
        </div>
        <div className="fs-seg" role="group" aria-label="Report view">
          {(
            [
              { value: "all", label: "All reports" },
              { value: "favorites", label: "Favourites" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={viewMode === option.value}
              onClick={() => setViewMode(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("fs-pad", !hydrated && "opacity-0")}>
        {hydrated && viewMode === "favorites" && visibleOrder.length === 0 ? (
          <FinanceSuiteEmpty
            title="No favourites yet"
            body="Star reports to add them here. Favourites stay on this view until you unstar them."
          />
        ) : viewMode === "favorites" ? (
          <FinanceSuiteDeck>
            {visibleOrder.map((reportId, index) => renderTile(reportId, index))}
          </FinanceSuiteDeck>
        ) : (
          REPORT_HUB_SUITE_GROUPS.map((group) => {
            const ids = visibleOrder.filter((id) => REPORT_HUB_SUITE_GROUP[id] === group);
            if (ids.length === 0) return null;
            return (
              <div key={group}>
                <div className="fs-grp">
                  {group} · {ids.length}
                </div>
                <FinanceSuiteDeck className="mb-[18px]">
                  {ids.map((reportId) =>
                    renderTile(reportId, visibleOrder.indexOf(reportId))
                  )}
                </FinanceSuiteDeck>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
