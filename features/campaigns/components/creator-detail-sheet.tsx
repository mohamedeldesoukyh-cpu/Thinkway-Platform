"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  CreatorProfileLink,
  creatorProfileSourceFromUnified,
} from "@/components/creator/creator-profile-link";
import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import {
  BadgeCheckIcon,
  ExternalLinkIcon,
  ImageIcon,
  Loader2Icon,
  PanelLeftIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCreatorMenu } from "@/features/discovery/enrichment/components/refresh-creator-menu";
import { RecentPublicationsGallery } from "@/features/discovery/enrichment/components/recent-publications-gallery";
import { CreatorSourceBadge } from "@/features/campaigns/components/creator-source-badge";
import {
  formatLastUpdated,
  resolveCreatorEnrichmentStatus,
  type CreatorEnrichmentStatus,
} from "@/features/discovery/enrichment/status";
import {
  addCreatorToCampaignShortlistAction,
  getCreatorHistoricalMetricsAction,
  getSimilarCreatorsAction,
  getUnifiedCreatorDetailAction,
} from "@/features/campaigns/creator-discovery-actions";
import { platformLabel } from "@/features/campaigns/line-assignment";
import { isAssignableCreator } from "@/lib/creators/adapters";
import {
  projectCreatorPlatformView,
  sortPlatformsStable,
} from "@/lib/creators/creator-centric";
import { creatorStoredCategoriesForDisplay } from "@/lib/creators/category-filter";
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

type DetailTab = "overview" | "publications" | "confidence" | "similar";

const CREATOR_DETAIL_SHEET_STYLE = {
  width: "min(820px, 100vw)",
  maxWidth: "820px",
} as const;

const CREATOR_DETAIL_SHEET_CLASS = cn(
  "flex flex-col gap-0 overflow-hidden border-l border-border bg-background p-0",
  "!inset-y-0 !right-0 !left-auto !h-full !max-h-none",
  "rounded-none shadow-[-8px_0_40px_rgba(15,23,42,0.1)] dark:shadow-[-8px_0_40px_rgba(0,0,0,0.35)]"
);

const DETAIL_TAB_TRIGGER_CLASS = cn(
  "rounded-none px-0 pb-2.5 pt-2.5 text-xs font-medium text-muted-foreground shadow-none",
  "mr-5 data-[state=active]:font-semibold data-[state=active]:text-blue-600",
  "dark:data-[state=active]:text-blue-400",
  "after:!bottom-0 after:h-0.5 after:bg-blue-600 dark:after:bg-blue-400"
);

const ACTION_BTN_CLASS =
  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border/80 hover:bg-muted/60";

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

const SIMILAR_AVATAR_GRADIENTS = [
  "from-violet-400 to-indigo-400",
  "from-emerald-400 to-emerald-600",
  "from-amber-400 to-orange-500",
  "from-blue-400 to-blue-600",
  "from-pink-400 to-pink-500",
  "from-violet-400 to-violet-700",
  "from-teal-400 to-teal-700",
  "from-amber-400 to-amber-600",
] as const;

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

function gradientForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SIMILAR_AVATAR_GRADIENTS[Math.abs(hash) % SIMILAR_AVATAR_GRADIENTS.length];
}

function SectionTitle({ icon, children, action }: { icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-1.5">
      <span className="text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <h3 className="flex flex-1 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        {children}
      </h3>
      {action}
    </div>
  );
}

function DetailSection({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("border-b border-border px-5 py-[18px] last:border-b-0", className)}>
      {children}
    </section>
  );
}

function PlatformChip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-semibold",
        className
      )}
    >
      {children}
    </span>
  );
}

function KpiCard({
  label,
  metric,
  suffix = "",
  valueClassName,
}: {
  label: string;
  metric: MetricWithConfidence;
  suffix?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 dark:bg-muted/15">
      <div className="mb-1 flex items-center gap-1">
        <span
          className={cn("size-[5px] shrink-0 rounded-full", CONFIDENCE_DOT[metric.confidence])}
          title={CONFIDENCE_LABEL[metric.confidence]}
        />
        <p className="truncate text-[9px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p className={cn("text-lg font-bold tabular-nums tracking-tight text-foreground", valueClassName)}>
        {metric.value == null ? "—" : `${formatCount(metric.value)}${suffix}`}
      </p>
    </div>
  );
}

