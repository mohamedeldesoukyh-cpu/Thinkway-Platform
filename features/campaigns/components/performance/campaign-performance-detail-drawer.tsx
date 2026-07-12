"use client";

import {
  DownloadIcon,
  ExternalLinkIcon,
  PlayIcon,
  RefreshCwIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DetailField,
  DetailPanelHeader,
  DetailPill,
  DetailTabList,
  DETAIL_TAB_TRIGGER_CLASS,
  OperationalDetailSheet,
} from "@/features/campaigns/components/operational-detail-panel";
import { ReachDisplay } from "@/features/campaigns/components/performance/reach-display";
import { ImpressionsDisplay } from "@/features/campaigns/components/performance/impressions-display";
import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";
import type { ReachSource } from "@/lib/performance/reach-forecast-engine";
import type { ImpressionsSource } from "@/lib/performance/impressions-forecast-engine";
import {
  formatCompactCount,
  formatMoneyValue,
  formatPercent,
} from "@/lib/campaigns/performance-calculations";
import {
  PublicationCreatorAvatar,
  PublicationCreatorName,
  resolvePublicationCreatorAvatarDisplay,
} from "@/lib/performance/publication-creator-identity";
import { resolvePublicationContentPreviewUrl } from "@/lib/performance/publication-preview";
import { formatAssignmentDetailDate, initialsFromName } from "@/lib/campaigns/assignment-detail-presenters";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: CampaignPublicationRow | null;
  campaignName: string;
  onRefreshMetrics: (publicationId: string) => void;
  isRefreshing?: boolean;
};

