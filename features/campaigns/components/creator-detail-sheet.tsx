"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  CreatorProfileLink,
  creatorProfileSourceFromUnified,
} from "@/components/creator/creator-profile-link";
import {
  BadgeCheckIcon,
  ExternalLinkIcon,
  Loader2Icon,
  ShieldCheckIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { CreatorSourceBadge } from "@/features/campaigns/components/creator-source-badge";
import { RefreshCreatorButton } from "@/features/discovery/enrichment/components/refresh-creator-button";
import { enqueueCreatorDetailEnrichment } from "@/features/discovery/enrichment/actions";
import {
  DetailPanelHeader,
  OPERATIONAL_DETAIL_SHEET_CLASS,
  OPERATIONAL_DETAIL_SHEET_STYLE,
} from "@/features/campaigns/components/operational-detail-panel";
import {
  addCreatorToCampaignShortlistAction,
  getCreatorHistoricalMetricsAction,
  getSimilarCreatorsAction,
} from "@/features/campaigns/creator-discovery-actions";
import { platformLabel } from "@/features/campaigns/line-assignment";
import { isAssignableCreator } from "@/lib/creators/adapters";
import type {
  CreatorHistoricalMetrics,
  MetricConfidenceLevel,
  MetricWithConfidence,
  UnifiedCreatorResult,
} from "@/lib/creators/types";
import { resolvePrimaryProfileUrl, profileLinkTooltip } from "@/lib/discovery/profile-url";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import { cn } from "@/lib/utils";

type Props = {
  creator: UnifiedCreatorResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign?: (creator: UnifiedCreatorResult) => void;
  onCreatorUpdated?: (creator: UnifiedCreatorResult) => void;
  campaignHeaderId?: string;
};

const CONFIDENCE_DOT: Record<MetricConfidenceLevel, string> = {
  estimated: "bg-muted-foreground/40",
  inferred: "bg-amber-500",
  verified: "bg-emerald-500",
  oauth_verified: "bg-sky-500",
};

const CONFIDENCE_LABEL: Record<MetricConfidenceLevel, string> = {
  estimated: "Estimated",
  inferred: "Inferred",
  verified: "Verified",
  oauth_verified: "OAuth verified",
};

function formatCount(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function initialsFromName(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function SectionHeading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      <span className="text-muted-foreground/80" aria-hidden>
        {icon}
      </span>
      {children}
    </h3>
  );
}

function Kpi({
  label,
  metric,
  suffix = "",
  accent = false,
}: {
  label: string;
  metric: MetricWithConfidence;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span
          className={cn("size-1.5 shrink-0 rounded-full", CONFIDENCE_DOT[metric.confidence])}
          title={CONFIDENCE_LABEL[metric.confidence]}
        />
      </div>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          accent ? "text-primary" : "text-foreground"
        )}
      >
        {metric.value == null ? "—" : `${formatCount(metric.value)}${suffix}`}
      </p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/40 py-3 last:border-b-0">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0 text-right text-sm text-foreground">{value}</div>
    </div>
  );
}

type LoadedDetail = {
  unifiedId: string;
  similar: Array<UnifiedCreatorResult & { similarity_score: number }>;
  history: CreatorHistoricalMetrics | null;
};

