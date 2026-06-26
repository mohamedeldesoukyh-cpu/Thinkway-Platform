"use client";

import { format, isValid, parseISO } from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useOperationalColumnVisibleChecker,
  useOperationalTableColumnsContext,
} from "@/components/tables/operational-table-column-context";
import {
  schedulePublicationWorkspaceOpen,
} from "@/features/campaigns/components/performance/publication-workspace/publication-workspace-open-policy";
import {
  buildPerformanceGridTemplate,
  isPerformanceGridColumnRightAligned,
} from "@/features/campaigns/components/performance/performance-grid-column-layout";
import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";
import { PublicationCreatorName } from "@/lib/performance/publication-creator-identity";
import {
  PublicationContentPreviewThumb,
  PublicationPlatformThumb,
} from "@/lib/performance/publication-grid-visual";
import {
  ENGAGEMENT_RATE_METHOD_LABELS,
  engagementRateMethodTooltip,
  type EngagementRateMethod,
} from "@/lib/performance/engagement-rate-engine";
import {
  formatCompactCount,
  formatMoneyValue,
  formatPercent,
} from "@/lib/campaigns/performance-calculations";
import { ReachDisplay } from "@/features/campaigns/components/performance/reach-display";
import { ImpressionsDisplay } from "@/features/campaigns/components/performance/impressions-display";
import type { PerformanceGridColumnId } from "@/lib/tables/performance-grid-column-metas";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

type SortKey =
  | "influencer_name"
  | "publication_date"
  | "views"
  | "reach"
  | "impressions"
  | "engagement_rate"
  | "cost"
  | "status";

const SORT_KEY_BY_COLUMN: Partial<Record<PerformanceGridColumnId, SortKey>> = {
  creator: "influencer_name",
  published: "publication_date",
  views: "views",
  reach: "reach",
  impressions: "impressions",
  engagementRate: "engagement_rate",
  cost: "cost",
  status: "status",
};

const HEADER_LABELS: Partial<Record<PerformanceGridColumnId, string>> = {
  platformThumb: "Thumb",
  contentPreview: "Preview",
  creator: "Creator",
  platform: "Platform",
  type: "Type",
  published: "Published",
  views: "Views",
  reach: "Reach",
  impressions: "Impr.",
  likes: "Likes",
  comments: "Cmts",
  shares: "Shares",
  saves: "Saves",
  engagementRate: "ER %",
  cost: "Cost",
  cpv: "CPV",
  cpe: "CPE",
  status: "Status",
  metricsStatus: "Metrics",
};

type Props = {
  rows: CampaignPublicationRow[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onOpenDetail: (id: string) => void;
  onRemovePublication: (id: string) => void;
  onRefreshMetrics: (id: string) => void;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
};

function refreshStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return status.replace(/_/g, " ");
}

function refreshStatusClass(status: string | null | undefined): string {
  switch (status) {
    case "completed":
      return "text-emerald-700";
    case "partial":
      return "text-amber-700";
    case "collecting":
      return "text-[#0057FF]";
    case "manual_required":
      return "text-amber-700";
    case "failed":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

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

function MetricsSourceLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-border px-3 py-1.5 text-[10px] text-muted-foreground"
      aria-label="Reach and impressions source legend"
    >
      <span className="font-medium text-muted-foreground">Reach / Impr.:</span>
      <span className="text-emerald-700">Green = Actual</span>
      <span aria-hidden>·</span>
      <span className="text-amber-700">Amber = Forecast</span>
      <span aria-hidden>·</span>
      <span className="text-[#0057FF]">Blue = Manual</span>
    </div>
  );
}

