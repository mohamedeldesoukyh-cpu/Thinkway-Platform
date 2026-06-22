"use client";

import {
  BadgeCheckIcon,
  UserIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { platformLabel } from "@/features/campaigns/line-assignment";
import type { CreatorCompareBundle } from "@/lib/creators/creator-compare-bundle";
import { cn } from "@/lib/utils";

import {
  buildCompareMetricRows,
  creatorHandle,
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
        <div className="sticky top-0 z-20 border-b border-[#E6EAF2] bg-[#FAFBFD] px-3 py-3 text-[10px] font-semibold tracking-wide text-[#9099A8] uppercase">
          Metric
        </div>
        {entries.map((entry) => {
          const p = entry.creator.platforms[0];
          return (
            <div
              key={entry.creator.unified_id}
              className="sticky top-0 z-20 border-b border-l border-[#E6EAF2] bg-[#FAFBFD] px-3 py-3"
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => onOpenCreator(entry.creator.unified_id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <div className="relative shrink-0">
                    {entry.creator.profile_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.creator.profile_image_url}
                        alt=""
                        className="size-10 rounded-full border border-[#E6EAF2] object-cover"
                      />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-full border border-[#E6EAF2] bg-white">
                        <UserIcon className="size-4 text-[#9099A8]" />
                      </div>
                    )}
                    {entry.creator.is_platform_verified ? (
                      <BadgeCheckIcon
                        className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full bg-white text-[#0057FF]"
                        aria-label="Verified"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-[#0B0F1A] hover:text-[#0057FF]">
                      {entry.creator.display_name}
                    </p>
                    <p className="truncate text-[10px] text-[#9099A8]">
                      {creatorHandle(entry.creator)}
                    </p>
                    <p className="truncate text-[10px] capitalize text-[#5B6575]">
                      {p ? platformLabel(p.platform) : "—"}
                    </p>
                  </div>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 p-0 text-[#9099A8]"
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
              <div className="border-b border-[#E6EAF2] bg-[#FAFBFD] px-3 py-3 text-[10px] font-semibold tracking-wide text-[#9099A8] uppercase">
                {row.label}
              </div>
              {row.cells.map((cell, colIndex) => (
                <div
                  key={`${row.id}-${colIndex}`}
                  className={cn(
                    "border-b border-l border-[#E6EAF2] px-3 py-3 text-[12px] text-[#0B0F1A]",
                    best.has(colIndex) && "bg-[#EEF4FF] font-semibold text-[#0057FF]"
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
