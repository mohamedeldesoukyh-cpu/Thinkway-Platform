"use client";

import { format, isValid, parseISO } from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  UserIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DetailClickableLabel } from "@/features/campaigns/components/detail-sheets/detail-clickable-label";
import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";
import {
  formatCompactCount,
  formatMoneyValue,
  formatPercent,
} from "@/lib/campaigns/performance-calculations";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

const GRID_TEMPLATE =
  "40px 56px minmax(120px,1fr) 72px 88px 88px 72px 72px 72px 56px 56px 56px 56px 56px 64px 56px 56px 72px 48px";

const HEADERS = [
  "",
  "",
  "Creator",
  "Platform",
  "Type",
  "Published",
  "Views",
  "Reach",
  "Impr.",
  "Likes",
  "Cmts",
  "Shares",
  "Saves",
  "ER %",
  "Cost",
  "CPV",
  "CPE",
  "Status",
  "",
] as const;

type SortKey =
  | "influencer_name"
  | "publication_date"
  | "views"
  | "reach"
  | "impressions"
  | "engagement_rate"
  | "cost"
  | "status";

type Props = {
  rows: CampaignPublicationRow[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onOpenDetail: (id: string) => void;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
};

function safeDate(value: string | null): string {
  if (!value) return "—";
  const parsed = parseISO(value.includes("T") ? value : `${value}T00:00:00`);
  if (!isValid(parsed)) return "—";
  return format(parsed, "MMM d, yyyy");
}

function sortRows(
  rows: CampaignPublicationRow[],
  key: SortKey,
  dir: "asc" | "desc"
): CampaignPublicationRow[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
    return String(av).localeCompare(String(bv)) * factor;
  });
}

export function CampaignPerformanceGrid({
  rows,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpenDetail,
  sortKey,
  sortDir,
  onSort,
}: Props) {
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageIds = pageRows.map((r) => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const sortable: SortKey[] = [
    "influencer_name",
    "publication_date",
    "views",
    "reach",
    "impressions",
    "engagement_rate",
    "cost",
    "status",
  ];

  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-[#E6EAF2] bg-white">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[1400px]">
          <div
            className="sticky top-0 z-10 grid border-b border-[#E6EAF2] bg-[#FAFBFD] text-[10px] font-semibold tracking-wide text-[#9099A8] uppercase"
            style={{ gridTemplateColumns: GRID_TEMPLATE }}
          >
            <div className="flex items-center justify-center px-2 py-2">
              <Checkbox
                checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                onCheckedChange={() => onToggleSelectAll(pageIds)}
                aria-label="Select page"
              />
            </div>
            <div className="px-2 py-2">Thumb</div>
            {HEADERS.slice(2).map((label, i) => {
              const colIndex = i + 2;
              const key = sortable.find(
                (k) =>
                  (k === "influencer_name" && label === "Creator") ||
                  (k === "publication_date" && label === "Published") ||
                  (k === "views" && label === "Views") ||
                  (k === "reach" && label === "Reach") ||
                  (k === "impressions" && label === "Impr.") ||
                  (k === "engagement_rate" && label === "ER %") ||
                  (k === "cost" && label === "Cost") ||
                  (k === "status" && label === "Status")
              );
              return (
                <button
                  key={label || `h-${colIndex}`}
                  type="button"
                  className={cn(
                    "px-2 py-2 text-left",
                    [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].includes(colIndex) &&
                      "text-right",
                    key && "hover:text-[#0057FF]"
                  )}
                  onClick={() => key && onSort(key)}
                  disabled={!key}
                >
                  {label}
                  {key === sortKey ? (sortDir === "asc" ? " ↑" : " ↓") : null}
                </button>
              );
            })}
          </div>

          {pageRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No publications match your filters.
            </p>
          ) : (
            pageRows.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "grid h-14 items-center border-b border-[#E6EAF2] text-[11px] hover:bg-[#F5F8FD]",
                  selectedIds.has(row.id) && "bg-[#EEF4FF]/60"
                )}
                style={{ gridTemplateColumns: GRID_TEMPLATE }}
              >
                <div
                  className="flex items-center justify-center px-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selectedIds.has(row.id)}
                    onCheckedChange={() => onToggleSelect(row.id)}
                    aria-label={`Select ${row.influencer_name ?? row.id}`}
                  />
                </div>
                <div className="px-2">
                  {row.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.thumbnail_url}
                      alt=""
                      className="size-9 rounded border border-[#E6EAF2] object-cover"
                    />
                  ) : (
                    <div className="flex size-9 items-center justify-center rounded border border-[#E6EAF2] bg-[#FAFBFD]">
                      <UserIcon className="size-3.5 text-[#9099A8]" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="min-w-0 px-2 text-left"
                  onClick={() => onOpenDetail(row.id)}
                >
                  <DetailClickableLabel onClick={() => onOpenDetail(row.id)}>
                    {row.influencer_name ?? "—"}
                  </DetailClickableLabel>
                </button>
                <div className="truncate px-2 text-[#5B6575]">{row.platform_label}</div>
                <div className="truncate px-2">{row.publication_type_label}</div>
                <div className="px-2 text-[#5B6575]">{safeDate(row.publication_date)}</div>
                <div className="px-2 text-right tabular-nums">{formatCompactCount(row.views)}</div>
                <div className="px-2 text-right tabular-nums">{formatCompactCount(row.reach)}</div>
                <div className="px-2 text-right tabular-nums">
                  {formatCompactCount(row.impressions)}
                </div>
                <div className="px-2 text-right tabular-nums">{formatCompactCount(row.likes)}</div>
                <div className="px-2 text-right tabular-nums">
                  {formatCompactCount(row.comments)}
                </div>
                <div className="px-2 text-right tabular-nums">{formatCompactCount(row.shares)}</div>
                <div className="px-2 text-right tabular-nums">{formatCompactCount(row.saves)}</div>
                <div className="px-2 text-right tabular-nums font-medium text-[#0057FF]">
                  {formatPercent(row.engagement_rate, 1)}
                </div>
                <div className="px-2 text-right tabular-nums">
                  {formatMoneyValue(row.cost, row.currency ?? "USD")}
                </div>
                <div className="px-2 text-right tabular-nums">
                  {formatMoneyValue(row.cpv, row.currency ?? "USD")}
                </div>
                <div className="px-2 text-right tabular-nums">
                  {formatMoneyValue(row.cpe, row.currency ?? "USD")}
                </div>
                <div className="px-2 capitalize">{row.status.replace(/_/g, " ")}</div>
                <div className="flex justify-end px-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-xs">
                      <DropdownMenuItem onClick={() => onOpenDetail(row.id)}>
                        View details
                      </DropdownMenuItem>
                      {row.content_url ? (
                        <DropdownMenuItem asChild>
                          <a href={row.content_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLinkIcon className="mr-1 inline size-3" />
                            Open URL
                          </a>
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {sorted.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between border-t border-[#E6EAF2] px-3 py-2 text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {sorted.length} publications
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeftIcon className="size-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRightIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
