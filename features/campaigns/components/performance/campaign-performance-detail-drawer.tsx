"use client";

import Link from "next/link";
import { ExternalLinkIcon, PlayIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  DetailField,
  DetailPanelHeader,
  DetailPill,
  DetailTabList,
  DETAIL_TAB_TRIGGER_CLASS,
  OperationalDetailSheet,
} from "@/features/campaigns/components/operational-detail-panel";
import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";
import {
  formatCompactCount,
  formatMoneyValue,
  formatPercent,
} from "@/lib/campaigns/performance-calculations";
import { formatAssignmentDetailDate, initialsFromName } from "@/lib/campaigns/assignment-detail-presenters";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: CampaignPublicationRow | null;
  campaignName: string;
};

function MediaPreview({ row }: { row: CampaignPublicationRow }) {
  const thumb = row.thumbnail_url;
  const url = row.content_url;

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-lg border border-[#E6EAF2] bg-[#FAFBFD]">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <PlayIcon className="size-8 opacity-40" />
          </div>
        )}
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-[#0057FF] hover:underline"
        >
          Open live content
          <ExternalLinkIcon className="size-3.5" />
        </a>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        {row.platform_label} · {row.publication_type_label}
      </p>
    </div>
  );
}

export function CampaignPerformanceDetailDrawer({
  open,
  onOpenChange,
  row,
  campaignName,
}: Props) {
  const title = row?.publication_type_label ?? "Publication";

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
            title={row.influencer_name ?? row.publication_type_label}
            badges={
              <>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {row.status.replace(/_/g, " ")}
                </Badge>
                <DetailPill>{row.platform_label}</DetailPill>
                {row.sync_status ? <DetailPill>Sync: {row.sync_status}</DetailPill> : null}
              </>
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
                      <Link href={`/vendors/${row.influencer_id}`} className="hover:text-primary hover:underline">
                        {row.influencer_name ?? "—"}
                      </Link>
                    ) : (
                      row.influencer_name ?? "—"
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
                  <DetailField label="Reach">{formatCompactCount(row.reach)}</DetailField>
                  <DetailField label="Impressions">{formatCompactCount(row.impressions)}</DetailField>
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
                <DetailField label="Sync source">{row.sync_source ?? "manual"}</DetailField>
                <DetailField label="Sync status">{row.sync_status ?? "—"}</DetailField>
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