export function CampaignPerformanceGrid({
  rows,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpenDetail,
  onRemovePublication,
  onRefreshMetrics,
  sortKey,
  sortDir,
  onSort,
}: Props) {
  const [page, setPage] = useState(1);
  const col = useOperationalColumnVisibleChecker();
  const { visibleOrderedColumnIds } = useOperationalTableColumnsContext();

  const sorted = useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageIds = pageRows.map((r) => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const visibleColumns = useMemo(
    () => visibleOrderedColumnIds.filter((id) => col(id)),
    [visibleOrderedColumnIds, col]
  );

  const gridTemplate = useMemo(
    () => buildPerformanceGridTemplate(visibleColumns),
    [visibleColumns]
  );

  function renderHeaderCell(columnId: PerformanceGridColumnId) {
    if (columnId === "select") {
      return (
        <div key={columnId} className="flex items-center justify-center px-2 py-2">
          <Checkbox
            checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
            onCheckedChange={() => onToggleSelectAll(pageIds)}
            aria-label="Select page"
          />
        </div>
      );
    }

    const label = HEADER_LABELS[columnId] ?? "";
    const sortableKey = SORT_KEY_BY_COLUMN[columnId];

    return (
      <button
        key={columnId}
        type="button"
        className={cn(
          "px-2 py-2 text-left",
          isPerformanceGridColumnRightAligned(columnId) && "text-right",
          sortableKey && "hover:text-[#0057FF]"
        )}
        onClick={() => sortableKey && onSort(sortableKey)}
        disabled={!sortableKey}
      >
        {label}
        {sortableKey === sortKey ? (sortDir === "asc" ? " ↑" : " ↓") : null}
      </button>
    );
  }

  function renderCell(columnId: PerformanceGridColumnId, row: CampaignPublicationRow): ReactNode {
    switch (columnId) {
      case "select":
        return (
          <div
            key={columnId}
            className="flex items-center justify-center px-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selectedIds.has(row.id)}
              onCheckedChange={() => onToggleSelect(row.id)}
              aria-label={`Select ${row.influencer_name ?? row.id}`}
            />
          </div>
        );
      case "platformThumb":
        return (
          <div key={columnId} className="px-2">
            <PublicationPlatformThumb row={row} />
          </div>
        );
      case "contentPreview":
        return (
          <div key={columnId} className="px-2">
            <PublicationContentPreviewThumb row={row} />
          </div>
        );
      case "creator":
        return (
          <div key={columnId} className="min-w-0 px-2 text-left">
            <PublicationCreatorName
              row={row}
              name={row.influencer_name ?? "—"}
              stopPropagation
            />
          </div>
        );
      case "platform":
        return (
          <div key={columnId} className="truncate px-2 text-muted-foreground">
            {row.platform_label}
          </div>
        );
      case "type":
        return (
          <div key={columnId} className="truncate px-2">
            {row.publication_type_label}
          </div>
        );
      case "published":
        return (
          <div key={columnId} className="px-2 text-muted-foreground">
            {safeDate(row.publication_date)}
          </div>
        );
      case "views":
        return (
          <div key={columnId} className="px-2 text-right tabular-nums">
            {formatCompactCount(row.views)}
          </div>
        );
      case "reach":
        return (
          <div key={columnId} className="px-2 text-right">
            <ReachDisplay
              reach={row.reach}
              reachSource={row.reach_source}
              forecastReach={row.forecast_reach}
            />
          </div>
        );
      case "impressions":
        return (
          <div key={columnId} className="px-2 text-right">
            <ImpressionsDisplay
              impressions={row.impressions}
              impressionsSource={row.impressions_source}
              forecastImpressions={row.forecast_impressions}
              forecastFormula={row.forecast_impressions_formula}
            />
          </div>
        );
      case "likes":
        return (
          <div key={columnId} className="px-2 text-right tabular-nums">
            {formatCompactCount(row.likes)}
          </div>
        );
      case "comments":
        return (
          <div key={columnId} className="px-2 text-right tabular-nums">
            {formatCompactCount(row.comments)}
          </div>
        );
      case "shares":
        return (
          <div key={columnId} className="px-2 text-right tabular-nums">
            {formatCompactCount(row.shares)}
          </div>
        );
      case "saves":
        return (
          <div key={columnId} className="px-2 text-right tabular-nums">
            {formatCompactCount(row.saves)}
          </div>
        );
      case "engagementRate":
        return (
          <div key={columnId} className="px-2 text-right tabular-nums font-medium text-[#0057FF]">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help underline decoration-dotted underline-offset-2">
                  {formatPercent(row.engagement_rate, 1)}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Method:{" "}
                {ENGAGEMENT_RATE_METHOD_LABELS[
                  (row.engagement_rate_method ?? "unknown") as EngagementRateMethod
                ] ?? "Unknown"}
                {engagementRateMethodTooltip(
                  (row.engagement_rate_method ?? "unknown") as EngagementRateMethod
                )
                  ? ` — ${engagementRateMethodTooltip((row.engagement_rate_method ?? "unknown") as EngagementRateMethod)}`
                  : ""}
              </TooltipContent>
            </Tooltip>
          </div>
        );
      case "cost":
        return (
          <div key={columnId} className="px-2 text-right tabular-nums">
            {formatMoneyValue(row.cost, row.currency ?? "USD")}
          </div>
        );
      case "cpv":
        return (
          <div key={columnId} className="px-2 text-right tabular-nums">
            {formatMoneyValue(row.cpv, row.currency ?? "USD")}
          </div>
        );
      case "cpe":
        return (
          <div key={columnId} className="px-2 text-right tabular-nums">
            {formatMoneyValue(row.cpe, row.currency ?? "USD")}
          </div>
        );
      case "status":
        return (
          <div key={columnId} className="px-2 capitalize text-muted-foreground">
            {row.status.replace(/_/g, " ")}
          </div>
        );
      case "metricsStatus":
        return (
          <div
            key={columnId}
            className={cn("px-2 capitalize", refreshStatusClass(row.metrics_refresh_status))}
          >
            {refreshStatusLabel(row.metrics_refresh_status)}
          </div>
        );
      case "actions":
        return (
          <div
            key={columnId}
            className="flex justify-end px-1"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  onClick={() => onRefreshMetrics(row.id)}
                >
                  <RefreshCwIcon className="mr-1 inline size-3" />
                  Refresh metrics
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    schedulePublicationWorkspaceOpen(row.id, onOpenDetail);
                  }}
                >
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
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => e.preventDefault()}
                  onClick={() => onRemovePublication(row.id)}
                >
                  <Trash2Icon className="mr-1 inline size-3" />
                  Remove line
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
        <MetricsSourceLegend />
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="min-w-[960px]">
            <div
              className="sticky top-0 z-10 grid border-b border-border bg-muted text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {visibleColumns.map((columnId) =>
                renderHeaderCell(columnId as PerformanceGridColumnId)
              )}
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
                    "grid h-14 items-center border-b border-border text-[11px] hover:bg-muted",
                    selectedIds.has(row.id) && "bg-[#EEF4FF]/60"
                  )}
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  {visibleColumns.map((columnId) =>
                    renderCell(columnId as PerformanceGridColumnId, row)
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {sorted.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
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
    </TooltipProvider>
  );
}