function ConfidencePanel({
  displayCreator,
  history,
  loading,
  latestFollowers,
}: {
  displayCreator: UnifiedCreatorResult;
  history: CreatorHistoricalMetrics | null;
  loading: boolean;
  latestFollowers: number | null;
}) {
  return (
    <>
      <DetailSection>
        <SectionTitle icon={<ShieldCheckIcon className="size-3" />}>
          Confidence & authenticity
        </SectionTitle>
        <ConfidenceRows displayCreator={displayCreator} />
      </DetailSection>
      <DetailSection>
        <SectionTitle icon={<TrendingUpIcon className="size-3" />}>Historical metrics</SectionTitle>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-5 text-[12px] text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading historical snapshots…
          </div>
        ) : history && history.followers.length > 0 ? (
          <div className="py-1 text-[12px] text-muted-foreground">
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
          <p className="py-5 text-center text-[12px] text-muted-foreground">
            No historical snapshots yet. Enrichment worker will populate trends.
          </p>
        )}
      </DetailSection>
    </>
  );
}

function ConfidenceRows({ displayCreator }: { displayCreator: UnifiedCreatorResult }) {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-border py-2 text-xs">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Authenticity
        </span>
        <span className="font-semibold text-foreground">
          {displayCreator.authenticity_score != null ? displayCreator.authenticity_score : "—"}
        </span>
      </div>
      <div className="flex items-center justify-between border-b border-border py-2 text-xs">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Source confidence
        </span>
        <span className="font-semibold text-foreground">
          {Math.round(displayCreator.source_confidence)}%
        </span>
      </div>
      <div className="flex items-center justify-between border-b border-border py-2 text-xs">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Verification
        </span>
        <span
          className={cn(
            "font-semibold",
            displayCreator.is_platform_verified
              ? "inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground"
          )}
        >
          {displayCreator.is_platform_verified ? (
            <>
              <BadgeCheckIcon className="size-3.5" />
              Verified
            </>
          ) : (
            "Unverified"
          )}
        </span>
      </div>
      {(() => {
        const storedCategories =
          displayCreator.browse_category_tags &&
          displayCreator.browse_category_tags.length > 0
            ? displayCreator.browse_category_tags
            : creatorStoredCategoriesForDisplay(displayCreator);
        if (storedCategories.length === 0) return null;
        return (
        <div className="flex items-start justify-between gap-4 py-2">
          <span className="pt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Categories
          </span>
          <div className="flex flex-wrap justify-end gap-1">
            {storedCategories.slice(0, 5).map((category) => (
              <span
                key={category}
                className="inline-flex h-5 items-center rounded-full bg-blue-50 px-2 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
              >
                {category}
              </span>
            ))}
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function SimilarCreatorsList({
  similar,
  loading,
  compact = false,
}: {
  similar: Array<UnifiedCreatorResult & { similarity_score: number }>;
  loading: boolean;
  compact?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-[12px] text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Finding similar creators…
      </div>
    );
  }

  if (similar.length === 0) {
    return (
      <p className="py-6 text-center text-[12px] text-muted-foreground">No similar creators found.</p>
    );
  }

  return (
    <div>
      {similar.map((item) => {
        const primaryHandle = item.platforms[0]?.handle?.replace(/^@/, "") ?? item.display_name;
        return (
          <div
            key={item.unified_id}
            className={cn(
              "flex cursor-default items-center gap-2.5 border-b border-border py-2.5 last:border-b-0",
              !compact && "transition-colors hover:-mx-5 hover:bg-muted/40 hover:px-5"
            )}
          >
            <span
              className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white",
                gradientForName(item.display_name)
              )}
            >
              {initialsFromName(item.display_name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{item.display_name}</p>
              <p className="truncate text-[10px] text-muted-foreground">@{primaryHandle}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] text-muted-foreground">Similarity {item.similarity_score}</p>
              <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                Thinkway {Math.round(item.thinkway_score)}
              </p>
            </div>
          </div>
        );
      })}
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
  const [baseCreator, setBaseCreator] = useState<UnifiedCreatorResult | null>(creator);
  const [selectedPlatformAccountId, setSelectedPlatformAccountId] = useState<string | null>(
    creator?.default_metrics_platform_account_id ?? creator?.platforms[0]?.id ?? null
  );
  const [enrichmentStatus, setEnrichmentStatus] = useState<CreatorEnrichmentStatus>("never");
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  useEffect(() => {
    setBaseCreator(creator);
    setSelectedPlatformAccountId(
      creator?.default_metrics_platform_account_id ?? creator?.platforms[0]?.id ?? null
    );
    setEnrichmentStatus(resolveCreatorEnrichmentStatus(creator?.enrichment_status));
  }, [creator]);

  useEffect(() => {
    if (!open) {
      setActiveTab("overview");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !creator) return;
    const unifiedId = creator.unified_id;
    let active = true;
    void Promise.all([
      getUnifiedCreatorDetailAction(unifiedId),
      getSimilarCreatorsAction(unifiedId),
      getCreatorHistoricalMetricsAction(unifiedId),
    ]).then(([fullCreator, sim, hist]) => {
      if (!active) return;
      if (fullCreator) {
        setBaseCreator(fullCreator);
        setSelectedPlatformAccountId((current) => {
          if (current && fullCreator.platforms.some((p) => p.id === current)) return current;
          return (
            fullCreator.default_metrics_platform_account_id ??
            fullCreator.platforms[0]?.id ??
            null
          );
        });
      }
      setDetail({ unifiedId, similar: sim, history: hist });
    });
    return () => {
      active = false;
    };
  }, [open, creator?.unified_id]);

  if (!baseCreator) return null;

  const displayCreator = projectCreatorPlatformView(baseCreator, selectedPlatformAccountId);
  const identityCreator = baseCreator;
  const platforms = sortPlatformsStable(identityCreator.platforms);
  const selectedPlatform =
    platforms.find((p) => p.id === selectedPlatformAccountId) ?? platforms[0] ?? null;

  const matchedDetail = detail?.unifiedId === identityCreator.unified_id ? detail : null;
  const loading = matchedDetail == null;
  const similar = matchedDetail?.similar ?? [];
  const history = matchedDetail?.history ?? null;

  const primary = selectedPlatform;
  const handle = selectedPlatform?.handle ? `@${selectedPlatform.handle.replace(/^@/, "")}` : null;
  const profileUrl = selectedPlatform
    ? resolvePrimaryProfileUrl([selectedPlatform])
    : resolvePrimaryProfileUrl(platforms);
  const platformName = primary ? platformLabel(primary.platform) : null;
  const canAssign = isAssignableCreator(identityCreator) && Boolean(onAssign);
  const latestFollowers = history?.followers.at(-1)?.value ?? null;
  const brandCategory = displayCreator.ai_niche ?? displayCreator.ai_category ?? "No niche tagged";
  const brandFitWidth =
    displayCreator.brand_fit_score != null
      ? `${Math.max(8, Math.round((displayCreator.brand_fit_score / 100) * 32))}px`
      : "32px";

  const dataSource =
    displayCreator.enrichment_source === "apify"
      ? "apify"
      : displayCreator.enrichment_source
        ? "imported"
        : "unavailable";

  function handleCreatorUpdated(next: UnifiedCreatorResult) {
    setBaseCreator(next);
    setEnrichmentStatus(resolveCreatorEnrichmentStatus(next.enrichment_status));
    onCreatorUpdated?.(next);
  }

  const primaryAvatarUrl =
    identityCreator.primaryAvatarUrl ?? identityCreator.profile_image_url;

  const avatarNode = primaryAvatarUrl?.trim() ? (
    <CreatorAvatarImage
      avatarUrl={primaryAvatarUrl}
      size="lg"
      sizeClassName="size-[52px]"
      className="border-2 border-background"
    />
  ) : (
    <span className="inline-flex size-[52px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-400 text-base font-bold text-white">
      {initialsFromName(identityCreator.display_name)}
    </span>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        showOverlay={false}
        style={CREATOR_DETAIL_SHEET_STYLE}
        className={CREATOR_DETAIL_SHEET_CLASS}
      >
        <SheetTitle className="sr-only">{identityCreator.display_name} creator profile</SheetTitle>
        <SheetDescription className="sr-only">
          Creator profile, metrics confidence, and similar creators.
        </SheetDescription>

        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5 dark:bg-muted/20">
          <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
            <PanelLeftIcon className="size-3 shrink-0" aria-hidden />
            <span className="truncate">
              {platformName ?? "Creator"}
              {handle ? (
                <>
                  <span className="text-muted-foreground/70"> · </span>
                  <span className="text-foreground/80">{handle}</span>
                </>
              ) : null}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {identityCreator.influencer_id ? (
              <RefreshCreatorMenu
                influencerId={identityCreator.influencer_id}
                unifiedId={identityCreator.unified_id}
                enrichmentStatus={enrichmentStatus}
                size="sm"
                variant="outline"
                className="[&_button]:h-7 [&_button]:rounded-md [&_button]:border-border [&_button]:bg-background [&_button]:px-2.5 [&_button]:text-[11px] [&_button]:font-medium [&_button]:text-muted-foreground [&_button]:shadow-none [&_button]:hover:bg-muted/60"
                onStatusChange={setEnrichmentStatus}
                onCreatorUpdated={handleCreatorUpdated}
              />
            ) : (
              <Button type="button" variant="outline" className={ACTION_BTN_CLASS} disabled>
                <RefreshCwIcon className="size-3" aria-hidden />
                Refresh Metrics
              </Button>
            )}
            {profileUrl ? (
              <Button asChild variant="outline" className={ACTION_BTN_CLASS}>
                <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon className="size-3" aria-hidden />
                  {platformName ? `View on ${platformName}` : "View profile"}
                </a>
              </Button>
            ) : null}
            <SheetClose asChild>
              <button type="button" className={cn(ACTION_BTN_CLASS, "size-7 px-0")} aria-label="Close">
                <XIcon className="size-3.5" aria-hidden />
              </button>
            </SheetClose>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as DetailTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="shrink-0 border-b border-border">
            <div className="px-5 pt-[18px]">
              <div className="mb-3.5 flex items-start gap-3.5">
            {profileUrl ? (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={profileLinkTooltip(identityCreator.display_name, selectedPlatform?.platform)}
                title={profileLinkTooltip(identityCreator.display_name, selectedPlatform?.platform)}
                className="relative shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                {avatarNode}
                {primary ? (
                  <span className="absolute right-0 bottom-0 flex size-[18px] items-center justify-center rounded-[5px] border-2 border-background bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]">
                    <PlatformIcon platform={primary.platform} size="xs" className="size-[18px] rounded-[5px] border-0" />
                  </span>
                ) : null}
              </a>
            ) : (
              <div className="relative shrink-0">
                {avatarNode}
                {primary ? (
                  <span className="absolute right-0 bottom-0 flex size-[18px] items-center justify-center rounded-[5px] border-2 border-background bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]">
                    <PlatformIcon platform={primary.platform} size="xs" className="size-[18px] rounded-[5px] border-0" />
                  </span>
                ) : null}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <CreatorProfileLink
                source={{
                  displayName: identityCreator.display_name,
                  avatarUrl: primaryAvatarUrl,
                  isVerified: identityCreator.is_platform_verified,
                }}
                size="md"
                showAvatar={false}
                showHandle={false}
                showPlatformBadge={false}
                linkName={false}
                nameClassName="text-lg font-bold tracking-tight text-foreground"
                stopPropagation
              />

              {platforms.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {platforms.map((platform) => {
                    const active = platform.id === selectedPlatformAccountId;
                    return (
                      <button
                        key={platform.id}
                        type="button"
                        onClick={() => setSelectedPlatformAccountId(platform.id)}
                        className={cn(
                          "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <PlatformIcon platform={platform.platform} size="xs" className="size-3 rounded-full border-0" />
                        {platformLabel(platform.platform)}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {primary ? (
                  <PlatformChip className="bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300">
                    <PlatformIcon platform={primary.platform} size="xs" className="size-3.5 rounded-full border-0" />
                    {platformName}
                  </PlatformChip>
                ) : null}
                {displayCreator.source_type === "imported" ? (
                  <PlatformChip className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Imported
                  </PlatformChip>
                ) : (
                  <CreatorSourceBadge
                    source={displayCreator.source_type}
                    className="h-5 rounded-full border-0 px-2 py-0 text-[10px] font-semibold"
                  />
                )}
                {displayCreator.estimated_country || displayCreator.country_code ? (
                  <span className="text-[11px] text-muted-foreground">
                    {displayCreator.estimated_country ?? displayCreator.country_code}
                  </span>
                ) : null}
                {displayCreator.is_platform_verified ? (
                  <BadgeCheckIcon className="size-4 shrink-0 text-primary" aria-label="Platform verified" />
                ) : null}
              </div>

              {displayCreator.bio && selectedPlatform ? (
                <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                  {displayCreator.bio}
                </p>
              ) : identityCreator.bio ? (
                <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                  {identityCreator.bio}
                </p>
              ) : null}

              {displayCreator.role ? (
                <p className="mt-1 text-[11px] text-muted-foreground">{displayCreator.role}</p>
              ) : null}

              {identityCreator.influencer_id ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pb-3 text-[10px] text-muted-foreground">
                  <span className="size-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                  {enrichmentStatus === "enriched" || enrichmentStatus === "skipped" ? (
                    <PlatformChip className="h-[18px] bg-emerald-50 px-1.5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Updated
                    </PlatformChip>
                  ) : null}
                  <span>Last synced {formatLastUpdated(identityCreator.last_enriched_at)}</span>
                  {dataSource === "apify" ? (
                    <PlatformChip className="h-[18px] bg-blue-50 px-1.5 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      ⚡ Apify
                    </PlatformChip>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
            </div>
            <div className="px-5">
              <TabsList
                variant="line"
                className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0"
              >
                <TabsTrigger value="overview" className={DETAIL_TAB_TRIGGER_CLASS}>
                  Overview
                </TabsTrigger>
                <TabsTrigger value="publications" className={DETAIL_TAB_TRIGGER_CLASS}>
                  Publications
                </TabsTrigger>
                <TabsTrigger value="confidence" className={DETAIL_TAB_TRIGGER_CLASS}>
                  Confidence
                </TabsTrigger>
                <TabsTrigger value="similar" className={DETAIL_TAB_TRIGGER_CLASS}>
                  Similar creators
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <TabsContent value="overview" className="mt-0 outline-none">
              <div className="grid min-h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 border-border lg:border-r">
                  <DetailSection>
                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      <div className="rounded-[10px] border border-blue-200 bg-blue-50 px-3.5 py-3.5 dark:border-blue-900/60 dark:bg-blue-950/30">
                        <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-blue-700 dark:text-blue-300">
                          Thinkway score
                        </p>
                        <p className="mt-1.5 text-[32px] leading-none font-extrabold tracking-tighter text-blue-600 dark:text-blue-400">
                          {Math.round(displayCreator.thinkway_score)}
                        </p>
                        <p className="mt-1 text-[11px] text-blue-600/90 dark:text-blue-400/90">
                          Source confidence {Math.round(displayCreator.source_confidence)}%
                        </p>
                      </div>
                      <div className="rounded-[10px] border border-border bg-muted/30 px-3.5 py-3.5 dark:bg-muted/15">
                        <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                          Brand fit
                        </p>
                        <div
                          className="mt-2 h-[3px] rounded-sm bg-foreground"
                          style={{ width: brandFitWidth }}
                        />
                        <p className="mt-2 text-[13px] font-medium text-foreground">{brandCategory}</p>
                        {displayCreator.brand_fit_score != null ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Score {Math.round(displayCreator.brand_fit_score)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </DetailSection>

                  <DetailSection>
                    <SectionTitle icon={<UsersIcon className="size-3" />}>
                      Audience & engagement
                    </SectionTitle>
                    <div className="mb-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <KpiCard
                        label="Followers"
                        metric={displayCreator.metrics.followers}
                        valueClassName="text-[22px]"
                      />
                      <KpiCard
                        label="Engagement"
                        metric={displayCreator.metrics.engagement_rate}
                        suffix="%"
                        valueClassName="text-[22px]"
                      />
                      <KpiCard label="Avg likes" metric={displayCreator.metrics.avg_likes} valueClassName="text-[22px]" />
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <KpiCard
                        label="Avg comments"
                        metric={displayCreator.metrics.avg_comments}
                        valueClassName="text-[22px]"
                      />
                      <KpiCard label="Avg views" metric={displayCreator.metrics.avg_views} valueClassName="text-[22px]" />
                      <KpiCard
                        label="Posts / week"
                        metric={displayCreator.metrics.posting_frequency_per_week}
                        valueClassName="text-[22px]"
                      />
                    </div>
                  </DetailSection>

                  <DetailSection>
                    <SectionTitle
                      icon={<ImageIcon className="size-3" />}
                      action={
                        (displayCreator.recent_publications?.length ?? 0) > 0 ? (
                          <button
                            type="button"
                            onClick={() => setActiveTab("publications")}
                            className="ml-auto text-[10px] font-semibold normal-case tracking-normal text-blue-600 hover:underline dark:text-blue-400"
                          >
                            View all →
                          </button>
                        ) : null
                      }
                    >
                      Recent publications
                    </SectionTitle>
                    <RecentPublicationsGallery
                      publications={displayCreator.recent_publications ?? []}
                      variant="drawer"
                      columns={3}
                      imageHeightClass="h-[100px]"
                      limit={3}
                    />
                  </DetailSection>

                  <DetailSection className="lg:hidden">
                    <SectionTitle icon={<UsersIcon className="size-3" />}>Similar creators</SectionTitle>
                    <SimilarCreatorsList similar={similar} loading={loading} />
                  </DetailSection>

                  <DetailSection>
                    <SectionTitle icon={<ShieldCheckIcon className="size-3" />}>
                      Confidence & authenticity
                    </SectionTitle>
                    <ConfidenceRows displayCreator={displayCreator} />
                  </DetailSection>
                </div>

                <div className="hidden min-w-0 lg:block">
                  <DetailSection className="border-b-0">
                    <SectionTitle icon={<UsersIcon className="size-3" />}>Similar creators</SectionTitle>
                    <SimilarCreatorsList similar={similar} loading={loading} compact />
                  </DetailSection>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="publications" className="mt-0 outline-none">
              <DetailSection className="border-b-0">
                <SectionTitle icon={<ImageIcon className="size-3" />}>All publications</SectionTitle>
                <RecentPublicationsGallery
                  publications={displayCreator.recent_publications ?? []}
                  variant="drawer"
                  columns={3}
                  imageHeightClass="h-[140px]"
                />
              </DetailSection>
            </TabsContent>

            <TabsContent value="confidence" className="mt-0 outline-none">
              <ConfidencePanel
                displayCreator={displayCreator}
                history={history}
                loading={loading}
                latestFollowers={latestFollowers}
              />
            </TabsContent>

            <TabsContent value="similar" className="mt-0 outline-none">
              <DetailSection className="border-b-0">
                <SectionTitle icon={<UsersIcon className="size-3" />}>Similar creators</SectionTitle>
                <SimilarCreatorsList similar={similar} loading={loading} />
              </DetailSection>
            </TabsContent>
          </div>
        </Tabs>

        {canAssign || campaignHeaderId ? (
          <div className="shrink-0 border-t border-border px-5 py-4">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {campaignHeaderId ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-md text-[11px]"
                  onClick={() =>
                    void addCreatorToCampaignShortlistAction(campaignHeaderId, identityCreator)
                  }
                >
                  Save to shortlist
                </Button>
              ) : null}
              {canAssign ? (
                <Button size="sm" className="h-7 rounded-md text-[11px]" onClick={() => onAssign?.(identityCreator)}>
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
