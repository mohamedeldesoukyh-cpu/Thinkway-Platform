"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  BrainIcon,
  CameraIcon,
  DownloadIcon,
  ExternalLinkIcon,
  HistoryIcon,
  ImageIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  loadPublicationSyncLogsAction,
  restoreAutomaticPublicationMetricsAction,
  saveManualPublicationMetricsAction,
  savePublicationDetailsAction,
  requestPublicationScreenshotAction,
} from "@/features/campaigns/actions/performance-actions";
import { PublicationWorkspaceEmptyState } from "@/features/campaigns/components/performance/publication-workspace/publication-workspace-empty-state";
import { EngagementRateDisplay } from "@/features/campaigns/components/performance/publication-workspace/engagement-rate-display";
import { PublicationWorkspaceSheet } from "@/features/campaigns/components/performance/publication-workspace/publication-workspace-sheet";
import type {
  CampaignPublicationRow,
  PublicationMetricSyncLogRow,
} from "@/features/campaigns/queries/publications";
import {
  formatCompactCount,
  formatMoneyValue,
  formatPercent,
} from "@/lib/campaigns/performance-calculations";
import { countStorageTags } from "@/lib/performance/content-normalizer";
import { formatAssignmentDetailDate } from "@/lib/campaigns/assignment-detail-presenters";
import { ReachDisplay } from "@/features/campaigns/components/performance/reach-display";
import { ImpressionsDisplay } from "@/features/campaigns/components/performance/impressions-display";
import type { ReachSource } from "@/lib/performance/reach-forecast-engine";
import type { ImpressionsSource } from "@/lib/performance/impressions-forecast-engine";
import { PublicationCreatorName } from "@/lib/performance/publication-creator-identity";
import { PublicationCreatorAvatar } from "@/lib/performance/publication-creator-identity";
import { resolvePublicationContentPreviewUrl } from "@/lib/performance/publication-preview";
import {
  isInstagramHiddenLikes,
  isInstagramPhotoOrCarousel,
  metricsSourceBadge,
  metricsSourceBadgeLabel,
  ENGAGEMENT_RATE_METHOD_LABELS,
  type EngagementRateMethod,
} from "@/lib/performance/engagement-rate-engine";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: CampaignPublicationRow | null;
  campaignId: string;
  campaignName: string;
  onRefreshMetrics: (publicationId: string) => void;
  onRemovePublication?: (publicationId: string) => void;
  onPublicationUpdated?: () => void;
  isRefreshing?: boolean;
};

function ContentSection({
  label,
  value,
  count,
}: {
  label: string;
  value: string | null | undefined;
  count?: number | null;
}) {
  const text = value?.trim();
  const displayCount = count ?? (text ? countStorageTags(text) : 0);
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {label !== "Caption" && displayCount > 0 ? (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium tabular-nums">
            {displayCount}
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{text || "—"}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "completed":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800";
    case "partial":
    case "manual_required":
      return "border-amber-500/30 bg-amber-500/10 text-amber-900";
    case "failed":
      return "border-red-500/30 bg-red-500/10 text-red-800";
    case "collecting":
    case "queued":
      return "border-blue-500/30 bg-blue-500/10 text-blue-800";
    default:
      return "border-border/60 bg-muted/40 text-foreground";
  }
}

function erMethodLabel(method: string | null | undefined): string {
  if (!method) return "Unknown";
  return ENGAGEMENT_RATE_METHOD_LABELS[method as EngagementRateMethod] ?? method;
}

function SyncLogReachAudit({ log }: { log: PublicationMetricSyncLogRow }) {
  if (log.status !== "reach_source_changed") return null;
  const summary = log.response_summary as Record<string, unknown> | null;
  if (!summary) return null;
  const oldSource = summary.old_source ?? summary.previous_reach_source;
  const newSource = summary.new_source ?? summary.new_reach_source;
  if (!oldSource && !newSource) return null;
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      Reach: {String(summary.old_value ?? "—")} ({String(oldSource ?? "—")}) →{" "}
      {String(summary.new_value ?? "—")} ({String(newSource ?? "—")})
    </p>
  );
}

