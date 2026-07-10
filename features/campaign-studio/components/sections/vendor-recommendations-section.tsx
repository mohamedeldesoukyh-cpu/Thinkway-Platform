"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  CheckIcon,
  GlobeIcon,
  LanguagesIcon,
  PlusIcon,
  Trash2Icon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { CreatorTierBadge } from "@/components/creator/creator-tier-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  CreatorsSectionData,
  StudioDraftState,
} from "@/features/campaign-intelligence/types/section-schemas";

import {
  decideVendorRecommendationAction,
  shortlistVendorRecommendationAction,
} from "../../actions/vendor-recommendation-actions";
import {
  stageStudioDraftChangeAction,
  unstageStudioDraftChangeAction,
} from "../../actions/studio-draft-actions";
import {
  draftChangeForCreator,
  getStudioDraft,
  normalizeCreatorId,
} from "../../services/studio-draft";
import { formatEngagement, formatFollowers } from "./shared/format-utils";
import { SectionSkeleton } from "./shared/section-skeleton";
import { GroundingBadge } from "./shared/grounding-badge";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import {
  resolveCreatorIds,
  resolveCreatorCounts,
  resolveVendorGrounding,
  resolveVendorRecommendations,
} from "../../services/section-data-resolver";
import { dedupeByCreatorId } from "@/lib/creators/dedupe-creators";
import {
  resolveCreatorTierLabel,
  type CreatorTierLabel,
} from "@/lib/creators/creator-tier";
import { useCreatorHydration } from "../../hooks/use-creator-hydration";
import { buildCreatorContentIdea } from "../../services/creator-slate";
import {
  getCampaignFacts,
  resolveInfluencerEstimateCurrency,
} from "@/features/campaign-director/facts/facts-display-bridge";
import type { CreatorDrawerSelection } from "@/features/campaign-decision-workspace/components/creator-drawer";
import { CreatorDrawer } from "@/features/campaign-decision-workspace/components/creator-drawer";
import { STUDIO_VENDOR_INITIAL_VISIBLE } from "../../constants/hydration-limits";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type VendorRecommendationsSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
  onCreatorClick?: (creator: CreatorDrawerSelection) => void;
  conversationId?: string;
  messageId?: string;
  onVendorDecisionsUpdated?: (
    decisions: Record<string, "approved" | "rejected" | "shortlisted">
  ) => void;
  studioDraft?: StudioDraftState;
  onStudioDraftUpdated?: (draft: StudioDraftState) => void;
  /** Removals already applied this session — filters cards without a reload. */
  appliedRemovedCreatorIds?: string[];
};

type DisplayVendor = {
  id?: string;
  rank?: number;
  displayName: string;
  handle: string;
  platform: string;
  followers?: number;
  engagementRate?: number;
  fitScore?: number;
  reason?: string;
  avatarUrl?: string;
  profileUrl?: string;
  country?: string;
  language?: string;
  audienceSummary?: string;
  priceEstimate?: string;
  thinkwayScore?: number;
  matchPercent?: number;
  tier?: CreatorTierLabel;
  contentIdea?: string;
};

function PlatformBadge({ platform }: { platform: string }) {
  const normalized = platform.toLowerCase();
  const label =
    normalized.includes("instagram")
      ? "IG"
      : normalized.includes("youtube")
        ? "YT"
        : normalized.includes("tiktok")
          ? "TT"
          : platform.slice(0, 2).toUpperCase();

  return (
    <span className="flex size-5 items-center justify-center rounded-md bg-muted/60 text-[9px] font-bold">
      {label}
    </span>
  );
}

function toDrawerSelection(vendor: DisplayVendor): CreatorDrawerSelection {
  return {
    id: vendor.id,
    displayName: vendor.displayName,
    handle: vendor.handle,
    platform: vendor.platform,
    avatarUrl: vendor.avatarUrl,
    profileUrl: vendor.profileUrl,
    followers: vendor.followers,
    engagementRate: vendor.engagementRate,
    country: vendor.country,
    language: vendor.language,
    audienceSummary: vendor.audienceSummary,
    priceEstimate: vendor.priceEstimate,
    tier: vendor.tier,
    reason: vendor.reason,
    matchPercent: vendor.matchPercent,
  };
}

