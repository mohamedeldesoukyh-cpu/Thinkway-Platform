"use client";

import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EnrichmentMetricField } from "@/components/forms/enrichment-metric-field";
import { Button } from "@/components/ui/button";
import { fetchProfileEnrichment } from "@/lib/social/fetch-profile-enrichment";
import {
  getPlatformMetricsHelper,
  type MetricsSource,
} from "@/lib/social/enrichment/metrics-status";

type PlatformMetricsSectionProps = {
  platform: string;
  profileUrl: string;
  influencerId?: string;
  accountId?: string;
  followerCount: string;
  engagementRate: string;
  avgViews: string;
  metricsSource: MetricsSource;
  metricsIsManualOverride: boolean;
  metricFieldSources: {
    followers: MetricsSource;
    engagement: MetricsSource;
    avg_views: MetricsSource;
  };
  onFollowersChange: (value: string) => void;
  onEngagementChange: (value: string) => void;
  onAvgViewsChange: (value: string) => void;
  onRefreshEnrichment: (
    payload: Awaited<ReturnType<typeof fetchProfileEnrichment>>
  ) => void;
  fieldIdPrefix: string;
};

export function PlatformMetricsSection({
  platform,
  profileUrl,
  influencerId,
  accountId,
  followerCount,
  engagementRate,
  avgViews,
  metricsSource,
  metricsIsManualOverride,
  metricFieldSources,
  onFollowersChange,
  onEngagementChange,
  onAvgViewsChange,
  onRefreshEnrichment,
  fieldIdPrefix,
}: PlatformMetricsSectionProps) {
  const [refreshing, setRefreshing] = useState(false);
  const helperText = getPlatformMetricsHelper(platform);

  async function handleRefresh() {
    if (!profileUrl.trim()) {
      toast.error("Add a profile URL before refreshing enrichment.");
      return;
    }

    setRefreshing(true);
    try {
      const result = await fetchProfileEnrichment({
        profile_url: profileUrl,
        platform,
        influencer_id: influencerId,
        account_id: accountId,
      });

      if (result.error || !result.parsed) {
        toast.error(result.error ?? "Refresh failed — enter metrics manually.");
        return;
      }

      onRefreshEnrichment(result);

      const messages = result.enrichment?.messages ?? [];
      toast.success(
        messages.length > 0
          ? messages.join(" · ")
          : "Enrichment refreshed — review metrics below."
      );
    } catch {
      toast.error("Refresh failed — manual entry still available.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">Audience metrics</p>
          <p className="text-xs text-muted-foreground">
            Highlighted fields are editable. Empty values mean enrichment did not
            return data — not zero followers.
          </p>
          {helperText ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {helperText}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={refreshing || !profileUrl.trim()}
          onClick={() => void handleRefresh()}
        >
          <RefreshCwIcon
            className={refreshing ? "size-4 animate-spin" : "size-4"}
            data-icon="inline-start"
          />
          Refresh enrichment
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <EnrichmentMetricField
          id={`${fieldIdPrefix}-followers`}
          label="Followers"
          value={followerCount}
          fieldSource={
            metricsIsManualOverride && followerCount.trim()
              ? "manual"
              : metricFieldSources.followers || metricsSource
          }
          isManualOverride={metricsIsManualOverride}
          onChange={onFollowersChange}
        />
        <EnrichmentMetricField
          id={`${fieldIdPrefix}-engagement`}
          label="Engagement %"
          value={engagementRate}
          fieldSource={
            metricsIsManualOverride && engagementRate.trim()
              ? "manual"
              : metricFieldSources.engagement || metricsSource
          }
          isManualOverride={metricsIsManualOverride}
          onChange={onEngagementChange}
          max={100}
          step="0.01"
        />
        <EnrichmentMetricField
          id={`${fieldIdPrefix}-avg-views`}
          label="Avg views"
          value={avgViews}
          fieldSource={
            metricsIsManualOverride && avgViews.trim()
              ? "manual"
              : metricFieldSources.avg_views || metricsSource
          }
          isManualOverride={metricsIsManualOverride}
          onChange={onAvgViewsChange}
        />
      </div>
    </div>
  );
}
