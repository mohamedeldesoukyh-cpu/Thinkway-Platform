"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  CheckIcon,
  Columns2Icon,
  GitMergeIcon,
  ListRestartIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useConfirmDelete } from "@/components/shared/confirm-action-provider";
import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { cn } from "@/lib/utils";
import type {
  CreatorsSectionData,
  SlateCreatorRecommendation,
  StudioDraftState,
} from "@/features/campaign-intelligence/types/section-schemas";

import {
  decideVendorRecommendationAction,
  shortlistVendorRecommendationAction,
  stageVendorRoleAction,
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
import { previewCreatorsSectionFromDraft } from "../../services/studio-draft-preview";
import {
  creatorGroupingKey,
  creatorIdsToHydrate,
  splitRecommendedCreatorIds,
} from "../../services/studio-creator-slate-split";
import type { StudioCreatorReplacementTarget } from "../../services/studio-creator-replacement";
import { CampaignAnalysisPanel } from "./campaign-analysis-panel";
import { AddCreatorPanel } from "./add-creator-panel";
import { formatEngagement, formatFollowers } from "./shared/format-utils";
import { SectionSkeleton } from "./shared/section-skeleton";
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
import { useViewportCreatorIds } from "../../hooks/use-viewport-creator-ids";
import { buildCreatorContentIdea } from "../../services/creator-slate";
import {
  getCampaignFacts,
  resolveInfluencerEstimateCurrency,
} from "@/features/campaign-director/facts/facts-display-bridge";
import { vendorMatchesCampaignMarket } from "../../services/studio-market-creators";
import {
  selectStudioRecommendedVendors,
} from "../../services/studio-recommended-vendors";
import {
  CANDIDATE_INELIGIBILITY_LABEL,
  classifyReplacementCandidates,
  summarizeCandidates,
  type CandidateIneligibility,
  type StudioCreatorGroup,
  type StudioCreatorGroupKind,
} from "../../services/studio-replacement-candidates";
import {
  sortByStudioRequirements,
  studioCreatorRankingScore,
  studioCreatorRequirementScore,
  studioRequirementBadgeLabel,
  vendorFitsStudioBriefMix,
  type StudioRequirementScore,
} from "../../services/studio-creator-requirements";
import type { CreatorDrawerSelection } from "@/features/campaign-decision-workspace/components/creator-drawer";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { STUDIO_REF_CLASSES } from "../../constants/campaign-studio-ref-tokens";
import { useStudioRefMode } from "../../hooks/use-studio-ref-mode";
import { ShowMoreButton } from "./shared/studio-ui-primitives";
import { STUDIO_VENDOR_INITIAL_VISIBLE } from "../../constants/hydration-limits";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";
import type { StudioEciPlanningSignal } from "../../services/eci/project-studio-eci-signal";
import { ShortlistSlatePickerDialog } from "./shortlist-slate-picker-dialog";
import { StudioCreatorCompareDialog } from "./studio-creator-compare-dialog";
import { StudioCreatorDetailHost } from "./studio-creator-detail-host";
import { StudioPlanningIntelligenceStrip } from "./shared/studio-planning-intelligence-strip";
import { deriveEnterprisePlanningNarrative } from "../../services/planning-narrative";
import { deriveCreatorQuantityRecommendation } from "../../services/creator-quantity";
import { studioCampaignBrowseFilters } from "../../services/studio-discovery-browse-filters";
import {
  resolveStudioCreatorListState,
  studioCreatorListIsLoading,
} from "../../services/studio-creator-list-state";
import type { CampaignCreatorStatus } from "../../services/creator-decision-status";
import {
  campaignRequirementChecks,
  resolveCampaignCreatorDecision,
  type CampaignCreatorDecision,
} from "../../services/studio-campaign-creator-decision";
import { clientSafeLine } from "../../services/studio-creator-client-decision";
import { resolveCreatorTierMix } from "../../services/creator-quantity";
import { withSlatePositions } from "../../services/creator-slate-integrity";
import {
  orderReplacementCandidatesByRole,
  replacementCandidateIsEligible,
  replacementShortageNote,
} from "../../services/studio-replacement-eligibility";
import { partitionStudioCreatorGroups } from "../../services/studio-creator-groups";
import { resolveStudioCreatorShortfall } from "../../services/studio-creator-shortfall";

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
  onSlateUpdated?: (campaignObject: Record<string, unknown>) => void;
};

type DisplayVendor = {
  id?: string;
  rank?: number;
  /**
   * Set only on a replacement candidate that the campaign's own gates would
   * reject. The card states it; the creator is never dropped from the list.
   */
  candidateIneligibility?: CandidateIneligibility;
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
  countryCode?: string | null;
  language?: string;
  audienceSummary?: string;
  categories?: string[];
  priceEstimate?: string;
  thinkwayScore?: number;
  matchPercent?: number;
  tier?: CreatorTierLabel;
  contentIdea?: string;
  slateRole?: "main" | "maybe";
  slateReason?: string;
  slateReasonCode?: SlateCreatorRecommendation["reasonCode"];
  suggestedTimelineSlot?: string;
  wave?: number;
  priority?: SlateCreatorRecommendation["priority"];
  serviceType?: string;
  contentPillar?: string;
  expectedRole?: string;
  confidence?: number;
  eciRecommendation?: string;
  eciConfidencePercent?: number | null;
  planningSignal?: StudioEciPlanningSignal;
};

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
    reason: vendor.planningSignal
      ? vendor.planningSignal.why
      : vendor.reason,
    matchPercent: vendor.matchPercent,
  };
}

function vendorInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function VendorAvatar({
  vendor,
  onOpenDetails,
  refMode = false,
}: {
  vendor: DisplayVendor;
  onOpenDetails: () => void;
  refMode?: boolean;
}) {
  const avatarInner = vendor.avatarUrl ? (
    <CreatorAvatarImage
      avatarUrl={vendor.avatarUrl}
      profileUrl={vendor.profileUrl}
      size="sm"
      alt={vendor.displayName}
      className="size-full"
    />
  ) : (
    vendorInitials(vendor.displayName)
  );

  const avatar = refMode ? (
    <div className={STUDIO_REF_CLASSES.vendorAv}>{avatarInner}</div>
  ) : (
    <div className="relative size-[38px] shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-[#0057FF] to-[#7C3AED]">
      {avatarInner}
    </div>
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

function ShortlistSlateActions({
  canAct,
  onPickReplace,
  onPickMerge,
  centered = false,
}: {
  canAct: boolean;
  onPickReplace: () => void;
  onPickMerge: () => void;
  centered?: boolean;
}) {
  if (!canAct) return null;
  return (
    <div className={cn("mt-3 flex flex-wrap items-center gap-2", centered && "justify-center")}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md border border-[#0057FF]/40 bg-[#0057FF]/5 px-2.5 py-1.5 text-[11px] font-semibold text-[#0057FF] hover:bg-[#0057FF]/10"
        onClick={onPickReplace}
      >
        <ListRestartIcon className="size-3.5" />
        Import from shortlist
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted/50"
        onClick={onPickMerge}
      >
        <GitMergeIcon className="size-3.5" />
        Merge shortlist
      </button>
    </div>
  );
}

const REASON_CODE_LABELS: Record<
  NonNullable<SlateCreatorRecommendation["reasonCode"]>,
  string
> = {
  high_price: "High price",
  reach_risk: "Reach risk",
  client_choice: "Client choice",
  alternate: "Alternate",
};

function vendorCampaignRequirementScore(
  vendor: DisplayVendor,
  campaignObject?: CampaignObject
): StudioRequirementScore {
  return studioCreatorRequirementScore(
    {
      country: vendor.country,
      countryCode: vendor.countryCode,
      platform: vendor.platform,
      audienceSummary: vendor.audienceSummary,
      categories: vendor.categories,
      handle: vendor.handle,
      displayName: vendor.displayName,
    },
    getCampaignFacts(campaignObject)
  );
}

/**
 * The one campaign decision for a card.
 *
 * Built from the campaign's own requirements and the operator's decision. The
 * ECI signal rides along as supporting intelligence only — it cannot change the
 * status, which is what let an investment verdict appear as the campaign's
 * answer.
 */
function vendorCampaignDecision(
  vendor: DisplayVendor,
  campaignObject: CampaignObject | undefined,
  input: {
    onSlate: boolean;
    operatorStatus?: CampaignCreatorStatus;
    slateRationale?: string | null;
  }
): CampaignCreatorDecision {
  const creator = {
    country: vendor.country,
    countryCode: vendor.countryCode,
    platform: vendor.platform,
    audienceSummary: vendor.audienceSummary,
    categories: vendor.categories,
    handle: vendor.handle,
    displayName: vendor.displayName,
  };
  return resolveCampaignCreatorDecision({
    onSlate: input.onSlate,
    operatorStatus: input.operatorStatus,
    requirements: campaignRequirementChecks(creator, getCampaignFacts(campaignObject)),
    slateRationale: input.slateRationale,
    supportingSignal: vendor.planningSignal,
  });
}

function RequirementsMetBadge({
  vendor,
  campaignObject,
  refMode,
}: {
  vendor: DisplayVendor;
  campaignObject?: CampaignObject;
  refMode: boolean;
}) {
  const score = vendorCampaignRequirementScore(vendor, campaignObject);
  const label = studioRequirementBadgeLabel(score);
  if (!label) return null;
  const complete = score.met === score.total;
  if (refMode) {
    return (
      <span className={cn(STUDIO_REF_CLASSES.vbadge, complete ? STUDIO_REF_CLASSES.vbadgeFit : undefined)}>
        {label}
      </span>
    );
  }
  return (
    <span
      className={
        complete
          ? STUDIO_CLASSES.pillFit
          : "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      }
    >
      {label}
    </span>
  );
}

/**
 * A replacement candidate the campaign's own gates would reject.
 *
 * The creator stays on the list — silently removing it cost the operator a
 * replacement option with no explanation. The reason is shown instead, and an
 * out-of-market candidate is additionally not offered in the Replace panel.
 */
function CandidateIneligibilityBadge({ vendor }: { vendor: DisplayVendor }) {
  if (!vendor.candidateIneligibility) return null;
  return (
    <span
      className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      title="No longer eligible for this campaign — kept visible rather than removed without explanation"
    >
      {CANDIDATE_INELIGIBILITY_LABEL[vendor.candidateIneligibility]}
    </span>
  );
}

function VendorCardBlock({
  vendor,
  index,
  campaignObject,
  canAct,
  pendingCreatorId,
  vendorDecisions,
  draft,
  stageRemoval,
  undoDraftChange,
  applyDecision,
  stageRoleChange,
  openCreatorDetails,
  group,
  onReplace,
  observeCreator,
}: {
  vendor: DisplayVendor;
  index: number;
  campaignObject?: CampaignObject;
  canAct: boolean;
  pendingCreatorId: string | null;
  vendorDecisions: Record<string, "approved" | "rejected" | "shortlisted">;
  draft: StudioDraftState;
  stageRemoval: (vendor: DisplayVendor) => Promise<void>;
  undoDraftChange: (creatorId: string) => Promise<void>;
  applyDecision: (
    creatorId: string,
    action: "approve" | "reject" | "shortlist",
    unifiedId?: string,
    displayName?: string
  ) => Promise<void>;
  stageRoleChange: (creatorId: string, role: "main" | "alternative", displayName?: string) => Promise<void>;
  openCreatorDetails: (vendor: DisplayVendor) => void;
  /** Which group this card is rendered in — decides its decision wording. */
  group: StudioCreatorGroupKind;
  /** Present only for a SELECTED creator — the alternatives have nothing to replace. */
  onReplace?: (vendor: DisplayVendor) => void;
  observeCreator: (creatorId: string | null | undefined) => (node: HTMLElement | null) => void;
}) {
  const refMode = useStudioRefMode();
  const decision = vendor.id ? vendorDecisions[vendor.id] : undefined;
  const isPending = pendingCreatorId === vendor.id;
  const draftChange = draftChangeForCreator(draft, vendor.id);
  const pendingRemoval = draftChange?.kind === "remove_creator";
  const pendingApprove = draftChange?.kind === "approve_creator";
  const pendingReject = draftChange?.kind === "reject_creator";
  const pendingPromote = draftChange?.kind === "promote_main";
  const pendingDemote = draftChange?.kind === "demote_alternative";
  // ONE decision object per card. The pill, the Why, the Evidence and the
  // group this card sits in all read it.
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
      eciInvestmentScore: vendor.planningSignal?.investmentScore ?? vendor.fitScore,
      eciRecommendation: vendor.planningSignal?.recommendation ?? vendor.eciRecommendation,
      eciWhy: vendor.planningSignal?.why,
      eciCommercialJustification: vendor.planningSignal?.commercialJustification,
      eciEvidence: vendor.planningSignal?.evidence,
      // The campaign's own reason only. The ECI sentence used to seed this and
      // reached the card's "Why" line verbatim — analyst language on a
      // client-facing card. It is still carried above as `eciWhy` for the
      // intelligence layer and shown, filtered, in the detail's Campaign tab.
      rationale:
        vendor.reason && !isEmptyGlobalRationale(vendor.reason) ? vendor.reason : undefined,
    },
    campaignObject,
    index
  );

  // ONE decision object per card. The pill, the Why, the Evidence and the group
  // this card sits in all read it — including the campaign's own reason for the
  // creator, so there is no second competing "Why" line.
  const campaignDecision = vendorCampaignDecision(vendor, campaignObject, {
    onSlate: group === "selected" || group === "needs_review",
    operatorStatus: decision,
    slateRationale: clientSafeLine(grounding.whySelected),
  });

  const actionButtons = pendingRemoval ? (
    <button
      type="button"
      disabled={!canAct || isPending}
      className={refMode ? STUDIO_REF_CLASSES.vaction : STUDIO_CLASSES.actBtn}
      onClick={() => vendor.id && void undoDraftChange(vendor.id)}
    >
      <Undo2Icon className="size-3" />
      Undo removal
    </button>
  ) : (
    <>
      <button
        type="button"
        disabled={!canAct || isPending || decision === "approved" || pendingApprove}
        className={
          refMode
            ? cn(STUDIO_REF_CLASSES.vaction, STUDIO_REF_CLASSES.vactionApprove)
            : STUDIO_CLASSES.actBtnApprove
        }
        onClick={() =>
          vendor.id && void applyDecision(vendor.id, "approve", undefined, vendor.displayName)
        }
      >
        <CheckIcon className="size-3" />
        {decision === "approved" || pendingApprove ? "Approved (staged)" : "Approve"}
      </button>
      <button
        type="button"
        disabled={!canAct || isPending || pendingReject}
        className={refMode ? STUDIO_REF_CLASSES.vaction : STUDIO_CLASSES.actBtn}
        onClick={() =>
          vendor.id && void applyDecision(vendor.id, "reject", undefined, vendor.displayName)
        }
      >
        <XIcon className="size-3" />
        {pendingReject ? "Rejected (staged)" : "Reject"}
      </button>
      {vendor.slateRole === "maybe" ? (
        <button
          type="button"
          disabled={!canAct || isPending}
          className={refMode ? STUDIO_REF_CLASSES.vaction : STUDIO_CLASSES.actBtn}
          onClick={() => vendor.id && void stageRoleChange(vendor.id, "main", vendor.displayName)}
        >
          Promote to main
        </button>
      ) : (
        <button
          type="button"
          disabled={!canAct || isPending}
          className={refMode ? STUDIO_REF_CLASSES.vaction : STUDIO_CLASSES.actBtn}
          onClick={() =>
            vendor.id && void stageRoleChange(vendor.id, "alternative", vendor.displayName)
          }
        >
          Move to alt
        </button>
      )}
      <button
        type="button"
        disabled={!canAct || isPending || decision === "shortlisted"}
        className={refMode ? STUDIO_REF_CLASSES.vaction : STUDIO_CLASSES.actBtn}
        onClick={() => vendor.id && void applyDecision(vendor.id, "shortlist", vendor.id)}
      >
        <PlusIcon className="size-3" />+ Shortlist
      </button>
      <button
        type="button"
        className={refMode ? STUDIO_REF_CLASSES.vaction : STUDIO_CLASSES.actBtn}
        onClick={() => openCreatorDetails(vendor)}
      >
        View details
      </button>
      {onReplace ? (
        <button
          type="button"
          disabled={!canAct || isPending}
          className={refMode ? STUDIO_REF_CLASSES.vaction : STUDIO_CLASSES.actBtn}
          onClick={() => onReplace(vendor)}
          title="Replace this creator — from the other recommendations, Discovery, or a profile link"
        >
          <ListRestartIcon className="size-3" />
          Replace
        </button>
      ) : null}
      <button
        type="button"
        disabled={!canAct || isPending}
        className={refMode ? STUDIO_REF_CLASSES.vaction : STUDIO_CLASSES.actBtn}
        onClick={() => void stageRemoval(vendor)}
        title="Stage removal — recalculated on Apply All Updates"
      >
        <Trash2Icon className="size-3" />
        Remove
      </button>
    </>
  );

  if (refMode) {
    return (
      <div
        ref={observeCreator(vendor.id)}
        key={vendor.id ?? `${vendor.handle}-${index}`}
        className={cn(
          STUDIO_REF_CLASSES.vendorCard,
          pendingRemoval && "opacity-75"
        )}
      >
        <div className={STUDIO_REF_CLASSES.vendorTop}>
          {vendor.rank != null ? (
            <span className={STUDIO_REF_CLASSES.vendorRank}>#{vendor.rank}</span>
          ) : null}
          <VendorAvatar vendor={vendor} onOpenDetails={() => openCreatorDetails(vendor)} refMode />
          <div className={STUDIO_REF_CLASSES.vendorInfo}>
            <button
              type="button"
              className={cn(STUDIO_REF_CLASSES.vendorName, STUDIO_REF_CLASSES.vendorNameBtn)}
              onClick={() => openCreatorDetails(vendor)}
            >
              {vendor.displayName}
            </button>
            <div className={STUDIO_REF_CLASSES.vendorHandle}>
              {vendor.handle}
              {vendor.platform ? ` · ${vendor.platform}` : ""}
            </div>
          </div>
          <div className={STUDIO_REF_CLASSES.vendorBadges}>
            {vendor.tier ? (
              <span className={cn(STUDIO_REF_CLASSES.vbadge, STUDIO_REF_CLASSES.vbadgeTier)}>
                {vendor.tier}
              </span>
            ) : null}
            <RequirementsMetBadge vendor={vendor} campaignObject={campaignObject} refMode />
            <CandidateIneligibilityBadge vendor={vendor} />
            {vendor.planningSignal ? null : vendor.fitScore != null ? (
              <span className={cn(STUDIO_REF_CLASSES.vbadge, STUDIO_REF_CLASSES.vbadgeFit)}>
                Planning fit {Math.round(vendor.fitScore)}/100
              </span>
            ) : null}
          </div>
        </div>

        <div className={STUDIO_REF_CLASSES.vendorStats}>
          {formatFollowers(vendor.followers)} followers · {formatEngagement(vendor.engagementRate)} ER
          {vendor.country ? <> · {vendor.country}</> : null}
          {vendor.priceEstimate ? <> · {vendor.priceEstimate}</> : null}
          {vendor.platform ? <> · est. 1 {vendor.platform} post</> : null}
        </div>

        <div className={STUDIO_REF_CLASSES.vendorWhy}>
          {/*
            The campaign's reason now rides in the one decision object below, as
            its leading evidence. Two "Why" lines from two sources on one card
            was how a recommendation and a rejection came to sit side by side.
          */}
          <b>Why:</b> {campaignDecision.why}
          {vendor.contentIdea ? (
            <>
              <br />
              <span style={{ color: "var(--cs-blue-text)" }}>{vendor.contentIdea}</span>
            </>
          ) : null}
        </div>

        <StudioPlanningIntelligenceStrip decision={campaignDecision} />

        <div className={STUDIO_REF_CLASSES.vendorScores}>
          {grounding.factors.slice(0, 5).map((f) => (
            <span key={f.factor} className={STUDIO_REF_CLASSES.scoreChip} title={f.reason}>
              {f.factor} {f.score}
            </span>
          ))}
        </div>

        <div className={STUDIO_REF_CLASSES.vendorActions}>{actionButtons}</div>
        {!canAct ? (
          <p className={STUDIO_REF_CLASSES.remainingNote}>
            Save this studio message to enable creator actions.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={observeCreator(vendor.id)}
      key={vendor.id ?? `${vendor.handle}-${index}`}
      className={pendingRemoval ? "opacity-75" : undefined}
    >
      <div
        className={
          pendingRemoval
            ? "rounded-[14px] border border-amber-300 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/20"
            : STUDIO_CLASSES.creatorCard
        }
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <VendorAvatar vendor={vendor} onOpenDetails={() => openCreatorDetails(vendor)} />
          <div className="min-w-0 flex-1">
            {vendor.rank != null ? (
              <span className="text-[11px] font-extrabold text-[#7C3AED]">#{vendor.rank} </span>
            ) : null}
            <button
              type="button"
              className="text-[14px] font-extrabold text-foreground hover:text-[#0057FF]"
              onClick={() => openCreatorDetails(vendor)}
            >
              {vendor.displayName}
            </button>{" "}
            <span className="text-[11.5px] text-[#6B7280]">{vendor.handle}</span>
          </div>
          {vendor.slateRole === "main" ? (
            <span className="rounded-full bg-[#0057FF]/10 px-2 py-0.5 text-[9px] font-extrabold text-[#0057FF]">
              Main
            </span>
          ) : vendor.slateRole === "maybe" ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Maybe
            </span>
          ) : null}
          {vendor.tier ? <span className={STUDIO_CLASSES.pillTier}>{vendor.tier}</span> : null}
          <RequirementsMetBadge vendor={vendor} campaignObject={campaignObject} refMode={false} />
          <CandidateIneligibilityBadge vendor={vendor} />
          {vendor.expectedRole ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
              {vendor.expectedRole}
            </span>
          ) : null}
          {vendor.wave != null ? (
            <span className="rounded-full bg-[#0057FF]/10 px-2 py-0.5 text-[9px] font-bold text-[#0057FF]">
              Wave {vendor.wave}
            </span>
          ) : null}
          {vendor.priority ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-semibold text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
              {vendor.priority} priority
            </span>
          ) : null}
          {vendor.serviceType ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">
              {vendor.serviceType}
            </span>
          ) : null}
          {vendor.planningSignal ? null : vendor.fitScore != null ? (
            <span className={STUDIO_CLASSES.pillFit}>
              Planning fit {Math.round(vendor.fitScore)}/100
            </span>
          ) : null}
          {pendingRemoval ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold text-amber-800">
              Pending removal
            </span>
          ) : pendingApprove ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold text-emerald-800">
              Pending approval
            </span>
          ) : pendingReject ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-extrabold text-red-800">
              Pending rejection
            </span>
          ) : pendingPromote || pendingDemote ? (
            <span className="rounded-full bg-[#0057FF]/10 px-2 py-0.5 text-[9px] font-extrabold text-[#0057FF]">
              Role change staged
            </span>
          ) : null}
        </div>

        <p className="mt-2 text-[11.5px] text-[#6B7280]">
          {formatFollowers(vendor.followers)} followers ·{" "}
          <b className="text-foreground">{formatEngagement(vendor.engagementRate)} ER</b>
          {vendor.country ? <> · {vendor.country}</> : null}
          {vendor.priceEstimate ? <> · {vendor.priceEstimate}</> : null}
          {vendor.platform ? <> · est. 1 {vendor.platform} post</> : null}
        </p>

        {vendor.suggestedTimelineSlot ? (
          <p className="mt-1.5 text-[11px] font-semibold text-[#D97706]">
            Suggested slot: {vendor.suggestedTimelineSlot}
          </p>
        ) : null}

        <p className="mt-1.5 text-xs text-foreground">
          <b>Why:</b> {campaignDecision.why}
        </p>
        {vendor.slateReason ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {vendor.slateReasonCode
              ? `${REASON_CODE_LABELS[vendor.slateReasonCode]} · `
              : ""}
            {vendor.slateReason}
          </p>
        ) : null}
        {vendor.contentIdea ? (
          <p className="mt-1 text-xs font-semibold text-[#0057FF]">{vendor.contentIdea}</p>
        ) : null}

        <StudioPlanningIntelligenceStrip decision={campaignDecision} />

        {/*
          No raw confidence percentage. A bare "Confidence: 62%" is an internal
          reliability reading with no stated basis — it read as a claim about
          the creator. The decision and its reasons are above; the confidence
          inputs stay in the detail's Campaign tab.
        */}

        <div className="mt-2 flex flex-wrap gap-1">
          {grounding.factors.slice(0, 5).map((f) => (
            <span key={f.factor} className={STUDIO_CLASSES.fitTag} title={f.reason}>
              {f.factor} {f.score}
            </span>
          ))}
        </div>

        <div className="mt-2.5 flex flex-wrap gap-2">{actionButtons}</div>
        {!canAct ? (
          <p className="mt-1 text-[10px] text-[#6B7280]">
            Save this studio message to enable creator actions.
          </p>
        ) : null}
      </div>
    </div>
  );
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
  onSlateUpdated,
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
  const [shortlistPickerMode, setShortlistPickerMode] = useState<"replace" | "merge" | null>(null);
  /** The selected creator being replaced, or null when adding. */
  const [replaceTarget, setReplaceTarget] = useState<StudioCreatorReplacementTarget | null>(
    null
  );
  const [compareOpen, setCompareOpen] = useState(false);
  const confirmDelete = useConfirmDelete();
  const refMode = useStudioRefMode();

  const previewCreatorsData = useMemo(() => {
    if (!campaignObject) return {} as CreatorsSectionData;
    if (draft.changes.length === 0) {
      return (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
    }
    return previewCreatorsSectionFromDraft(campaignObject, draft);
  }, [campaignObject, draft]);

  const slateIntelligence = previewCreatorsData.slateIntelligence;
  const previewVendorDecisions = previewCreatorsData.vendorDecisions ?? vendorDecisions;
  const creatorsPhase = previewCreatorsData.phase ?? creatorsData.phase;
  const creatorPackageThesis = useMemo(() => {
    if (!campaignObject) return null;
    return deriveEnterprisePlanningNarrative(campaignObject).creatorPackageThesis;
  }, [campaignObject]);
  const quantityRecommendation = useMemo(() => {
    if (previewCreatorsData.quantityRecommendation) return previewCreatorsData.quantityRecommendation;
    if (!campaignObject) return null;
    return deriveCreatorQuantityRecommendation(getCampaignFacts(campaignObject));
  }, [campaignObject, previewCreatorsData.quantityRecommendation]);

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
      unifiedId?: string,
      displayName?: string
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
            displayName,
          });
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          if (result.draft) publishDraft(result.draft);
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
          displayName,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        if (result.draft) publishDraft(result.draft);
        if (result.vendorDecisions) {
          setVendorDecisions(result.vendorDecisions);
          onVendorDecisionsUpdated?.(result.vendorDecisions);
        }
        toast.success(result.message);
      } finally {
        setPendingCreatorId(null);
      }
    },
    [campaignObject, conversationId, messageId, onVendorDecisionsUpdated, publishDraft]
  );

  const stageRoleChange = useCallback(
    async (creatorId: string, role: "main" | "alternative", displayName?: string) => {
      if (!conversationId || !messageId) return;
      setPendingCreatorId(creatorId);
      try {
        const result = await stageVendorRoleAction({
          conversationId,
          messageId,
          creatorId,
          role,
          displayName,
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

  const stageRemoval = useCallback(
    async (vendor: DisplayVendor) => {
      if (!conversationId || !messageId || !vendor.id) return;
      const ok = await confirmDelete(
        `Remove ${vendor.displayName} from vendor recommendations? Changes apply when you save updates.`,
        "Remove vendor?"
      );
      if (!ok) return;

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
    [confirmDelete, conversationId, messageId, publishDraft]
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
  const { ids: persistedIds, rationale, avgFitScore, creatorFitScores } = resolveCreatorIds(
    campaignObject,
    { recommendationsOnly: true }
  );
  const previewIds = previewCreatorsData.recommendations?.creatorIds ?? [];
  const usingDraftPreview = draft.changes.length > 0 && previewIds.length > 0;
  const { recommendationIds, discoveryIds } = resolveCreatorCounts(campaignObject);
  const slateIds = usingDraftPreview ? previewIds : persistedIds;
  const ids =
    !usingDraftPreview && discoveryIds.length > slateIds.length ? discoveryIds : slateIds;
  const safeRationale = isEmptyGlobalRationale(rationale) ? undefined : rationale;
  const hasCommittedRecommendations = recommendationIds.length > 0;
  // Selected vs recommended-but-not-selected, derived from ids the campaign
  // already persists — `recommendations.creatorIds` against the pool in
  // `discovery.creatorIds`. Nothing new is stored, and the existing
  // `recommendationCount` keeps its meaning.
  const slateSplit = useMemo(
    () =>
      splitRecommendedCreatorIds({
        recommendationIds: usingDraftPreview ? previewIds : recommendationIds,
        discoveryIds,
        excludeIds: appliedRemovedCreatorIds ?? [],
      }),
    [usingDraftPreview, previewIds, recommendationIds, discoveryIds, appliedRemovedCreatorIds]
  );
  const pendingProposal = creatorsData.pendingProposal;
  const isRegeneratingProposal = pendingProposal?.status === "generating";
  const proposalRegenerationFailed =
    pendingProposal?.status === "failed" ||
    (creatorsData.slateProposalStatus?.status === "blocked" && hasCommittedRecommendations);
  const regenerationFailureMessage =
    pendingProposal?.error?.message ?? creatorsData.slateProposalStatus?.message;
  const regenerationFailureAction =
    pendingProposal?.error?.actionLabel ?? creatorsData.slateProposalStatus?.actionLabel;

  const mapperOptions = useMemo(() => {
    const facts = getCampaignFacts(campaignObject);
    return {
      preferredPlatforms: facts?.platforms,
      currency: resolveInfluencerEstimateCurrency(facts),
      campaignFitScoresByCreatorId: creatorFitScores,
      campaignMarkets: facts?.geography,
      campaignIndustry: facts?.industry,
      campaignType: facts?.campaignType,
      briefText: facts?.rawBriefExcerpt,
      objective: facts?.objective,
      audience: facts?.audience,
    };
  }, [campaignObject, creatorFitScores]);

  const { observeCreator } = useViewportCreatorIds();
  // `phase` was returned by the hook and discarded here, so the section showed
  // its skeleton only while ZERO creators existed and then declared itself done
  // after wave 1 — while phases 2 (ECI) and 3 (quotation) were still running.
  // Those are the waves that reorder cards and, once an ECI decision arrives,
  // filter one out. Keeping the real phase makes the list say it is still
  // settling instead of presenting a mid-hydration state as final.
  const {
    vendors: hydrated,
    loading,
    phase: hydrationPhase,
  } = useCreatorHydration(ids, safeRationale, avgFitScore, mapperOptions);

  const campaignFacts = getCampaignFacts(campaignObject);

  const removedIdSet = useMemo(
    () => new Set((appliedRemovedCreatorIds ?? []).map(normalizeCreatorId)),
    [appliedRemovedCreatorIds]
  );

  const slateRecByCreatorId = useMemo(() => {
    const map = new Map<string, SlateCreatorRecommendation>();
    for (const rec of slateIntelligence?.recommendations ?? []) {
      map.set(normalizeCreatorId(rec.creatorId), rec);
    }
    return map;
  }, [slateIntelligence?.recommendations]);

  const attachSlateMeta = useCallback(
    (vendor: Omit<DisplayVendor, "slateRole" | "slateReason" | "slateReasonCode" | "suggestedTimelineSlot" | "wave" | "priority" | "serviceType" | "contentPillar" | "expectedRole" | "confidence">): DisplayVendor => {
      const rec = vendor.id ? slateRecByCreatorId.get(normalizeCreatorId(vendor.id)) : undefined;
      const reasoning = previewCreatorsData.recommendations?.selectedReasoning?.find(
        (r) => vendor.id && sameCreatorPreview(r.creatorId, vendor.id)
      );
      return {
        ...vendor,
        slateRole: rec?.role,
        slateReason: rec?.reason,
        slateReasonCode: rec?.reasonCode,
        suggestedTimelineSlot: rec?.suggestedTimelineSlot,
        wave: rec?.wave,
        priority: rec?.priority,
        serviceType: rec?.serviceType ?? reasoning?.serviceLabel ?? reasoning?.serviceTypes?.[0],
        contentPillar: rec?.contentPillar,
        expectedRole: reasoning?.expectedRole,
        confidence: reasoning?.confidence,
      };
    },
    [slateRecByCreatorId, previewCreatorsData.recommendations?.selectedReasoning]
  );

  function sameCreatorPreview(a: string, b: string): boolean {
    return normalizeCreatorId(a) === normalizeCreatorId(b);
  }

  const parsedByHandle = useMemo(() => {
    const map = new Map<string, (typeof parsedVendors)[number]>();
    for (const vendor of parsedVendors) {
      map.set(vendor.handle.replace(/^@/, "").toLowerCase(), vendor);
    }
    return map;
  }, [parsedVendors]);

  const vendors: DisplayVendor[] = useMemo(
    () =>
      hydrated.length > 0
        ? dedupeByCreatorId(
            hydrated
              .filter(
                (v) =>
                  !v.id ||
                  (previewVendorDecisions[v.id] !== "rejected" &&
                    !removedIdSet.has(normalizeCreatorId(v.id)))
              )
              .map((v, i) => {
                const parsed = parsedByHandle.get(v.handle.replace(/^@/, "").toLowerCase());
                const followers = v.followers && v.followers > 0 ? v.followers : parsed?.followers;
                const engagementRate =
                  v.engagementRate && v.engagementRate > 0
                    ? v.engagementRate
                    : parsed?.engagementRate;
                const displayName =
                  v.displayName && !/^creator\s+\d+$/i.test(v.displayName)
                    ? v.displayName
                    : parsed?.displayName ?? v.displayName;
                return attachSlateMeta({
                  id: v.id,
                  rank: i + 1,
                  displayName,
                  handle: v.handle,
                  platform: v.platform || parsed?.platform || "instagram",
                  followers,
                  engagementRate,
                  fitScore: v.brandFit ?? parsed?.fitScore,
                  reason: v.reason,
                  avatarUrl: v.avatarUrl,
                  profileUrl: v.profileUrl,
                  country: v.country,
                  countryCode: v.countryCode,
                  language: v.language,
                  audienceSummary: v.audienceSummary,
                  categories: v.categories,
                  priceEstimate: v.priceEstimate ?? parsed?.priceEstimate,
                  thinkwayScore: v.thinkwayScore,
                  matchPercent: v.matchPercent,
                  tier: resolveCreatorTierLabel({
                    followers,
                    role: v.tier !== "Unknown" ? v.tier : undefined,
                  }),
                  eciRecommendation: v.eciRecommendation,
                  eciConfidencePercent: v.eciConfidencePercent,
                  planningSignal: v.planningSignal,
                  contentIdea: buildCreatorContentIdea(
                    { categories: v.categories ?? [v.audienceSummary ?? ""] },
                    campaignFacts,
                    i
                  ),
                });
              }),
            (v) => v.id ?? `${v.handle}:${v.displayName}`
          ).items
        : usingDraftPreview
          ? []
          : dedupeByCreatorId(
            parsedVendors
              .filter(
                (v) =>
                  !v.id ||
                  (previewVendorDecisions[v.id] !== "rejected" &&
                    !removedIdSet.has(normalizeCreatorId(v.id)))
              )
              .map((v, i) =>
                attachSlateMeta({
                  ...v,
                  tier: resolveCreatorTierLabel({ followers: v.followers }),
                  contentIdea: buildCreatorContentIdea(
                    { categories: [v.reason ?? ""] },
                    campaignFacts,
                    i
                  ),
                })
              ),
            (v) => v.id ?? `${v.handle}:${v.displayName}`
          ).items,
    [
      hydrated,
      parsedVendors,
      parsedByHandle,
      previewVendorDecisions,
      campaignFacts,
      removedIdSet,
      attachSlateMeta,
      usingDraftPreview,
    ]
  );

  const marketVendors = useMemo(() => {
    const recommended = selectStudioRecommendedVendors(vendors, {
      markets: campaignFacts?.geography,
      locationOf: (vendor) => ({
        country: vendor.country,
        countryCode: vendor.countryCode,
      }),
      fitsBriefMix: (vendor) =>
        vendorFitsStudioBriefMix(
          {
            audienceSummary: vendor.audienceSummary,
            categories: vendor.categories,
            handle: vendor.handle,
            displayName: vendor.displayName,
          },
          campaignFacts
        ),
    });
    return sortByStudioRequirements(recommended, (vendor) =>
      // Ranking score: platform is eligibility, not a quality signal, so it
      // orders nothing. The card badge still counts it.
      studioCreatorRankingScore(
        {
          country: vendor.country,
          countryCode: vendor.countryCode,
          platform: vendor.platform,
          audienceSummary: vendor.audienceSummary,
          categories: vendor.categories,
          handle: vendor.handle,
          displayName: vendor.displayName,
        },
        campaignFacts
      )
    );
    // No serial here. This is the gated POOL — slate plus alternatives — and
    // stamping positions on it is what put "#3" on the first recommended card.
    // The slate's own positions are assigned below, after the partition.
  }, [vendors, campaignFacts]);
  const marketLabel = campaignFacts?.geography?.filter((value) => value.trim()).join(", ") || null;

  // The section already hydrates the whole pool, so the remaining
  // recommendations are here — they were simply rendered indistinguishably from
  // the slate. Split them so it is clear which creators are selected.
  const selectedKeys = useMemo(
    () => new Set(slateSplit.selectedIds.map(creatorGroupingKey)),
    [slateSplit.selectedIds]
  );
  /**
   * One partition, so the three groups close over the hydrated pool.
   *
   * SELECTED used to filter the GATED list while ALTERNATIVES was the ungated
   * pool minus the slate, so a slate member the gate rejected was in neither
   * and vanished. Content reads the same slate ungated and kept every member —
   * that gap is why Content listed ten creators and this screen showed three.
   * `needsReview` now carries them, with the gate's verdict, and they are never
   * counted as recommended.
   */
  const creatorGroups = useMemo(() => {
    // The gated set IS the set whose campaign decision is "recommended", so a
    // group heading can never claim something its cards deny. It also covers an
    // operator rejection, which the requirement gates know nothing about.
    const recommended = marketVendors.filter((vendor) => {
      const key = vendor.id ? creatorGroupingKey(vendor.id) : "";
      const decision = vendorCampaignDecision(vendor, campaignObject, {
        onSlate: Boolean(key) && selectedKeys.has(key),
        operatorStatus: vendor.id ? previewVendorDecisions[vendor.id] : undefined,
      });
      return decision.status === "recommended";
    });
    return partitionStudioCreatorGroups({
      pool: vendors,
      gated: recommended,
      slateIds: slateSplit.selectedIds,
      idOf: (vendor) => vendor.id,
      normalize: creatorGroupingKey,
    });
  }, [
    vendors,
    marketVendors,
    slateSplit.selectedIds,
    selectedKeys,
    campaignObject,
    previewVendorDecisions,
  ]);
  const selectedVendors = creatorGroups.selected;
  const needsReviewVendors = creatorGroups.needsReview;
  // Candidates come from the ungated hydrated pool, NOT from `marketVendors`.
  // `selectStudioRecommendedVendors` decides what belongs on the SELECTED
  // recommendations list ("once a decision exists, only Recommended belongs");
  // deriving the alternatives from its output applied that rule to candidates
  // too, so a creator ECI later judged differently disappeared and the
  // alternatives count shrank silently. Every remaining recommendation is
  // listed here, and one that is no longer eligible carries its reason.
  const otherRecommendedCandidates = useMemo(() => {
    const ordered = sortByStudioRequirements(creatorGroups.alternatives, (vendor) =>
      studioCreatorRankingScore(
        {
          country: vendor.country,
          countryCode: vendor.countryCode,
          platform: vendor.platform,
          audienceSummary: vendor.audienceSummary,
          categories: vendor.categories,
          handle: vendor.handle,
          displayName: vendor.displayName,
        },
        campaignFacts
      )
    );
    return classifyReplacementCandidates(ordered, {
      matchesMarket: (vendor) =>
        vendorMatchesCampaignMarket(
          { country: vendor.country, countryCode: vendor.countryCode },
          campaignFacts?.geography
        ),
      fitsBriefMix: (vendor) =>
        vendorFitsStudioBriefMix(
          {
            audienceSummary: vendor.audienceSummary,
            categories: vendor.categories,
            handle: vendor.handle,
            displayName: vendor.displayName,
          },
          campaignFacts
        ),
    });
  }, [creatorGroups.alternatives, campaignFacts]);
  // Same classifier the alternatives use, so a rejected slate member states the
  // gate that rejected it rather than just disappearing.
  const needsReviewClassified = useMemo(
    () =>
      classifyReplacementCandidates(needsReviewVendors, {
        matchesMarket: (vendor) =>
          vendorMatchesCampaignMarket(
            { country: vendor.country, countryCode: vendor.countryCode },
            campaignFacts?.geography
          ),
        fitsBriefMix: (vendor) =>
          vendorFitsStudioBriefMix(
            {
              audienceSummary: vendor.audienceSummary,
              categories: vendor.categories,
              handle: vendor.handle,
              displayName: vendor.displayName,
            },
            campaignFacts
          ),
      }),
    [needsReviewVendors, campaignFacts]
  );
  const needsReviewDisplayVendors = useMemo(
    () =>
      needsReviewClassified.map(({ vendor, ineligibility }) => ({
        ...vendor,
        // Slate position, contiguous after the recommended members.
        rank: undefined,
        ...(ineligibility ? { candidateIneligibility: ineligibility } : {}),
      })),
    [needsReviewClassified]
  );

  const otherRecommendedVendors = useMemo(
    () =>
      otherRecommendedCandidates.map(({ vendor, ineligibility }) => ({
        ...vendor,
        // No `#`. These carried their position in the hydrated Discovery pool,
        // rendered in the same list as the slate's contiguous positions — which
        // is why the numbering read 1,2,3 … 10 then jumped to 16. A pool
        // position is not a slate position, so it is not shown as one.
        rank: undefined,
        ...(ineligibility ? { candidateIneligibility: ineligibility } : {}),
      })),
    [otherRecommendedCandidates]
  );
  const candidateSummary = useMemo(
    () => summarizeCandidates(otherRecommendedCandidates),
    [otherRecommendedCandidates]
  );
  // Before a slate exists every hydrated creator is a candidate, not a
  // selection — keep the established single-list rendering for that.
  const hasSlateSplit = selectedVendors.length > 0;
  // Route B of Replace: browsing Discovery with the campaign's own confirmed
  // constraints, so the operator is not forced to type a name when no
  // recommended candidate is left.
  const campaignBrowseFilters = useMemo(
    () => studioCampaignBrowseFilters(campaignObject),
    [campaignObject]
  );
  /*
   * Route A of Replace: the campaign's own remaining recommendations, already
   * hydrated here, handed to the existing add panel as candidate refs.
   *
   * Eligibility is EVERY campaign requirement the classifier checked, not just
   * market. Treating a brief-mix miss as advisory is how a Food creator came to
   * be offered as a replacement on a premium-haircare campaign. Such a creator
   * stays visible in the alternatives list with its reason — nothing is hidden
   * — it is simply not offered as a replacement. Ordering then prefers the
   * tier of the creator being replaced and drops tiers the Strategy did not
   * approve, reusing the campaign's own tier mix.
   */
  const replaceTargetId = replaceTarget?.creatorId ?? null;
  const replaceTargetTier = useMemo(() => {
    if (!replaceTargetId) return null;
    const key = creatorGroupingKey(replaceTargetId);
    const match = vendors.find((vendor) => vendor.id && creatorGroupingKey(vendor.id) === key);
    return match?.expectedRole ?? match?.slateRole ?? null;
  }, [replaceTargetId, vendors]);

  const approvedTiers = useMemo(
    () => resolveCreatorTierMix(campaignFacts).map((tier) => tier.tier),
    [campaignFacts]
  );

  const replacementCandidates = useMemo(() => {
    const eligible = otherRecommendedCandidates.filter(
      (candidate) => Boolean(candidate.vendor.id) && replacementCandidateIsEligible(candidate)
    );
    const ordered = orderReplacementCandidatesByRole(eligible, {
      targetTier: replaceTargetTier,
      tierOf: (candidate) => candidate.vendor.expectedRole,
      approvedTiers,
    });
    return ordered.map(({ vendor }) => ({
      creatorId: vendor.id!,
      displayName: vendor.displayName,
      handle: vendor.handle,
      platform: vendor.platform,
      followers: vendor.followers,
      avatarUrl: vendor.avatarUrl,
      source: "discovery" as const,
      enrichmentStatus: "not_requested" as const,
    }));
  }, [otherRecommendedCandidates, replaceTargetTier, approvedTiers]);

  /** Stated when the campaign's own candidates yield no eligible replacement. */
  const replacementShortage = useMemo(() => {
    if (replacementCandidates.length > 0) return null;
    const excludedBy: Partial<Record<CandidateIneligibility, number>> = {};
    for (const candidate of otherRecommendedCandidates) {
      if (!candidate.ineligibility) continue;
      excludedBy[candidate.ineligibility] = (excludedBy[candidate.ineligibility] ?? 0) + 1;
    }
    return replacementShortageNote({
      consideredCount: otherRecommendedCandidates.length,
      excludedBy,
    });
  }, [replacementCandidates.length, otherRecommendedCandidates]);
  // "Requested" is what the campaign ASKED FOR — the Strategy's evidence-based
  // quantity, falling back to the slate it actually composed. Using the slate
  // size for both sides could never report the Strategy-vs-slate gap, which is
  // the shortfall the requested count implies.
  const slateShortfall = resolveStudioCreatorShortfall({
    requestedCount: quantityRecommendation?.recommended ?? slateSplit.selectedCount,
    recommendedCount: selectedVendors.length,
  });
  const slateVendors = hasSlateSplit ? selectedVendors : marketVendors;

  // Campaign slate positions, contiguous from #1 in RENDER order — main picks
  // first, then maybe/replacements — assigned after the partition and after the
  // main/maybe split, so neither a pool position nor a skipped group can leave
  // a gap.
  const orderedSlateVendors = withSlatePositions([
    ...slateVendors.filter((v) => v.slateRole !== "maybe"),
    ...slateVendors.filter((v) => v.slateRole === "maybe"),
  ]);
  const mainVendors = orderedSlateVendors.filter((v) => v.slateRole !== "maybe");
  const maybeVendors = orderedSlateVendors.filter((v) => v.slateRole === "maybe");
  // Each group carries what it MEANS, not just a heading. The alternatives group
  // is Discovery's remaining pool — searched, hydrated, not in the slate — and
  // it asserts no recommendation, because each card shows its own ECI decision.
  // Titling it "Other Recommended Creators" put a red "Not Recommended" pill
  // under a heading that claimed the opposite.
  const displayGroups: Array<StudioCreatorGroup<DisplayVendor>> = [
    ...(maybeVendors.length > 0
      ? [
          {
            kind: "selected" as const,
            title: "Main picks",
            items: mainVendors.length > 0 ? mainVendors : orderedSlateVendors,
          },
          { kind: "selected" as const, title: "Maybe / replacements", items: maybeVendors },
        ]
      : [{ kind: "selected" as const, title: null as string | null, items: orderedSlateVendors }]),
    ...(needsReviewDisplayVendors.length > 0
      ? [
          {
            kind: "needs_review" as const,
            // Factual for every member: on the campaign's slate, and not in the
            // recommendation. Each card states its own campaign decision.
            title: `On the slate · not in the recommendation (${needsReviewDisplayVendors.length})`,
            items: needsReviewDisplayVendors,
          },
        ]
      : []),
    ...(hasSlateSplit && otherRecommendedVendors.length > 0
      ? [
          {
            kind: "alternatives" as const,
            title: `Other creators from Discovery (${otherRecommendedVendors.length})`,
            items: otherRecommendedVendors,
          },
        ]
      : []),
  ];

  // Out-of-market creators that are genuinely not on screen anywhere. An
  // out-of-market candidate is now listed with its reason, so counting it as
  // "hidden" would contradict the card the operator can see.
  const renderedIdKeys = new Set(
    displayGroups.flatMap((group) =>
      group.items.flatMap((vendor) => (vendor.id ? [creatorGroupingKey(vendor.id)] : []))
    )
  );
  const excludedByMarket = vendors.filter(
    (vendor) =>
      !vendorMatchesCampaignMarket(
        { country: vendor.country, countryCode: vendor.countryCode },
        campaignFacts?.geography
      ) && (!vendor.id || !renderedIdKeys.has(creatorGroupingKey(vendor.id)))
  ).length;

  const visibleGroupItems = showAllVendors
    ? displayGroups
    : displayGroups.map((group) => ({
        ...group,
        items: group.items.slice(0, STUDIO_VENDOR_INITIAL_VISIBLE),
      }));
  // Counted across every rendered group: the old count knew only about the
  // selected list, so truncated replacement candidates had no "show all".
  const displayedTotal = displayGroups.reduce((sum, group) => sum + group.items.length, 0);
  const visibleTotal = visibleGroupItems.reduce((sum, group) => sum + group.items.length, 0);
  const hiddenCount = Math.max(0, displayedTotal - visibleTotal);
  const preferredPlatformLabel = mapperOptions.preferredPlatforms?.length
    ? mapperOptions.preferredPlatforms.join(" + ")
    : undefined;
  const discoveryEngine = creatorsData.discoveryEngine;
  const fitScoreCount =
    creatorsData.fitScoreCount ??
    (creatorFitScores ? Object.keys(creatorFitScores).length : 0);

  // Searching or hydrating must never render as "Discovery returned nothing".
  // The campaign holding creator ids while no card has hydrated yet is the case
  // that used to fall through to the empty area.
  const listState = resolveStudioCreatorListState({
    expectedCreatorIdCount: creatorIdsToHydrate(slateSplit).length,
    hydratedCount: vendors.length,
    searching: isRunning || isRegeneratingProposal,
    hydrationLoading: loading,
    hasSearched: Boolean(creatorsData.lastDiscoveryAt),
    proposalBlocked: creatorsData.slateProposalStatus?.status === "blocked",
  });

  if (studioCreatorListIsLoading(listState) && vendors.length === 0) {
    return <SectionSkeleton variant="vendors" />;
  }

  if (vendors.length === 0) {
    const proposalBlocked =
      creatorsData.slateProposalStatus?.status === "blocked" && !hasCommittedRecommendations;
    const shortlistPickerDialog =
      conversationId && messageId && shortlistPickerMode ? (
        <ShortlistSlatePickerDialog
          open={shortlistPickerMode != null}
          onOpenChange={(open) => {
            if (!open) setShortlistPickerMode(null);
          }}
          mode={shortlistPickerMode}
          conversationId={conversationId}
          messageId={messageId}
          onApplied={({ linkedShortlistId: nextShortlistId, draft: nextDraft }) => {
            if (nextShortlistId) setLinkedShortlistId(nextShortlistId);
            if (nextDraft) publishDraft(nextDraft);
          }}
        />
      ) : null;

    if (proposalBlocked) {
      return (
        <>
          <div className="rounded-xl border border-amber-300/80 bg-amber-50/80 px-4 py-5 text-center dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              {creatorsData.slateProposalStatus?.message}
            </p>
            {creatorsData.slateProposalStatus?.actionLabel ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Next step: {creatorsData.slateProposalStatus.actionLabel}
              </p>
            ) : null}
            <ShortlistSlateActions
              canAct={canAct}
              centered
              onPickReplace={() => setShortlistPickerMode("replace")}
              onPickMerge={() => setShortlistPickerMode("merge")}
            />
          </div>
          {shortlistPickerDialog}
        </>
      );
    }
    if (shouldShowPendingPlaceholder(status, hasCommittedRecommendations)) {
      if (hasCommittedRecommendations) {
        return <SectionSkeleton variant="vendors" />;
      }
      return (
        <>
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-center">
            <p className="text-sm text-muted-foreground">
              Run discovery to generate recommendations, or import a prepared shortlist.
            </p>
            <ShortlistSlateActions
              canAct={canAct}
              centered
              onPickReplace={() => setShortlistPickerMode("replace")}
              onPickMerge={() => setShortlistPickerMode("merge")}
            />
          </div>
          {shortlistPickerDialog}
        </>
      );
    }
    return (
      <>
        <SectionFallbackContent text={fallbackText} />
        <ShortlistSlateActions
          canAct={canAct}
          onPickReplace={() => setShortlistPickerMode("replace")}
          onPickMerge={() => setShortlistPickerMode("merge")}
        />
        {shortlistPickerDialog}
      </>
    );
  }

  return (
    <div className="min-w-0 space-y-2">
      {quantityRecommendation ? (
        <div className="rounded-lg border border-[#1D9E75]/25 bg-[#1D9E75]/5 px-3 py-2.5 text-[12px]">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#1D9E75]">
            Recommended quantity
            {quantityRecommendation.recommended != null
              ? ` · ${quantityRecommendation.recommended} creators`
              : ""}
            {quantityRecommendation.confidence > 0
              ? ` · ${Math.round(quantityRecommendation.confidence * 100)}% confidence in this quantity`
              : ""}
          </p>
          <p className="mt-1 text-foreground">{quantityRecommendation.rationale}</p>
        </div>
      ) : null}
      {creatorPackageThesis ? (
        <div className="rounded-lg border border-[#0057FF]/25 bg-[#0057FF]/5 px-3 py-2.5 text-[12px]">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#0057FF]">
            Creator strategy · Enterprise Planning Package
          </p>
          <p className="mt-1 text-foreground">{creatorPackageThesis}</p>
        </div>
      ) : null}
      {isRegeneratingProposal ? (
        <div className="rounded-lg border border-[#0057FF]/30 bg-[#0057FF]/5 px-3 py-2">
          <p className="text-[11px] font-semibold text-[#0057FF]">Regenerating creator slate…</p>
          <p className="text-[10px] text-muted-foreground">
            Your current recommendations stay visible until the new slate is ready.
          </p>
        </div>
      ) : null}
      {proposalRegenerationFailed && regenerationFailureMessage ? (
        <div className="rounded-lg border border-amber-300/80 bg-amber-50/80 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-100">
            Could not refresh creator slate
          </p>
          <p className="mt-1 text-[10px] text-amber-900/90 dark:text-amber-100/90">
            {regenerationFailureMessage}
          </p>
          {regenerationFailureAction ? (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Next step: {regenerationFailureAction}
            </p>
          ) : null}
        </div>
      ) : null}
      {creatorsPhase === "proposal" ? (
        <div className="rounded-lg border border-[#0057FF]/40 bg-[#0057FF]/5 px-3 py-2">
          <p className="text-[11px] font-bold text-[#0057FF]">AI-proposed creator slate</p>
          <p className="text-[10px] text-muted-foreground">
            Campaign Director approved the strategy and Thinkway auto-proposed this slate. Review,
            stage edits, then Apply Changes to regenerate the full plan.
          </p>
        </div>
      ) : null}
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
      {creatorsData.constraintReport?.relaxations?.length ? (
        <div className="rounded-md border border-amber-300/50 bg-amber-50/80 px-2.5 py-1.5 text-[10px] text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">Preferred constraints relaxed</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {creatorsData.constraintReport.relaxations.slice(0, 4).map((item) => (
              <li key={`${item.key}:${item.value}`}>
                {item.label}: {item.reason}
                {item.businessImpact ? ` — ${item.businessImpact}` : ""}
              </li>
            ))}
          </ul>
          {creatorsData.constraintReport.rejectedMandatoryCount > 0 ? (
            <p className="mt-1 text-muted-foreground">
              {creatorsData.constraintReport.rejectedMandatoryCount} creator
              {creatorsData.constraintReport.rejectedMandatoryCount === 1 ? "" : "s"}{" "}
              removed for mandatory-constraint violations (never recommended).
            </p>
          ) : null}
        </div>
      ) : creatorsData.constraintReport?.rejectedMandatoryCount ? (
        <p className="rounded-md border border-[#1D9E75]/30 bg-[#1D9E75]/5 px-2.5 py-1.5 text-[10px] text-muted-foreground">
          Mandatory constraints enforced —{" "}
          {creatorsData.constraintReport.rejectedMandatoryCount} off-constraint creator
          {creatorsData.constraintReport.rejectedMandatoryCount === 1 ? "" : "s"} excluded.
        </p>
      ) : null}
      {slateShortfall.summary ? (
        <p className="rounded-xl border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          {slateShortfall.summary}
          {needsReviewDisplayVendors.length > 0 ? (
            <span className="mt-1 block text-[11px] font-normal">
              {needsReviewDisplayVendors.length} of the slate{" "}
              {needsReviewDisplayVendors.length === 1 ? "creator is" : "creators are"} listed
              below under “needs review” with the reason. Nothing was substituted.
            </span>
          ) : null}
        </p>
      ) : null}
      {hasSlateSplit ? (
        <div className="flex flex-wrap items-baseline gap-2 rounded-xl border border-[#1D9E75]/25 bg-[#1D9E75]/5 px-3 py-2">
          <span className="text-sm font-extrabold text-[#1D9E75]">
            {selectedVendors.length} Recommended
          </span>
          {/*
            `candidatePoolCount` is selected + everything else Discovery
            returned. It is not a recommendation count — `recommendationCount`
            keeps that meaning — so it is not labelled as one.
          */}
          <span className="text-sm text-muted-foreground">
            of {slateSplit.candidatePoolCount} creators available
          </span>
          {otherRecommendedVendors.length > 0 ? (
            <span className="text-[11px] text-muted-foreground">
              · {otherRecommendedVendors.length} more from Discovery, available as
              replacements
              {candidateSummary.flagged > 0
                ? ` (${candidateSummary.flagged} flagged)`
                : ""}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <p className="text-[11px] text-muted-foreground">
          {/*
            `marketVendors` is the whole hydrated pool that passes the campaign's
            requirements — the slate PLUS Discovery's alternatives. Labelling it
            "recommended creators" put a second, larger recommendation count on
            the same screen as the real one ("N Recommended" above), which is
            how this screen appeared to claim ten recommended creators while the
            slate, Content and the Package footer all had six.
          */}
          {marketVendors.length} creator{marketVendors.length === 1 ? "" : "s"} hydrated
          {marketLabel ? ` in ${marketLabel}` : ""}
          {excludedByMarket > 0 ? (
            <span>
              {" "}
              · {excludedByMarket} outside this market hidden
            </span>
          ) : null}
          {preferredPlatformLabel ? (
            <span className="text-foreground/80">
              {" "}
              · Brief platform: {preferredPlatformLabel}
            </span>
          ) : null}
          {hydrationPhase < 3 ? (
            <span className="inline-flex items-center gap-1 text-foreground/70">
              {" · "}
              <Loader2Icon className="size-3 animate-spin" aria-hidden />
              Resolving creator signals…
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {recommendationIds.length > 0 ? (
            <p className="text-[10px] text-muted-foreground">
              Ranked from {recommendationIds.length} search matches
            </p>
          ) : null}
          {marketVendors.length >= 2 ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-[#7C3AED]/40 bg-[#7C3AED]/5 px-2 py-1 text-[10px] font-semibold text-[#7C3AED] hover:bg-[#7C3AED]/10"
              onClick={() => setCompareOpen(true)}
            >
              <Columns2Icon className="size-3" />
              Compare
            </button>
          ) : null}
          {canAct ? (
            <>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-[#0057FF]/40 bg-[#0057FF]/5 px-2 py-1 text-[10px] font-semibold text-[#0057FF] hover:bg-[#0057FF]/10"
                onClick={() => setShortlistPickerMode("replace")}
              >
                <ListRestartIcon className="size-3" />
                Replace with shortlist
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-muted/50"
                onClick={() => setShortlistPickerMode("merge")}
              >
                <GitMergeIcon className="size-3" />
                Merge shortlist
              </button>
            </>
          ) : null}
        </div>
      </div>
      {(slateIntelligence?.tierShortages.length ?? 0) > 0 ? (
        <div className="space-y-1 rounded-lg border border-amber-300/80 bg-amber-50/80 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-[10px] font-bold tracking-wide text-amber-900 uppercase dark:text-amber-200">
            Strategy validation
          </p>
          {slateIntelligence!.tierShortages.map((warning) => (
            <p key={warning.tier} className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
              {warning.message}
            </p>
          ))}
        </div>
      ) : null}
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
      {visibleGroupItems.map((group) => (
        <div
          key={group.title ?? "all"}
          className={refMode ? STUDIO_REF_CLASSES.vendorList : STUDIO_CLASSES.vendorList}
        >
          {group.title ? (
            <p className="px-0.5 text-[10px] font-extrabold tracking-wide text-muted-foreground uppercase">
              {group.title}
            </p>
          ) : null}
          {group.items.map((vendor, index) => (
            <VendorCardBlock
              key={vendor.id ?? `${vendor.handle}-${index}`}
              vendor={vendor}
              index={index}
              campaignObject={campaignObject}
              canAct={canAct}
              pendingCreatorId={pendingCreatorId}
              vendorDecisions={previewVendorDecisions}
              draft={draft}
              stageRemoval={stageRemoval}
              undoDraftChange={undoDraftChange}
              applyDecision={applyDecision}
              stageRoleChange={stageRoleChange}
              openCreatorDetails={openCreatorDetails}
              group={group.kind}
              onReplace={
                conversationId &&
                messageId &&
                vendor.id &&
                selectedKeys.has(creatorGroupingKey(vendor.id))
                  ? () =>
                      setReplaceTarget({
                        creatorId: vendor.id!,
                        displayName: vendor.displayName,
                      })
                  : undefined
              }
              observeCreator={observeCreator}
            />
          ))}
        </div>
      ))}
      {hiddenCount > 0 && !showAllVendors ? (
        <ShowMoreButton onClick={() => setShowAllVendors(true)}>
          + {hiddenCount} more · Show all {displayedTotal}
        </ShowMoreButton>
      ) : null}
      <CampaignAnalysisPanel campaignObject={campaignObject} />
      {conversationId && messageId ? (
        <AddCreatorPanel
          conversationId={conversationId}
          messageId={messageId}
          draft={draft}
          onDraftUpdated={publishDraft}
          replaceTarget={replaceTarget}
          candidateShortage={replacementShortage}
          candidates={replacementCandidates}
          browseFilters={campaignBrowseFilters}
          onSelectionStaged={({ undoCreatorId, displayName }) => {
            setReplaceTarget(null);
            // Undo reuses the existing unstage path, so it restores the exact
            // pre-replacement state rather than tracking its own history.
            toast.success(
              displayName ? `${displayName} replaced` : "Creator replaced",
              {
                action: {
                  label: "Undo",
                  onClick: () => void undoDraftChange(undoCreatorId),
                },
              }
            );
          }}
        />
      ) : null}
      {conversationId && messageId && shortlistPickerMode ? (
        <ShortlistSlatePickerDialog
          open={shortlistPickerMode != null}
          onOpenChange={(open) => {
            if (!open) setShortlistPickerMode(null);
          }}
          mode={shortlistPickerMode}
          conversationId={conversationId}
          messageId={messageId}
          onApplied={({ linkedShortlistId: nextShortlistId, draft: nextDraft }) => {
            if (nextShortlistId) setLinkedShortlistId(nextShortlistId);
            if (nextDraft) publishDraft(nextDraft);
          }}
        />
      ) : null}
      {!onCreatorClick ? (
        <StudioCreatorDetailHost
          selection={drawerCreator}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          signal={
            drawerCreator?.id
              ? vendors.find((v) => v.id === drawerCreator.id)?.planningSignal
              : undefined
          }
        />
      ) : null}
      <StudioCreatorCompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        creators={marketVendors.flatMap((vendor) =>
          vendor.id
            ? [
                {
                  id: vendor.id,
                  displayName: vendor.displayName,
                  handle: vendor.handle,
                  platform: vendor.platform,
                },
              ]
            : []
        )}
        onOpenCreator={(unifiedId) => {
          const match = marketVendors.find((v) => v.id === unifiedId);
          if (match) openCreatorDetails(match);
        }}
      />
    </div>
  );
}