function VendorAvatar({
  vendor,
  onOpenDetails,
}: {
  vendor: DisplayVendor;
  onOpenDetails: () => void;
}) {
  const avatar = (
    <CreatorAvatarImage
      avatarUrl={vendor.avatarUrl}
      profileUrl={vendor.profileUrl}
      size="sm"
      alt={vendor.displayName}
    />
  );

  if (vendor.profileUrl) {
    return (
      <a
        href={vendor.profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Open social profile"
        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D9E75]"
        onClick={(e) => e.stopPropagation()}
      >
        {avatar}
      </a>
    );
  }

  return (
    <button
      type="button"
      className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D9E75]"
      onClick={onOpenDetails}
      aria-label={`View ${vendor.displayName}`}
    >
      {avatar}
    </button>
  );
}

function isEmptyGlobalRationale(text: string | undefined): boolean {
  if (!text?.trim()) return true;
  return /no creators available/i.test(text);
}

export function VendorRecommendationsSection({
  campaignObject,
  fallbackText,
  status,
  onCreatorClick,
  conversationId,
  messageId,
  onVendorDecisionsUpdated,
  studioDraft,
  onStudioDraftUpdated,
  appliedRemovedCreatorIds,
}: VendorRecommendationsSectionProps) {
  const isRunning = status === "running";
  const creatorsData = (campaignObject?.sections.creators.data ?? {}) as CreatorsSectionData;
  // Draft state is owned by the Studio shell when provided; standalone renders fall back to the object.
  const [localDraft, setLocalDraft] = useState<StudioDraftState | null>(null);
  const draft = studioDraft ?? localDraft ?? getStudioDraft(campaignObject);
  const publishDraft = useCallback(
    (next: StudioDraftState) => {
      setLocalDraft(next);
      onStudioDraftUpdated?.(next);
    },
    [onStudioDraftUpdated]
  );
  const [vendorDecisions, setVendorDecisions] = useState<
    Record<string, "approved" | "rejected" | "shortlisted">
  >(creatorsData.vendorDecisions ?? {});
  const [pendingCreatorId, setPendingCreatorId] = useState<string | null>(null);
  const [linkedShortlistId, setLinkedShortlistId] = useState<string | undefined>(
    creatorsData.linkedShortlistId
  );
  const [showAllVendors, setShowAllVendors] = useState(false);
  const [drawerCreator, setDrawerCreator] = useState<CreatorDrawerSelection | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openCreatorDetails = useCallback(
    (vendor: DisplayVendor) => {
      const selection = toDrawerSelection(vendor);
      if (onCreatorClick) {
        onCreatorClick(selection);
        return;
      }
      setDrawerCreator(selection);
      setDrawerOpen(true);
    },
    [onCreatorClick]
  );

  const canAct = Boolean(conversationId && messageId);

  const applyDecision = useCallback(
    async (
      creatorId: string,
      action: "approve" | "reject" | "shortlist",
      unifiedId?: string
    ) => {
      if (!conversationId || !messageId || !creatorId) return;
      setPendingCreatorId(creatorId);
      try {
        if (action === "shortlist") {
          if (!unifiedId) {
            toast.error("Creator ID missing — re-run discovery.");
            return;
          }
          const presentation = campaignObject?.sections.presentation.data as
            | { campaignName?: string }
            | undefined;
          const result = await shortlistVendorRecommendationAction({
            conversationId,
            messageId,
            creatorId,
            creatorUnifiedId: unifiedId,
            campaignName: presentation?.campaignName,
          });
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          if (result.vendorDecisions) {
            setVendorDecisions(result.vendorDecisions);
            onVendorDecisionsUpdated?.(result.vendorDecisions);
          }
          if (result.linkedShortlistId) setLinkedShortlistId(result.linkedShortlistId);
          toast.success(result.message, {
            action: result.shortlistUrl
              ? { label: "Open shortlist", onClick: () => window.open(result.shortlistUrl, "_blank") }
              : undefined,
          });
          return;
        }

        const result = await decideVendorRecommendationAction({
          conversationId,
          messageId,
          creatorId,
          decision: action === "approve" ? "approved" : "rejected",
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        if (result.vendorDecisions) {
          setVendorDecisions(result.vendorDecisions);
          onVendorDecisionsUpdated?.(result.vendorDecisions);
        }
        toast.success(result.message);
      } finally {
        setPendingCreatorId(null);
      }
    },
    [campaignObject, conversationId, messageId, onVendorDecisionsUpdated]
  );

  const stageRemoval = useCallback(
    async (vendor: DisplayVendor) => {
      if (!conversationId || !messageId || !vendor.id) return;
      setPendingCreatorId(vendor.id);
      try {
        const result = await stageStudioDraftChangeAction({
          conversationId,
          messageId,
          change: {
            kind: "remove_creator",
            creatorId: vendor.id,
            displayName: vendor.displayName,
          },
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        if (result.draft) publishDraft(result.draft);
        toast.success(result.message);
      } finally {
        setPendingCreatorId(null);
      }
    },
    [conversationId, messageId, publishDraft]
  );

  const undoDraftChange = useCallback(
    async (creatorId: string) => {
      if (!conversationId || !messageId) return;
      setPendingCreatorId(creatorId);
      try {
        const result = await unstageStudioDraftChangeAction({
          conversationId,
          messageId,
          creatorId,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        if (result.draft) publishDraft(result.draft);
        toast.success(result.message);
      } finally {
        setPendingCreatorId(null);
      }
    },
    [conversationId, messageId, publishDraft]
  );

  const parsedVendors = resolveVendorRecommendations(campaignObject);
  const { ids, rationale, avgFitScore, creatorFitScores } = resolveCreatorIds(campaignObject);
  const safeRationale = isEmptyGlobalRationale(rationale) ? undefined : rationale;
  const { recommendationIds, discoveryIds } = resolveCreatorCounts(campaignObject);
  const hasCreatorIds = recommendationIds.length > 0 || discoveryIds.length > 0;

  const mapperOptions = useMemo(() => {
    const facts = getCampaignFacts(campaignObject);
    return {
      preferredPlatforms: facts?.platforms,
      currency: resolveInfluencerEstimateCurrency(facts),
      campaignFitScoresByCreatorId: creatorFitScores,
    };
  }, [campaignObject, creatorFitScores]);

  const { vendors: hydrated, loading } = useCreatorHydration(
    ids,
    safeRationale,
    avgFitScore,
    mapperOptions
  );

  const campaignFacts = getCampaignFacts(campaignObject);

  const removedIdSet = useMemo(
    () => new Set((appliedRemovedCreatorIds ?? []).map(normalizeCreatorId)),
    [appliedRemovedCreatorIds]
  );

  const vendors: DisplayVendor[] = useMemo(
    () =>
      hydrated.length > 0
        ? dedupeByCreatorId(
            hydrated
              .filter(
                (v) =>
                  !v.id ||
                  (vendorDecisions[v.id] !== "rejected" &&
                    !removedIdSet.has(normalizeCreatorId(v.id)))
              )
              .map((v, i) => ({
                id: v.id,
                rank: i + 1,
                displayName: v.displayName,
                handle: v.handle,
                platform: v.platform,
                followers: v.followers,
                engagementRate: v.engagementRate,
                fitScore: v.brandFit,
                reason: v.reason,
                avatarUrl: v.avatarUrl,
                profileUrl: v.profileUrl,
                country: v.country,
                language: v.language,
                audienceSummary: v.audienceSummary,
                priceEstimate: v.priceEstimate,
                thinkwayScore: v.thinkwayScore,
                matchPercent: v.matchPercent,
                tier: v.tier,
                contentIdea: buildCreatorContentIdea(
                  { categories: [v.audienceSummary ?? ""] },
                  campaignFacts,
                  i
                ),
              })),
            (v) => v.id ?? `${v.handle}:${v.displayName}`
          ).items
        : dedupeByCreatorId(
            parsedVendors
              .filter(
                (v) =>
                  !v.id ||
                  (vendorDecisions[v.id] !== "rejected" &&
                    !removedIdSet.has(normalizeCreatorId(v.id)))
              )
              .map((v, i) => ({
                ...v,
                tier: resolveCreatorTierLabel({ followers: v.followers }),
                contentIdea: buildCreatorContentIdea(
                  { categories: [v.reason ?? ""] },
                  campaignFacts,
                  i
                ),
              })),
            (v) => v.id ?? `${v.handle}:${v.displayName}`
          ).items,
    [hydrated, parsedVendors, vendorDecisions, campaignFacts, removedIdSet]
  );

  const visibleVendors = showAllVendors
    ? vendors
    : vendors.slice(0, STUDIO_VENDOR_INITIAL_VISIBLE);
  const hiddenCount = Math.max(0, vendors.length - STUDIO_VENDOR_INITIAL_VISIBLE);
  const preferredPlatformLabel = mapperOptions.preferredPlatforms?.[0];
  const discoveryEngine = creatorsData.discoveryEngine;
  const fitScoreCount =
    creatorsData.fitScoreCount ??
    (creatorFitScores ? Object.keys(creatorFitScores).length : 0);

  if ((isRunning || loading) && vendors.length === 0 && hasCreatorIds) {
    return <SectionSkeleton variant="vendors" />;
  }

  if (vendors.length === 0) {
    if (shouldShowPendingPlaceholder(status, hasCreatorIds)) {
      if (hasCreatorIds) {
        return <SectionSkeleton variant="vendors" />;
      }
      return (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-center">
          <p className="text-sm text-muted-foreground">Run discovery to generate recommendations</p>
        </div>
      );
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className="min-w-0 space-y-2">
      {discoveryEngine ? (
        <p className="rounded-md border border-[#1D9E75]/30 bg-[#1D9E75]/5 px-2.5 py-1.5 text-[10px] text-muted-foreground">
          Discovery:{" "}
          <span className="font-semibold text-[#1D9E75]">
            {discoveryEngine === "cip" ? "Campaign Intelligence (CIP)" : "Keyword search"}
          </span>
          {fitScoreCount > 0 ? (
            <span>
              {" "}
              · {fitScoreCount} campaign fit score{fitScoreCount === 1 ? "" : "s"} persisted
            </span>
          ) : (
            <span> · fit scores pending — wait for shortlist step</span>
          )}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <p className="text-[11px] text-muted-foreground">
          {vendors.length} recommended creator{vendors.length === 1 ? "" : "s"}
          {preferredPlatformLabel ? (
            <span className="text-foreground/80">
              {" "}
              · Brief platform: {preferredPlatformLabel}
            </span>
          ) : null}
        </p>
        {recommendationIds.length > 0 ? (
          <p className="text-[10px] text-muted-foreground">
            Ranked from {recommendationIds.length} search matches
          </p>
        ) : null}
      </div>
      {linkedShortlistId ? (
        <p className="text-[11px] text-muted-foreground">
          Shortlist:{" "}
          <Link
            href={`/discovery/shortlists/${linkedShortlistId}`}
            className="font-medium text-[#1D9E75] hover:underline"
          >
            View in Discovery
          </Link>
        </p>
      ) : null}
      {visibleVendors.map((vendor, index) => {
        const decision = vendor.id ? vendorDecisions[vendor.id] : undefined;
        const isPending = pendingCreatorId === vendor.id;
        const draftChange = draftChangeForCreator(draft, vendor.id);
        const pendingRemoval = draftChange?.kind === "remove_creator";
        const grounding = resolveVendorGrounding(
          {
            displayName: vendor.displayName,
            handle: vendor.handle,
            platform: vendor.platform,
            followers: vendor.followers,
            engagementRate: vendor.engagementRate,
            country: vendor.country,
            audienceSummary: vendor.audienceSummary,
            priceEstimate: vendor.priceEstimate,
            brandFit: vendor.fitScore,
            campaignRelevanceScore: vendor.fitScore,
            rationale:
              vendor.reason && !isEmptyGlobalRationale(vendor.reason)
                ? vendor.reason
                : undefined,
          },
          campaignObject,
          index
        );

        return (
          <div
            key={vendor.id ?? `${vendor.handle}-${index}`}
            className={
              pendingRemoval
                ? "min-w-0 rounded-xl border border-amber-300 bg-amber-50/50 p-3 opacity-75 transition-all duration-300 dark:border-amber-800 dark:bg-amber-950/20"
                : "min-w-0 rounded-xl border border-border/70 bg-background/80 p-3 transition-all duration-300 hover:border-violet-300/50 hover:shadow-sm"
            }
          >
            <div className="flex items-start gap-3">
              <VendorAvatar
                vendor={vendor}
                onOpenDetails={() => openCreatorDetails(vendor)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {vendor.rank != null ? (
                    <span className="text-[10px] font-bold text-violet-600">#{vendor.rank}</span>
                  ) : null}
                  <button
                    type="button"
                    className="min-w-0 break-words text-left text-sm font-semibold hover:text-[#1D9E75]"
                    onClick={() => openCreatorDetails(vendor)}
                  >
                    {vendor.displayName}
                  </button>
                  <span className="break-all text-xs text-muted-foreground">{vendor.handle}</span>
                  <div className="flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5">
                    <PlatformBadge platform={vendor.platform} />
                    <span className="text-[10px] capitalize">{vendor.platform}</span>
                  </div>
                  {vendor.tier ? <CreatorTierBadge tier={vendor.tier} /> : null}
                  {pendingRemoval ? (
                    <Badge className="h-auto bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                      Pending removal
                    </Badge>
                  ) : null}
                  {vendor.fitScore != null ? (
                    <Badge
                      variant="secondary"
                      className="h-auto px-1.5 py-0.5 text-[9px] font-semibold text-[#1D9E75]"
                    >
                      Campaign fit {Math.round(vendor.fitScore)}/100
                    </Badge>
                  ) : null}
                  <GroundingBadge
                    source={grounding.grounding.source}
                    confidence={grounding.grounding.confidence}
                  />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  <span>{formatFollowers(vendor.followers)} followers</span>
                  <span>{formatEngagement(vendor.engagementRate)} ER</span>
                  {vendor.priceEstimate ? (
                    <span className="font-medium text-[#1D9E75]">{vendor.priceEstimate}</span>
                  ) : null}
                  {vendor.country ? (
                    <span className="flex items-center gap-0.5">
                      <GlobeIcon className="size-3" />
                      {vendor.country}
                    </span>
                  ) : null}
                  {vendor.language ? (
                    <span className="flex items-center gap-0.5">
                      <LanguagesIcon className="size-3" />
                      {vendor.language}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 break-words text-[11px] font-medium text-foreground">
                  Why: {grounding.whySelected}
                </p>
                {vendor.contentIdea ? (
                  <p className="mt-1 break-words text-[11px] text-violet-700 dark:text-violet-300">
                    Content concept: {vendor.contentIdea}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {grounding.factors.slice(0, 5).map((f) => (
                    <Badge
                      key={f.factor}
                      variant="outline"
                      title={f.reason}
                      className="h-auto whitespace-normal px-1.5 py-0.5 text-[9px] leading-snug"
                    >
                      {f.factor} {f.score}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="h-7 px-2.5 text-muted-foreground"
                onClick={() => openCreatorDetails(vendor)}
              >
                View details
              </Button>
              {pendingRemoval ? (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={!canAct || isPending}
                  className="h-7 border-amber-300 px-2.5 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300"
                  onClick={() => vendor.id && void undoDraftChange(vendor.id)}
                >
                  <Undo2Icon className="size-3" />
                  Undo removal
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    size="xs"
                    disabled={!canAct || isPending || decision === "approved"}
                    className="h-7 bg-[#1D9E75] px-2.5 hover:bg-[#178f69] disabled:opacity-50"
                    onClick={() => vendor.id && void applyDecision(vendor.id, "approve")}
                  >
                    <CheckIcon className="size-3" />
                    {decision === "approved" ? "Approved" : "Approve"}
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    disabled={!canAct || isPending}
                    className="h-7 px-2.5"
                    onClick={() => vendor.id && void applyDecision(vendor.id, "reject")}
                  >
                    <XIcon className="size-3" />
                    Reject
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    disabled={!canAct || isPending || decision === "shortlisted"}
                    className="h-7 px-2.5"
                    onClick={() =>
                      vendor.id &&
                      void applyDecision(vendor.id, "shortlist", vendor.id)
                    }
                  >
                    <PlusIcon className="size-3" />
                    {decision === "shortlisted" ? "Shortlisted" : "Shortlist"}
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={!canAct || isPending}
                    className="h-7 px-2.5 text-muted-foreground hover:text-destructive"
                    onClick={() => void stageRemoval(vendor)}
                    title="Stage removal — recalculated on Apply All Updates"
                  >
                    <Trash2Icon className="size-3" />
                    Remove
                  </Button>
                </>
              )}
            </div>
            {!canAct ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Save this studio message to enable creator actions.
              </p>
            ) : null}
          </div>
        );
      })}
      {hiddenCount > 0 && !showAllVendors ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowAllVendors(true)}
        >
          Show all {vendors.length} creators ({hiddenCount} more)
        </Button>
      ) : null}
      {!onCreatorClick ? (
        <CreatorDrawer creator={drawerCreator} open={drawerOpen} onOpenChange={setDrawerOpen} />
      ) : null}
    </div>
  );
}