function MediaPreview({ row }: { row: CampaignPublicationRow }) {
  const screenshotUrl = resolvePublicationContentPreviewUrl(row);
  const url = row.content_url;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <PublicationCreatorAvatar row={row} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{row.influencer_name ?? "Creator"}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] capitalize">
              {row.platform_label}
            </Badge>
            {row.publication_date ? (
              <span className="text-[11px] text-muted-foreground">
                {formatAssignmentDetailDate(row.publication_date)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
        {screenshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={screenshotUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <PlayIcon className="size-8 opacity-40" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Views", formatCompactCount(row.views)],
          ["Likes", formatCompactCount(row.likes)],
          ["Comments", formatCompactCount(row.comments)],
          ["ER", formatPercent(row.engagement_rate, 1)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-muted px-3 py-2 text-center"
          >
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {url ? (
          <Button size="sm" variant="outline" className="h-8" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon className="mr-1 size-3.5" />
              Open in platform
            </a>
          </Button>
        ) : null}
        {screenshotUrl ? (
          <Button size="sm" variant="outline" className="h-8" asChild>
            <a href={screenshotUrl} download target="_blank" rel="noopener noreferrer">
              <DownloadIcon className="mr-1 size-3.5" />
              Download screenshot
            </a>
          </Button>
        ) : null}
      </div>

      <div className="space-y-0 border-t border-border pt-3">
        {row.metrics_provider ?? row.metrics_collection_source ? (
          <DetailField label="Source provider">
            <Badge variant="secondary" className="text-[10px] capitalize">
              {row.metrics_provider ?? row.metrics_collection_source}
            </Badge>
          </DetailField>
        ) : null}
        {row.screenshot_source ? (
          <DetailField label="Screenshot source">{row.screenshot_source}</DetailField>
        ) : null}
        {row.screenshot_captured_at ? (
          <DetailField label="Screenshot captured">
            {formatAssignmentDetailDate(row.screenshot_captured_at)}
          </DetailField>
        ) : null}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {row.publication_type_label}
        {row.metrics_confidence != null ? ` · Confidence ${row.metrics_confidence}%` : ""}
      </p>
    </div>
  );
}

export function CampaignPerformanceDetailDrawer({
  open,
  onOpenChange,
  row,
  campaignName,
  onRefreshMetrics,
  isRefreshing = false,
}: Props) {
  const title = row?.publication_type_label ?? "Publication";
  const avatarDisplay = row ? resolvePublicationCreatorAvatarDisplay(row) : null;
  const avatarUrl = avatarDisplay?.kind === "image" ? avatarDisplay.url : null;

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${title} performance`}
      description={`Campaign performance details for ${campaignName}`}
    >
      {!row ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading publication…
        </div>
      ) : (
        <>
          <DetailPanelHeader
            breadcrumb={
              <>
                {campaignName}
                <span className="text-muted-foreground/60"> / </span>
                <span className="text-foreground/80">{row.platform_label}</span>
              </>
            }
            avatarInitials={initialsFromName(row.influencer_name ?? title)}
            avatarUrl={avatarUrl}
            title={row.influencer_name ?? row.publication_type_label}
            badges={
              <>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {row.status.replace(/_/g, " ")}
                </Badge>
                <DetailPill>{row.platform_label}</DetailPill>
                {row.metrics_refresh_status ? (
                  <DetailPill className="capitalize">
                    Metrics: {row.metrics_refresh_status.replace(/_/g, " ")}
                  </DetailPill>
                ) : null}
                {row.metrics_collection_source ? (
                  <DetailPill>Source: {row.metrics_collection_source}</DetailPill>
                ) : null}
                {row.sync_status ? <DetailPill>Sync: {row.sync_status}</DetailPill> : null}
              </>
            }
            actions={
              row ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={isRefreshing}
                  onClick={() => onRefreshMetrics(row.id)}
                >
                  <RefreshCwIcon className="mr-1 size-3.5" />
                  Refresh metrics
                </Button>
              ) : null
            }
          />

          <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
            <DetailTabList>
              <TabsList
                variant="line"
                className="h-auto w-full justify-start gap-3 overflow-x-auto rounded-none bg-transparent p-0"
              >
                {[
                  "overview",
                  "performance",
                  "audience",
                  "comments",
                  "media",
                  "history",
                  "ai",
                ].map((tab) => (
                  <TabsTrigger key={tab} value={tab} className={DETAIL_TAB_TRIGGER_CLASS}>
                    {tab === "ai" ? "AI Insights" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </DetailTabList>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <TabsContent value="overview" className="mt-0 outline-none">
                <div className="px-1">
                  <DetailField label="Creator">
                    {row.influencer_id ? (
                      <PublicationCreatorName
                        row={row}
                        name={row.influencer_name ?? "—"}
                        nameHref={`/vendors/${row.influencer_id}`}
                      />
                    ) : (
                      <PublicationCreatorName row={row} name={row.influencer_name ?? "—"} />
                    )}
                  </DetailField>
                  <DetailField label="Content type">{row.publication_type_label}</DetailField>
                  <DetailField label="Published">
                    {formatAssignmentDetailDate(row.publication_date)}
                  </DetailField>
                  <DetailField label="Caption" valueClassName="max-w-[70%] text-left">
                    {row.caption?.trim() || "—"}
                  </DetailField>
                  <DetailField label="Hashtags">{row.hashtags?.trim() || "—"}</DetailField>
                  <DetailField label="Mentions">{row.mentions?.trim() || "—"}</DetailField>
                </div>
              </TabsContent>

              <TabsContent value="performance" className="mt-0 outline-none">
                <div className="grid gap-0 px-1 sm:grid-cols-2">
                  <DetailField label="Views">{formatCompactCount(row.views)}</DetailField>
                  <DetailField label="Reach">
                    <ReachDisplay
                      reach={row.reach}
                      reachSource={row.reach_source as ReachSource | null}
                      forecastReach={row.forecast_reach}
                      layout="stacked"
                      showPreviousForecast
                    />
                  </DetailField>
                  <DetailField label="Impressions">
                    <ImpressionsDisplay
                      impressions={row.impressions}
                      impressionsSource={row.impressions_source as ImpressionsSource | null}
                      forecastImpressions={row.forecast_impressions}
                      forecastFormula={row.forecast_impressions_formula}
                      layout="stacked"
                      showPreviousForecast
                    />
                  </DetailField>
                  <DetailField label="Engagements">{formatCompactCount(row.total_engagements)}</DetailField>
                  <DetailField label="ER %">{formatPercent(row.engagement_rate)}</DetailField>
                  <DetailField label="Cost">{formatMoneyValue(row.cost, row.currency ?? "USD")}</DetailField>
                  <DetailField label="CPV">{formatMoneyValue(row.cpv, row.currency ?? "USD")}</DetailField>
                  <DetailField label="CPE">{formatMoneyValue(row.cpe, row.currency ?? "USD")}</DetailField>
                  <DetailField label="CPM">{formatMoneyValue(row.cpm, row.currency ?? "USD")}</DetailField>
                  <DetailField label="Likes">{formatCompactCount(row.likes)}</DetailField>
                  <DetailField label="Comments">{formatCompactCount(row.comments)}</DetailField>
                  <DetailField label="Shares">{formatCompactCount(row.shares)}</DetailField>
                  <DetailField label="Saves">{formatCompactCount(row.saves)}</DetailField>
                </div>
              </TabsContent>

              <TabsContent value="audience" className="mt-0 outline-none">
                <DetailField label="Unique views">{formatCompactCount(row.unique_views)}</DetailField>
                <DetailField label="Completion rate">{formatPercent(row.completion_rate)}</DetailField>
                <DetailField label="Avg watch time">
                  {row.average_watch_time_seconds != null
                    ? `${row.average_watch_time_seconds.toFixed(1)}s`
                    : "—"}
                </DetailField>
              </TabsContent>

              <TabsContent value="comments" className="mt-0 outline-none">
                <p className="text-sm text-muted-foreground">
                  Comment-level insights will populate when API sync is enabled.
                </p>
                <DetailField label="Comment count">{formatCompactCount(row.comments)}</DetailField>
              </TabsContent>

              <TabsContent value="media" className="mt-0 outline-none">
                <MediaPreview row={row} />
              </TabsContent>

              <TabsContent value="history" className="mt-0 outline-none">
                <DetailField label="Created">{formatAssignmentDetailDate(row.created_at)}</DetailField>
                <DetailField label="Last synced">
                  {formatAssignmentDetailDate(row.last_synced_at)}
                </DetailField>
                <DetailField label="Sync source">{row.metrics_provider ?? row.sync_source ?? "manual"}</DetailField>
                <DetailField label="Sync status">{row.metrics_refresh_status ?? row.sync_status ?? "—"}</DetailField>
                <DetailField label="Metrics attempted">
                  {formatAssignmentDetailDate(row.metrics_refresh_attempted_at)}
                </DetailField>
              </TabsContent>

              <TabsContent value="ai" className="mt-0 outline-none">
                <DetailField label="Sentiment score">
                  {row.sentiment_score != null ? row.sentiment_score.toFixed(1) : "—"}
                </DetailField>
                <DetailField label="Brand safety">
                  {row.brand_safety_score != null ? row.brand_safety_score.toFixed(1) : "—"}
                </DetailField>
                <DetailField label="Authenticity">
                  {row.authenticity_score != null ? row.authenticity_score.toFixed(1) : "—"}
                </DetailField>
              </TabsContent>
            </div>
          </Tabs>
        </>
      )}
    </OperationalDetailSheet>
  );
}
