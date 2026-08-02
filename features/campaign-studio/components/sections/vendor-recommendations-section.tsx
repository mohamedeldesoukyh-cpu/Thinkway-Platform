"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  CheckIcon,
  Columns2Icon,
  GitMergeIcon,
  ListRestartIcon,
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
import { buildCreatorContentIdea } from "../../services/creator-slate";
import {
  getCampaignFacts,
  resolveInfluencerEstimateCurrency,
} from "@/features/campaign-director/facts/facts-display-bridge";
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
import { StudioPlanningCreatorDetail } from "./studio-planning-creator-detail";
import { StudioPlanningIntelligenceStrip } from "./shared/studio-planning-intelligence-strip";
import { deriveEnterprisePlanningNarrative } from "../../services/planning-narrative";

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
      rationale:
        vendor.planningSignal?.why ||
        (vendor.reason && !isEmptyGlobalRationale(vendor.reason) ? vendor.reason : undefined),
    },
    campaignObject,
    index
  );

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
        key={vendor.id ?? `${vendor.handle}-${index}`}
        className={cn(STUDIO_REF_CLASSES.vendorCard, pendingRemoval && "opacity-75")}
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
          <b>Why:</b> {vendor.planningSignal?.why ?? grounding.whySelected}
          {vendor.contentIdea ? (
            <>
              <br />
              <span style={{ color: "var(--cs-blue-text)" }}>{vendor.contentIdea}</span>
            </>
          ) : null}
        </div>

        <StudioPlanningIntelligenceStrip signal={vendor.planningSignal} />

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
      key={vendor.id ?? `${vendor.handle}-${index}`}
      className={pendingRemoval ? "mb-2.5 opacity-75" : "mb-2.5"}
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
          <b>Why:</b> {vendor.planningSignal?.why ?? grounding.whySelected}
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

        <StudioPlanningIntelligenceStrip signal={vendor.planningSignal} />

        {vendor.confidence != null || vendor.eciConfidencePercent != null ? (
          <p className="mt-1 text-[10px] text-muted-foreground">
            Confidence:{" "}
            {Math.round(
              vendor.eciConfidencePercent ??
                (vendor.confidence != null ? vendor.confidence * 100 : 0)
            )}
            %
          </p>
        ) : null}

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
  const [compareOpen, setCompareOpen] = useState(false);
  const confirmDelete = useConfirmDelete();

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
  const {
    ids: persistedIds,
    rationale,
    avgFitScore,
    creatorFitScores,
  } = resolveCreatorIds(campaignObject, { recommendationsOnly: true });
  const previewIds = previewCreatorsData.recommendations?.creatorIds ?? [];
  const usingDraftPreview = draft.changes.length > 0 && previewIds.length > 0;
  const ids = usingDraftPreview ? previewIds : persistedIds;
  const safeRationale = isEmptyGlobalRationale(rationale) ? undefined : rationale;
  const { recommendationIds } = resolveCreatorCounts(campaignObject);
  const hasCommittedRecommendations = recommendationIds.length > 0;
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
              .map((v, i) =>
                attachSlateMeta({
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
                  eciRecommendation: v.eciRecommendation,
                  eciConfidencePercent: v.eciConfidencePercent,
                  planningSignal: v.planningSignal,
                  contentIdea: buildCreatorContentIdea(
                    { categories: [v.audienceSummary ?? ""] },
                    campaignFacts,
                    i
                  ),
                })
              ),
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
    [hydrated, parsedVendors, previewVendorDecisions, campaignFacts, removedIdSet, attachSlateMeta, usingDraftPreview]
  );

  const mainVendors = vendors.filter((v) => v.slateRole !== "maybe");
  const maybeVendors = vendors.filter((v) => v.slateRole === "maybe");
  const displayGroups =
    maybeVendors.length > 0
      ? [
          { title: "Main picks", items: mainVendors.length > 0 ? mainVendors : vendors },
          { title: "Maybe / replacements", items: maybeVendors },
        ]
      : [{ title: null as string | null, items: vendors }];

  const visibleGroupItems = showAllVendors
    ? displayGroups
    : displayGroups.map((group) => ({
        ...group,
        items: group.items.slice(0, STUDIO_VENDOR_INITIAL_VISIBLE),
      }));
  const hiddenCount = Math.max(0, vendors.length - STUDIO_VENDOR_INITIAL_VISIBLE);
  const preferredPlatformLabel = mapperOptions.preferredPlatforms?.length
    ? mapperOptions.preferredPlatforms.join(" + ")
    : undefined;
  const discoveryEngine = creatorsData.discoveryEngine;
  const fitScoreCount =
    creatorsData.fitScoreCount ??
    (creatorFitScores ? Object.keys(creatorFitScores).length : 0);

  if ((isRunning || loading || isRegeneratingProposal) && vendors.length === 0 && (hasCommittedRecommendations || usingDraftPreview)) {
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
        <div className="flex flex-wrap items-center gap-2">
          {recommendationIds.length > 0 ? (
            <p className="text-[10px] text-muted-foreground">
              Ranked from {recommendationIds.length} search matches
            </p>
          ) : null}
          {vendors.length >= 2 ? (
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
        <div key={group.title ?? "all"} className="space-y-2">
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
            />
          ))}
        </div>
      ))}
      {hiddenCount > 0 && !showAllVendors ? (
        <ShowMoreButton onClick={() => setShowAllVendors(true)}>
          + {hiddenCount} more recommended creators · Show all {vendors.length}
        </ShowMoreButton>
      ) : null}
      {conversationId && messageId ? (
        <AddCreatorPanel
          conversationId={conversationId}
          messageId={messageId}
          draft={draft}
          onDraftUpdated={publishDraft}
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
        <StudioPlanningCreatorDetail
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
        creators={vendors
          .filter((v): v is DisplayVendor & { id: string } => Boolean(v.id))
          .map((v) => ({
            id: v.id,
            displayName: v.displayName,
            handle: v.handle,
            platform: v.platform,
          }))}
        onOpenCreator={(unifiedId) => {
          const match = vendors.find((v) => v.id === unifiedId);
          if (match) openCreatorDetails(match);
        }}
      />
    </div>
  );
}