function SyncLogErAudit({ log }: { log: PublicationMetricSyncLogRow }) {
  if (log.status !== "er_recalculated") return null;
  if (log.previous_er == null && log.new_er == null && !log.previous_method && !log.new_method) {
    return null;
  }
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      ER: {formatPercent(log.previous_er, 1)} ({erMethodLabel(log.previous_method)}) →{" "}
      {formatPercent(log.new_er, 1)} ({erMethodLabel(log.new_method)})
    </p>
  );
}

export function PublicationWorkspace({
  open,
  onOpenChange,
  row,
  campaignId,
  campaignName,
  onRefreshMetrics,
  onRemovePublication,
  onPublicationUpdated,
  isRefreshing = false,
}: Props) {
  const [activeTab, setActiveTab] = useState("overview");
  const [syncLogs, setSyncLogs] = useState<PublicationMetricSyncLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [manualMetrics, setManualMetrics] = useState({
    views: "",
    reach: "",
    impressions: "",
    likes: "",
    comments: "",
    shares: "",
    saves: "",
  });
  const [publicationDetails, setPublicationDetails] = useState({
    publication_date: "",
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !row) return;

    setManualMetrics({
      views: row.views != null ? String(row.views) : "",
      reach: row.reach != null ? String(row.reach) : "",
      impressions: row.impressions != null ? String(row.impressions) : "",
      likes: row.likes != null ? String(row.likes) : "",
      comments: row.comments != null ? String(row.comments) : "",
      shares: row.shares != null ? String(row.shares) : "",
      saves: row.saves != null ? String(row.saves) : "",
    });
    setPublicationDetails({
      publication_date: toDateInputValue(row.publication_date),
    });

    let cancelled = false;
    void (async () => {
      setLogsLoading(true);
      const result = await loadPublicationSyncLogsAction({
        campaignId,
        publicationId: row.id,
      });
      if (cancelled) return;
      setLogsLoading(false);
      if (result.ok) setSyncLogs(result.logs);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, row, campaignId]);

  if (!row) {
    return (
      <PublicationWorkspaceSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Publication workspace"
        description={campaignName}
      >
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading publication…
        </div>
      </PublicationWorkspaceSheet>
    );
  }

  const publicationRow = row;

  const previewUrl = resolvePublicationContentPreviewUrl(row);
  const provider = row.metrics_provider ?? row.metrics_collection_source ?? "—";
  const lastSync = row.last_synced_at ?? row.metrics_refresh_attempted_at;
  const sourceBadge = metricsSourceBadge(row.metrics_provider, row.engagement_rate_method as EngagementRateMethod | null);
  const sourceBadgeLabel = metricsSourceBadgeLabel(sourceBadge);
  const igPhotoNoViews =
    isInstagramPhotoOrCarousel(row.platform, row.publication_type) && row.views == null;
  const igHiddenLikes = isInstagramHiddenLikes(row.platform, row.likes, undefined, {
    hasOtherEngagement: (row.comments ?? 0) > 0 || (row.shares ?? 0) > 0 || (row.saves ?? 0) > 0,
  });

  const kpiCards = [
    ["Views", formatCompactCount(row.views)],
    ["Reach", null],
    ["Impressions", null],
    ["Likes", igHiddenLikes ? "Hidden" : formatCompactCount(row.likes)],
    ["Comments", formatCompactCount(row.comments)],
    ["Shares", formatCompactCount(row.shares)],
    ["Saves", formatCompactCount(row.saves)],
    ["Engagements", formatCompactCount(row.total_engagements)],
    ["CPM", formatMoneyValue(row.cpm, row.currency ?? "USD")],
    ["CPV", formatMoneyValue(row.cpv, row.currency ?? "USD")],
    ["CPE", formatMoneyValue(row.cpe, row.currency ?? "USD")],
  ] as const;

  function savePublicationDetails() {
    startTransition(async () => {
      const result = await savePublicationDetailsAction({
        campaignId,
        publicationId: publicationRow.id,
        details: {
          publication_date:
            publicationDetails.publication_date.trim() === ""
              ? null
              : publicationDetails.publication_date,
        },
      });
      if (result.ok) {
        toast.success(result.message);
        onPublicationUpdated?.();
      } else toast.error(result.message);
    });
  }

  function saveManualMetrics() {
    startTransition(async () => {
      const parseNum = (v: string) => (v.trim() === "" ? null : Number(v.replace(/,/g, "")));
      const result = await saveManualPublicationMetricsAction({
        campaignId,
        publicationId: publicationRow.id,
        metrics: {
          views: parseNum(manualMetrics.views),
          reach: parseNum(manualMetrics.reach),
          impressions: parseNum(manualMetrics.impressions),
          likes: parseNum(manualMetrics.likes),
          comments: parseNum(manualMetrics.comments),
          shares: parseNum(manualMetrics.shares),
          saves: parseNum(manualMetrics.saves),
        },
      });
      if (result.ok) {
        toast.success(result.message);
        onPublicationUpdated?.();
      } else toast.error(result.message);
    });
  }

  function restoreAutomatic() {
    startTransition(async () => {
      const result = await restoreAutomaticPublicationMetricsAction({
        campaignId,
        publicationId: publicationRow.id,
      });
      if (result.ok) {
        toast.success(result.message);
        onPublicationUpdated?.();
      } else toast.error(result.message);
    });
  }

  function requeueScreenshot() {
    startTransition(async () => {
      const result = await requestPublicationScreenshotAction({
        campaignId,
        publicationId: publicationRow.id,
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <PublicationWorkspaceSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${row.influencer_name ?? "Publication"} workspace`}
      description={`${campaignName} · ${row.platform_label}`}
    >
      <TooltipProvider delayDuration={200}>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/90">
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <PublicationCreatorAvatar row={row} size="lg" className="size-14" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold">
                    {row.influencer_name ?? "Creator"}
                  </h2>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {row.platform_label}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {campaignName} · {row.publication_type_label}
                  {row.publication_date
                    ? ` · ${formatAssignmentDetailDate(row.publication_date)}`
                    : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {row.metrics_refresh_status ? (
                    <Badge className={cn("text-[10px] capitalize", statusBadgeClass(row.metrics_refresh_status))}>
                      Metrics: {row.metrics_refresh_status.replace(/_/g, " ")}
                    </Badge>
                  ) : null}
                  {row.sync_status ? (
                    <Badge variant="outline" className="text-[10px] capitalize">
                      Sync: {row.sync_status}
                    </Badge>
                  ) : null}
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    Source: {sourceBadgeLabel}
                  </Badge>
                  {row.metrics_collection_source && row.metrics_collection_source !== row.metrics_provider ? (
                    <Badge variant="outline" className="text-[10px] capitalize">
                      Provider: {provider}
                    </Badge>
                  ) : null}
                  {row.metrics_confidence != null ? (
                    <Badge variant="outline" className="text-[10px]">
                      {row.metrics_confidence}% confidence
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={isRefreshing || isPending}
              onClick={() => onRefreshMetrics(row.id)}
            >
              <RefreshCwIcon className="mr-1 size-3.5" />
              Refresh metrics
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => setActiveTab("manual")}
            >
              <PencilIcon className="mr-1 size-3.5" />
              Edit metrics
            </Button>
            {row.content_url ? (
              <Button size="sm" variant="outline" className="h-8" asChild>
                <a href={row.content_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon className="mr-1 size-3.5" />
                  Open live post
                </a>
              </Button>
            ) : null}
            {previewUrl ? (
              <Button size="sm" variant="outline" className="h-8" asChild>
                <a href={previewUrl} download target="_blank" rel="noopener noreferrer">
                  <DownloadIcon className="mr-1 size-3.5" />
                  Download screenshot
                </a>
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={requeueScreenshot}>
                  Regenerate screenshot
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  onClick={() => onRefreshMetrics(row.id)}
                >
                  Requeue metrics
                </DropdownMenuItem>
                {onRemovePublication ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={(e) => e.preventDefault()}
                      onClick={() => onRemovePublication(row.id)}
                    >
                      <Trash2Icon className="mr-1 inline size-3" />
                      Delete publication
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <TabsList variant="line" className="h-auto w-full justify-start gap-4 overflow-x-auto rounded-none bg-transparent px-6 p-0">
            {[
              ["overview", "Overview"],
              ["performance", "Performance"],
              ["history", "Metrics history"],
              ["manual", "Manual metrics"],
              ["audience", "Audience"],
              ["comments", "Comments"],
              ["media", "Media assets"],
              ["audit", "Audit"],
              ["ai", "AI insights"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-none px-0 pb-3 pt-1 text-xs data-[state=active]:font-semibold"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="overview" className="mt-0 px-6 py-4 outline-none">
            {(igPhotoNoViews || igHiddenLikes) && (
              <div className="mb-4 space-y-2">
                {igPhotoNoViews ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950">
                    Instagram does not publicly expose view counts for this content type.
                  </div>
                ) : null}
                {igHiddenLikes ? (
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Likes hidden by creator
                  </div>
                ) : null}
              </div>
            )}
            <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
              <div className="space-y-4">
                <div className="overflow-hidden rounded-xl border border-border bg-muted">
                  <div className="relative aspect-video">
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <ImageIcon className="size-8 opacity-40" />
                        <p className="text-xs">No screenshot captured yet</p>
                        <Button size="sm" variant="outline" className="h-8" onClick={requeueScreenshot}>
                          Capture screenshot
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card p-3 sm:col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Publication date
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {row.publication_date
                        ? formatAssignmentDetailDate(row.publication_date)
                        : "—"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <ContentSection label="Caption" value={row.caption} />
                  </div>
                  <ContentSection
                    label="Hashtags"
                    value={row.hashtags}
                    count={row.hashtag_count}
                  />
                  <ContentSection
                    label="Mentions"
                    value={row.mentions}
                    count={row.mention_count}
                  />
                  <div className="rounded-xl border border-border bg-card p-3 sm:col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Creator
                    </p>
                    <div className="mt-1 text-sm text-foreground">
                      {row.influencer_id ? (
                        <Link
                          href={`/vendors/${row.influencer_id}`}
                          className="hover:text-primary hover:underline"
                        >
                          <PublicationCreatorName
                            row={row}
                            name={row.influencer_name ?? "View profile"}
                          />
                        </Link>
                      ) : (
                        <PublicationCreatorName row={row} name={row.influencer_name} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                <div className="col-span-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Engagement rate
                  </p>
                  <EngagementRateDisplay
                    engagementRate={row.engagement_rate}
                    method={row.engagement_rate_method}
                    className="mt-1"
                  />
                </div>
                {kpiCards.map(([label, value]) =>
                  label === "Reach" ? (
                    <div
                      key={label}
                      className="col-span-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Reach
                      </p>
                      <ReachDisplay
                        reach={row.reach}
                        reachSource={row.reach_source as ReachSource | null}
                        forecastReach={row.forecast_reach}
                        layout="stacked"
                        showPreviousForecast
                        className="mt-1"
                      />
                    </div>
                  ) : label === "Impressions" ? (
                    <div
                      key={label}
                      className="col-span-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Impressions
                      </p>
                      <ImpressionsDisplay
                        impressions={row.impressions}
                        impressionsSource={row.impressions_source as ImpressionsSource | null}
                        forecastImpressions={row.forecast_impressions}
                        forecastFormula={row.forecast_impressions_formula}
                        layout="stacked"
                        showPreviousForecast
                        className="mt-1"
                      />
                    </div>
                  ) : (
                    <MetricCard
                      key={label}
                      label={label}
                      value={value}
                      sub={lastSync ? `Last sync ${formatAssignmentDetailDate(lastSync)}` : undefined}
                    />
                  )
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="mt-0 px-6 py-4 outline-none">
            <div className="mb-4 max-w-xs rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Engagement rate
              </p>
              <EngagementRateDisplay
                engagementRate={row.engagement_rate}
                method={row.engagement_rate_method}
                className="mt-1"
              />
            </div>
            <div className="mb-4 max-w-sm rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Reach
              </p>
              <ReachDisplay
                reach={row.reach}
                reachSource={row.reach_source as ReachSource | null}
                forecastReach={row.forecast_reach}
                layout="stacked"
                showPreviousForecast
                className="mt-1"
              />
            </div>
            <div className="mb-4 max-w-sm rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Impressions
              </p>
              <ImpressionsDisplay
                impressions={row.impressions}
                impressionsSource={row.impressions_source as ImpressionsSource | null}
                forecastImpressions={row.forecast_impressions}
                forecastFormula={row.forecast_impressions_formula}
                layout="stacked"
                showPreviousForecast
                className="mt-1"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {kpiCards
                .filter(([label]) => label !== "Reach" && label !== "Impressions")
                .map(([label, value]) => (
                <MetricCard key={label} label={label} value={value ?? "-"} sub={`Provider: ${provider}`} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-0 px-6 py-4 outline-none">
            {logsLoading ? (
              <p className="text-sm text-muted-foreground">Loading sync history…</p>
            ) : syncLogs.length === 0 ? (
              <PublicationWorkspaceEmptyState
                icon={HistoryIcon}
                title="No sync history yet"
                description="Metrics collection runs will appear here with provider, duration, and values captured."
                actionLabel="Refresh metrics"
                onAction={() => onRefreshMetrics(row.id)}
              />
            ) : (
              <div className="space-y-2">
                {syncLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {log.provider ?? "unknown"}
                        </Badge>
                        <Badge
                          className={cn(
                            "text-[10px] capitalize",
                            log.status === "er_recalculated"
                              ? "border-violet-500/30 bg-violet-500/10 text-violet-900"
                              : log.status === "reach_source_changed"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900"
                                : statusBadgeClass(log.status)
                          )}
                        >
                          {log.status === "er_recalculated"
                            ? "ER audit"
                            : log.status === "reach_source_changed"
                              ? "Reach audit"
                              : log.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatAssignmentDetailDate(log.created_at)}
                        {log.duration_ms != null ? ` · ${log.duration_ms}ms` : ""}
                      </span>
                    </div>
                    {log.message ? (
                      <p className="mt-1 text-xs text-muted-foreground">{log.message}</p>
                    ) : null}
                    <SyncLogErAudit log={log} />
                    <SyncLogReachAudit log={log} />
                    {log.metrics_snapshot &&
                    log.status !== "er_recalculated" &&
                    log.status !== "reach_source_changed" ? (
                      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                        {JSON.stringify(log.metrics_snapshot)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="mt-0 px-6 py-4 outline-none">
            <div className="max-w-xl space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Publication details
                </p>
                <p className="text-xs text-muted-foreground">
                  Set the live post date manually. When metrics sync pulls a platform date, it
                  overwrites this value automatically.
                </p>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Publication date
                  </label>
                  <Input
                    type="date"
                    value={publicationDetails.publication_date}
                    onChange={(e) =>
                      setPublicationDetails({ publication_date: e.target.value })
                    }
                    className="h-9"
                  />
                </div>
                <Button size="sm" variant="outline" disabled={isPending} onClick={savePublicationDetails}>
                  Save publication date
                </Button>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                Override provider metrics for client reporting. Saves with provider <strong>manual</strong> and
                writes an audit log entry.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["views", "Views"],
                    ["reach", "Reach"],
                    ["impressions", "Impressions"],
                    ["likes", "Likes"],
                    ["comments", "Comments"],
                    ["shares", "Shares"],
                    ["saves", "Saves"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {label}
                    </label>
                    <Input
                      value={manualMetrics[key]}
                      onChange={(e) =>
                        setManualMetrics((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      inputMode="numeric"
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={isPending} onClick={saveManualMetrics}>
                  Save manual metrics
                </Button>
                <Button size="sm" variant="outline" disabled={isPending} onClick={restoreAutomatic}>
                  Restore automatic metrics
                </Button>
              </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="audience" className="mt-0 px-6 py-4 outline-none">
            {row.unique_views != null || row.completion_rate != null ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard label="Unique views" value={formatCompactCount(row.unique_views)} />
                <MetricCard label="Completion rate" value={formatPercent(row.completion_rate)} />
                <MetricCard
                  label="Avg watch time"
                  value={
                    row.average_watch_time_seconds != null
                      ? `${row.average_watch_time_seconds.toFixed(1)}s`
                      : "—"
                  }
                />
              </div>
            ) : (
              <PublicationWorkspaceEmptyState
                icon={UsersIcon}
                title="Audience data not available"
                description="Platform audience breakdowns will appear when the provider returns demographic or watch-time signals."
              />
            )}
          </TabsContent>

          <TabsContent value="comments" className="mt-0 px-6 py-4 outline-none">
            {row.comments != null && row.comments > 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard label="Total comments" value={formatCompactCount(row.comments)} />
                <MetricCard label="Sentiment" value={row.sentiment_score != null ? row.sentiment_score.toFixed(1) : "—"} />
                <MetricCard label="Keywords" value="—" />
              </div>
            ) : (
              <PublicationWorkspaceEmptyState
                icon={MessageSquareIcon}
                title="Comment insights pending"
                description="Comment volume is tracked from metrics sync. Sentiment and keyword analysis will populate when enabled."
                actionLabel="Refresh metrics"
                onAction={() => onRefreshMetrics(row.id)}
              />
            )}
          </TabsContent>

          <TabsContent value="media" className="mt-0 px-6 py-4 outline-none">
            {previewUrl || row.thumbnail_url ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {previewUrl ? (
                    <div className="overflow-hidden rounded-xl border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt="" className="aspect-video w-full object-cover" />
                      <div className="border-t border-border px-3 py-2 text-xs">
                        Screenshot · {row.screenshot_source ?? "unknown"} ·{" "}
                        {row.screenshot_captured_at
                          ? formatAssignmentDetailDate(row.screenshot_captured_at)
                          : "—"}
                      </div>
                    </div>
                  ) : null}
                  {row.thumbnail_url ? (
                    <div className="overflow-hidden rounded-xl border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={row.thumbnail_url} alt="" className="aspect-video w-full object-cover" />
                      <div className="border-t border-border px-3 py-2 text-xs">Platform thumbnail</div>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {previewUrl ? (
                    <Button size="sm" variant="outline" className="h-8" asChild>
                      <a href={previewUrl} download target="_blank" rel="noopener noreferrer">
                        <DownloadIcon className="mr-1 size-3.5" />
                        Download
                      </a>
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" className="h-8" onClick={requeueScreenshot}>
                    <CameraIcon className="mr-1 size-3.5" />
                    Regenerate screenshot
                  </Button>
                </div>
              </div>
            ) : (
              <PublicationWorkspaceEmptyState
                icon={CameraIcon}
                title="No media assets captured"
                description="Queue a screenshot capture from the live post URL or upload assets via bulk import."
                actionLabel="Regenerate screenshot"
                onAction={requeueScreenshot}
              />
            )}
          </TabsContent>

          <TabsContent value="audit" className="mt-0 px-6 py-4 outline-none">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="Provider" value={provider} />
              <MetricCard
                label="Confidence"
                value={row.metrics_confidence != null ? `${row.metrics_confidence}%` : "—"}
              />
              <MetricCard
                label="Last sync"
                value={lastSync ? formatAssignmentDetailDate(lastSync) : "—"}
              />
              <MetricCard label="Screenshot source" value={row.screenshot_source ?? "—"} />
              <MetricCard label="Sync status" value={row.metrics_refresh_status ?? row.sync_status ?? "—"} />
              <MetricCard label="Created" value={formatAssignmentDetailDate(row.created_at)} />
            </div>
          </TabsContent>

          <TabsContent value="ai" className="mt-0 px-6 py-4 outline-none">
            {row.sentiment_score != null ||
            row.authenticity_score != null ||
            row.brand_safety_score != null ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Sentiment"
                  value={row.sentiment_score != null ? row.sentiment_score.toFixed(1) : "—"}
                />
                <MetricCard
                  label="Authenticity"
                  value={row.authenticity_score != null ? row.authenticity_score.toFixed(1) : "—"}
                />
                <MetricCard
                  label="Brand safety"
                  value={row.brand_safety_score != null ? row.brand_safety_score.toFixed(1) : "—"}
                />
                <MetricCard label="Quality score" value="—" />
              </div>
            ) : (
              <PublicationWorkspaceEmptyState
                icon={BrainIcon}
                title="AI insights not generated"
                description="Sentiment, authenticity, and brand safety scores will appear when AI analysis is enabled for this publication."
                actionLabel="View performance"
                onAction={() => setActiveTab("performance")}
              />
            )}
          </TabsContent>
          </div>
        </Tabs>
      </TooltipProvider>
    </PublicationWorkspaceSheet>
  );
}
