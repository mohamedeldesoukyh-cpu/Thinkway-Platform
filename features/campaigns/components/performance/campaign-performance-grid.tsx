"use client";

import { format, isValid, parseISO } from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { DeliverableExplorerPlatformPill } from "@/features/campaigns/components/deliverables/deliverable-explorer-cells";
import { EngagementRateDisplay } from "@/features/campaigns/components/performance/engagement-rate-display";
import {
  PerformanceExplorerCreatorCell,
  PerformanceMetricsStatusBadge,
  PublicationDuplicateBadge,
} from "@/features/campaigns/components/performance/performance-explorer-cells";
import {
  duplicateNormalizedUrlSet,
  notesHaveDuplicateMarker,
  normalizePublicationContentUrl,
} from "@/lib/campaigns/publication-content-url";
import {
  schedulePublicationWorkspaceOpen,
} from "@/features/campaigns/components/performance/publication-workspace/publication-workspace-open-policy";
import {
  buildPerformanceGridTemplate,
  isPerformanceGridColumnRightAligned,
} from "@/features/campaigns/components/performance/performance-grid-column-layout";
import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";
import {
  PublicationContentPreviewThumb,
  PublicationPlatformThumb,
} from "@/lib/performance/publication-grid-visual";
import {
  formatCompactCount,
  formatMoneyValue,
} from "@/lib/campaigns/performance-calculations";
import { resolvePublicationRowCreatorAvatar } from "@/lib/performance/creator-avatar";
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
  /** Full campaign publication set for duplicate URL detection (defaults to `rows`). */
  allRows?: CampaignPublicationRow[];
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
      return "text-[var(--camp-green)]";
    case "partial":
      return "text-[var(--camp-amber)]";
    case "collecting":
      return "text-[var(--camp-blue)]";
    case "manual_required":
      return "text-[var(--camp-amber)]";
    case "failed":
      return "text-[var(--camp-red)]";
    default:
      return "text-[var(--camp-text-3)]";
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
    const av = key === "status" ? a.metrics_refresh_status : a[key];
    const bv = key === "status" ? b.metrics_refresh_status : b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
    return String(av).localeCompare(String(bv)) * factor;
  });
}

export function CampaignPerformanceGrid({
  rows,
  allRows,
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

  const duplicateUrlKeys = useMemo(
    () =>
      duplicateNormalizedUrlSet((allRows ?? rows).map((row) => row.content_url)),
    [allRows, rows]
  );

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
          sortableKey && "cursor-pointer"
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
            <PerformanceExplorerCreatorCell
              name={row.influencer_name}
              platform={row.platform}
              avatarUrl={resolvePublicationRowCreatorAvatar(row)}
              profileUrl={row.influencer_profile_url}
              influencerId={row.influencer_id}
              onOpenPublication={() => schedulePublicationWorkspaceOpen(row.id, onOpenDetail)}
            />
          </div>
        );
      case "platform":
        return (
          <div key={columnId} className="flex items-center justify-center px-2">
            <DeliverableExplorerPlatformPill platform={row.platform} />
          </div>
        );
      case "type": {
        const normalized = normalizePublicationContentUrl(row.content_url);
        const showDuplicate =
          notesHaveDuplicateMarker(row.notes) ||
          (Boolean(normalized) && duplicateUrlKeys.has(normalized!));
        return (
          <div key={columnId} className="flex min-w-0 items-center gap-1 px-2">
            <span className="truncate text-[10px] text-[var(--camp-text-3)]">
              {row.publication_type_label}
            </span>
            {showDuplicate ? <PublicationDuplicateBadge className="shrink-0" /> : null}
          </div>
        );
      }
      case "published":
        return (
          <div key={columnId} className="px-2 text-[11px] text-[var(--camp-text-3)]">
            {safeDate(row.publication_date)}
          </div>
        );
      case "views":
        return (
          <div key={columnId} className="px-2 text-right tabular-nums text-[12px]">
            {formatCompactCount(row.views)}
          </div>
        );
      case "reach":
        return (
          <div key={columnId} className="px-2 text-right text-[12px]">
            <ReachDisplay
              reach={row.reach}
              reachSource={row.reach_source}
              forecastReach={row.forecast_reach}
              compact
            />
          </div>
        );
      case "impressions":
        return (
          <div key={columnId} className="px-2 text-right text-[12px]">
            <ImpressionsDisplay
              impressions={row.impressions}
              impressionsSource={row.impressions_source}
              forecastImpressions={row.forecast_impressions}
              forecastFormula={row.forecast_impressions_formula}
              compact
            />
          </div>
        );
      case "likes":
        return (
          <div key={columnId} className="px-2 text-right tabular-nums text-[12px]">
            {formatCompactCount(row.likes)}
          </div>
        );
      case "comments":
        return (
          <div key={columnId} className="px-2 text-right tabular-nums text-[12px]">
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
          <div key={columnId} className="px-2 text-right">
            <EngagementRateDisplay
              rate={row.engagement_rate}
              method={row.engagement_rate_method}
            />
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
          <div key={columnId} className="px-2">
            <PerformanceMetricsStatusBadge status={row.metrics_refresh_status} />
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
                <button
                  type="button"
                  className="thinkway-campaign-menu-btn"
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="Publication actions"
                >
                  ⋯
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem onSelect={() => onRefreshMetrics(row.id)}>
                  <RefreshCwIcon className="mr-1 inline size-3" />
                  Refresh metrics
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => schedulePublicationWorkspaceOpen(row.id, onOpenDetail)}
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
                  onSelect={() => onRemovePublication(row.id)}
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
      <div className="thinkway-campaign-perf-grid-shell flex min-h-0 flex-col">
        <div className="thinkway-campaign-table-scroll min-h-0 flex-1">
          <div className="min-w-[960px]">
            <div
              className="thinkway-campaign-perf-grid-header grid"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {visibleColumns.map((columnId) =>
                renderHeaderCell(columnId as PerformanceGridColumnId)
              )}
            </div>

            {pageRows.length === 0 ? (
              <div className="thinkway-campaign-empty-state">
                <p className="font-medium text-[var(--camp-text-2)]">
                  {rows.length === 0
                    ? "Performance unlocks after creators publish. Metrics appear once the campaign enters Publication stage."
                    : "No publications match your filters."}
                </p>
                <p className="mt-1 text-[12px] text-[var(--camp-text-3)]">
                  {rows.length === 0
                    ? "Use Add publication to start tracking live posts and metrics."
                    : "Clear filters or adjust search to see more rows."}
                </p>
              </div>
            ) : (
              pageRows.map((row) => (
                <div
                  key={row.id}
                  className={cn(
                    "thinkway-campaign-perf-grid-row grid items-center",
                    selectedIds.has(row.id) && "thinkway-campaign-perf-grid-row--selected"
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
