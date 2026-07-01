"use client";

import { XIcon } from "lucide-react";

import {
  CreatorProfileLink,
  creatorProfileSourceFromUnified,
} from "@/components/creator/creator-profile-link";
import { Button } from "@/components/ui/button";
import { platformLabel } from "@/features/campaigns/line-assignment";
import type { CreatorCompareBundle } from "@/lib/creators/creator-compare-bundle";
import { cn } from "@/lib/utils";

import {
  buildCompareMetricRows,
  getBestIndexesForRow,
} from "./compare-matrix-utils";

type Props = {
  bundle: CreatorCompareBundle;
  onRemove: (unifiedId: string) => void;
  onOpenCreator: (unifiedId: string) => void;
};

export function CreatorCompareMatrix({ bundle, onRemove, onOpenCreator }: Props) {
  const entries = bundle.entries;
  const rows = buildCompareMetricRows(bundle);
  const columnCount = entries.length;

  if (columnCount === 0) return null;

  const gridTemplate = `minmax(140px, 180px) repeat(${columnCount}, minmax(160px, 1fr))`;

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div
        className="min-w-[720px]"
        style={{ display: "grid", gridTemplateColumns: gridTemplate }}
      >
        {/* Sticky header row */}
        <div className="sticky top-0 z-20 border-b border-border bg-muted px-3 py-3 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Metric
        </div>
        {entries.map((entry) => {
          const p = entry.creator.platforms[0];
          return (
            <div
              key={entry.creator.unified_id}
              className="sticky top-0 z-20 border-b border-l border-border bg-muted px-3 py-3"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <CreatorProfileLink
                    source={creatorProfileSourceFromUnified(entry.creator)}
                    size="sm"
                    avatarBadge="country"
                    showHandle
                    stopPropagation
                  />
                  <p className="mt-1 truncate text-[10px] capitalize text-muted-foreground">
                    {p ? platformLabel(p.platform) : "—"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 p-0 text-muted-foreground"
                  onClick={() => onRemove(entry.creator.unified_id)}
                  aria-label={`Remove ${entry.creator.display_name}`}
                >
                  <XIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}

        {/* Metric rows */}
        {rows.map((row) => {
          const best = getBestIndexesForRow(row);
          return (
            <div key={row.id} className="contents">
              <div className="border-b border-border bg-muted px-3 py-3 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {row.label}
              </div>
              {row.cells.map((cell, colIndex) => (
                <div
                  key={`${row.id}-${colIndex}`}
                  className={cn(
                    "border-b border-l border-border px-3 py-3 text-[12px] text-foreground",
                    best.has(colIndex) && "bg-[#EEF4FF] font-semibold text-primary"
                  )}
                  title={cell}
                >
                  <span className="line-clamp-2 break-words">{cell}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