export function CreatorDetailSheet({
  creator,
  open,
  onOpenChange,
  onAssign,
  onCreatorUpdated,
  campaignHeaderId,
}: Props) {
  const [detail, setDetail] = useState<LoadedDetail | null>(null);
  const [displayCreator, setDisplayCreator] = useState<UnifiedCreatorResult | null>(creator);

  useEffect(() => {
    setDisplayCreator(creator);
  }, [creator]);

  useEffect(() => {
    if (!open || !creator) return;
    const unifiedId = creator.unified_id;
    if (creator.influencer_id) {
      void enqueueCreatorDetailEnrichment(creator.influencer_id);
    }
    let active = true;
    void Promise.all([
      getSimilarCreatorsAction(unifiedId),
      getCreatorHistoricalMetricsAction(unifiedId),
    ]).then(([sim, hist]) => {
      if (!active) return;
      setDetail({ unifiedId, similar: sim, history: hist });
    });
    return () => {
      active = false;
    };
  }, [open, creator?.unified_id]);

  if (!displayCreator) return null;

  const matchedDetail = detail?.unifiedId === displayCreator.unified_id ? detail : null;
  const loading = matchedDetail == null;
  const similar = matchedDetail?.similar ?? [];
  const history = matchedDetail?.history ?? null;

  const primary = displayCreator.platforms[0];
  const handle = primary?.handle ? `@${primary.handle.replace(/^@/, "")}` : null;
  const profileUrl = resolvePrimaryProfileUrl(displayCreator.platforms);
  const platformName = primary ? platformLabel(primary.platform) : null;
  const canAssign = isAssignableCreator(displayCreator) && Boolean(onAssign);
  const latestFollowers = history?.followers.at(-1)?.value ?? null;

  function handleCreatorUpdated(next: UnifiedCreatorResult) {
    setDisplayCreator(next);
    onCreatorUpdated?.(next);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        showOverlay={false}
        style={OPERATIONAL_DETAIL_SHEET_STYLE}
        className={OPERATIONAL_DETAIL_SHEET_CLASS}
      >
        <SheetTitle className="sr-only">{displayCreator.display_name} creator profile</SheetTitle>
        <SheetDescription className="sr-only">
          Creator profile, metrics confidence, and similar creators.
        </SheetDescription>

        <DetailPanelHeader
          breadcrumb={
            <>
              {platformName ?? "Creator"}
              {handle ? (
                <>
                  <span className="text-muted-foreground/60"> / </span>
                  <span className="text-foreground/80">{handle}</span>
                </>
              ) : null}
            </>
          }
          actions={
            <div className="flex shrink-0 items-center gap-2">
              {displayCreator.influencer_id ? (
                <RefreshCreatorButton
                  influencerId={displayCreator.influencer_id}
                  unifiedId={displayCreator.unified_id}
                  showTimestamp={false}
                  size="sm"
                  variant="outline"
                  onCreatorUpdated={handleCreatorUpdated}
                />
              ) : null}
              {profileUrl ? (
                <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5">
                  <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon className="size-3.5" />
                    {platformName ? `View on ${platformName}` : "View profile"}
                  </a>
                </Button>
              ) : null}
            </div>
          }
          avatarUrl={displayCreator.profile_image_url}
          avatarInitials={initialsFromName(displayCreator.display_name)}
          profileUrl={profileUrl}
          profileTooltip={profileLinkTooltip(displayCreator.display_name, primary?.platform)}
          title={
            <CreatorProfileLink
              source={creatorProfileSourceFromUnified(displayCreator)}
              size="md"
              showAvatar={false}
              showHandle={false}
              showPlatformBadge={false}
              nameClassName="text-lg font-semibold tracking-tight"
              stopPropagation
            />
          }
          subtitle={
            displayCreator.is_platform_verified ? (
              <BadgeCheckIcon className="size-4 shrink-0 text-primary" aria-label="Platform verified" />
            ) : null
          }
          badges={
            <>
              {primary ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-foreground">
                  <PlatformIcon platform={primary.platform} size="xs" className="size-4 rounded-full" />
                  {platformName}
                </span>
              ) : null}
              <CreatorSourceBadge source={displayCreator.source_type} />
              {displayCreator.estimated_country || displayCreator.country_code ? (
                <span className="inline-flex rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-foreground">
                  {displayCreator.estimated_country ?? displayCreator.country_code}
                  {displayCreator.city ? ` · ${displayCreator.city}` : ""}
                </span>
              ) : null}
            </>
          }
        />

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {displayCreator.bio ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{displayCreator.bio}</p>
          ) : null}

          {/* Thinkway score + relevance */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/80">
                Thinkway score
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-primary">
                {Math.round(displayCreator.thinkway_score)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Source confidence {Math.round(displayCreator.source_confidence)}%
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Brand fit
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
                {displayCreator.brand_fit_score != null ? Math.round(displayCreator.brand_fit_score) : "—"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {(displayCreator.ai_niche ?? displayCreator.ai_category) || "No niche tagged"}
              </p>
            </div>
          </div>

          {/* KPI strip */}
          <section className="space-y-2.5">
            <SectionHeading icon={<UsersIcon className="size-3.5" />}>Audience & engagement</SectionHeading>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Kpi label="Followers" metric={displayCreator.metrics.followers} accent />
              <Kpi label="Engagement" metric={displayCreator.metrics.engagement_rate} suffix="%" />
              <Kpi label="Avg likes" metric={displayCreator.metrics.avg_likes} />
              <Kpi label="Avg comments" metric={displayCreator.metrics.avg_comments} />
              <Kpi label="Avg views" metric={displayCreator.metrics.avg_views} />
              <Kpi label="Posts / week" metric={displayCreator.metrics.posting_frequency_per_week} />
            </div>
          </section>

          {/* Confidence & authenticity */}
          <section className="space-y-2.5">
            <SectionHeading icon={<ShieldCheckIcon className="size-3.5" />}>
              Confidence & authenticity
            </SectionHeading>
            <div className="rounded-xl border border-border/60 bg-muted/15 px-4">
              <MetaRow
                label="Authenticity"
                value={displayCreator.authenticity_score != null ? `${displayCreator.authenticity_score}` : "—"}
              />
              <MetaRow label="Source confidence" value={`${Math.round(displayCreator.source_confidence)}%`} />
              <MetaRow
                label="Verification"
                value={
                  displayCreator.is_platform_verified ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <BadgeCheckIcon className="size-3.5" />
                      Verified
                    </span>
                  ) : (
                    "Unverified"
                  )
                }
              />
              {displayCreator.categories.length > 0 ? (
                <MetaRow
                  label="Categories"
                  value={
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {displayCreator.categories.slice(0, 5).map((category) => (
                        <span
                          key={category}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground"
                        >
                          {category}
                        </span>
                      ))}
                    </div>
                  }
                />
              ) : null}
            </div>
          </section>

          {/* Historical metrics */}
          <section className="space-y-2.5">
            <SectionHeading icon={<TrendingUpIcon className="size-3.5" />}>Historical metrics</SectionHeading>
            {loading ? (
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/15 px-4 py-6 text-[12px] text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Loading historical snapshots…
              </div>
            ) : history && history.followers.length > 0 ? (
              <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3 text-[12px] text-muted-foreground">
                <p className="text-foreground">
                  {history.followers.length} follower snapshot
                  {history.followers.length === 1 ? "" : "s"} recorded
                </p>
                {latestFollowers != null ? (
                  <p className="mt-1">Latest: {latestFollowers.toLocaleString()} followers</p>
                ) : null}
                <p className="mt-2 italic text-muted-foreground/80">
                  Chart visualization — Phase 2 placeholder
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-[12px] text-muted-foreground">
                No historical snapshots yet. Enrichment worker will populate trends.
              </p>
            )}
          </section>

          {/* Similar creators */}
          <section className="space-y-2.5">
            <SectionHeading icon={<SparklesIcon className="size-3.5" />}>Similar creators</SectionHeading>
            {loading ? (
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/15 px-4 py-6 text-[12px] text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Finding similar creators…
              </div>
            ) : similar.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-[12px] text-muted-foreground">
                No similar creators found.
              </p>
            ) : (
              <div className="space-y-2">
                {similar.map((item) => (
                  <div
                    key={item.unified_id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5"
                  >
                    <CreatorProfileLink
                      source={creatorProfileSourceFromUnified(item)}
                      size="sm"
                      stopPropagation
                    />
                    <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                      Similarity {item.similarity_score} · Thinkway {Math.round(item.thinkway_score)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {canAssign || campaignHeaderId ? (
          <div className="shrink-0 border-t border-border/60 px-6 py-4">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {campaignHeaderId ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void addCreatorToCampaignShortlistAction(campaignHeaderId, displayCreator)
                  }
                >
                  Save to shortlist
                </Button>
              ) : null}
              {canAssign ? (
                <Button size="sm" onClick={() => onAssign?.(displayCreator)}>
                  Assign to line
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
