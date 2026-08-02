"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  FileTextIcon,
  LinkIcon,
  MessageSquareWarningIcon,
  PresentationIcon,
  SendIcon,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { serializeCampaignObject } from "@/features/campaign-intelligence";
import {
  approveCampaignPlanAction,
  getCampaignPlanApprovalContext,
  requestCampaignPlanChangesAction,
  submitCampaignPlanForReviewAction,
  type CampaignPlanApprovalContext,
} from "@/features/campaign-plan/actions/campaign-plan-approval";
import { CampaignPlanReadinessChecklist } from "@/features/campaign-plan/components/campaign-plan-readiness-checklist";
import { GenerateCampaignLauncher } from "@/features/campaign-plan/components/generate-campaign-launcher";

import { buildProposalExportHref } from "../campaign-proposal-export-actions";
import { openCampaignProposalPreview } from "../../export/campaign-proposal-preview";
import { useCreatorHydration } from "../../hooks/use-creator-hydration";
import {
  formatExecutiveProposalCreatorBlock,
  toCampaignDecisionLabel,
} from "../../services/eci/executive-planning-view";
import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { PsBox } from "./shared/studio-ui-primitives";
import { STUDIO_REF_CLASSES } from "../../constants/campaign-studio-ref-tokens";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { useStudioRefMode } from "../../hooks/use-studio-ref-mode";
import {
  resolveCreatorIds,
  resolvePresentationData,
} from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type PresentationStatusSectionProps = {
  campaignObject?: CampaignObject;
  campaignObjectId?: string;
  conversationId?: string;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

const PRESENTATION_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready: "Ready",
  awaiting_approval: "Awaiting Approval",
  approved: "Approved",
};

export function PresentationStatusSection({
  campaignObject,
  campaignObjectId,
  conversationId,
  fallbackText,
  status,
}: PresentationStatusSectionProps) {
  const refMode = useStudioRefMode();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [approvalContext, setApprovalContext] = useState<CampaignPlanApprovalContext | null>(
    null
  );
  const [loadingContext, setLoadingContext] = useState(Boolean(campaignObjectId));

  const isRunning = status === "running";
  const presentation = resolvePresentationData(campaignObject);
  const { ids } = resolveCreatorIds(campaignObject);
  const { vendors: hydrated } = useCreatorHydration(ids);

  const resolvedCampaignObjectId = campaignObjectId ?? campaignObject?.id;

  useEffect(() => {
    if (!resolvedCampaignObjectId) {
      setLoadingContext(false);
      return;
    }

    let cancelled = false;
    setLoadingContext(true);
    void getCampaignPlanApprovalContext({
      campaignObjectId: resolvedCampaignObjectId,
      conversationId,
      campaignObject,
    }).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setApprovalContext(null);
      } else {
        setApprovalContext(result);
      }
      setLoadingContext(false);
    });

    return () => {
      cancelled = true;
    };
  }, [resolvedCampaignObjectId, conversationId, campaignObject]);

  const exportVendors = useMemo(
    () =>
      hydrated.map((v) => {
        const signal = v.planningSignal;
        if (!signal) {
          return {
            displayName: v.displayName,
            handle: v.handle,
            platform: v.platform,
            followers: v.followers,
            engagementRate: v.engagementRate,
            tier: v.tier,
            reason: v.reason,
          };
        }
        const block = formatExecutiveProposalCreatorBlock(signal, v.displayName);
        const step = (key: string) =>
          block.steps.find((s) => s.key === key)?.body ?? "Insufficient evidence available.";
        return {
          displayName: v.displayName,
          handle: v.handle,
          platform: v.platform,
          followers: v.followers,
          engagementRate: v.engagementRate,
          tier: v.tier,
          reason: block.narrative,
          investmentRecommendation: toCampaignDecisionLabel(signal.recommendation),
          recommendationText: step("recommendation"),
          whyText: step("why"),
          evidenceSummary: step("evidence"),
          businessValue: step("businessValue"),
          commercialJustification: step("commercialValue"),
          riskNote: step("risk"),
          alternativeNote: block.alternativeConsidered,
          whyAlternativeNotSelected: block.reasonAlternativeNotSelected,
          tradeOffs: block.tradeOffs,
          decisionImpact: block.decisionImpact,
          confidenceNote: block.confidence,
        };
      }),
    [hydrated]
  );

  function handleExportPdf() {
    if (!campaignObject) {
      toast.error("Campaign data not ready for export.");
      return;
    }
    openCampaignProposalPreview(campaignObject, exportVendors);
    toast.success("Client proposal opened — use Print → Save as PDF.");
  }

  function handleExportPpt() {
    if (!resolvedCampaignObjectId) {
      toast.error("Campaign data not ready for export.");
      return;
    }
    window.location.href = buildProposalExportHref(
      resolvedCampaignObjectId,
      "pptx",
      conversationId
    );
  }

  async function handleCopyStudioLink() {
    try {
      const url =
        typeof window !== "undefined"
          ? window.location.href
          : conversationId
            ? `/ai/${conversationId}`
            : "";
      if (!url) {
        toast.error("Studio link is not available.");
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Studio link copied.");
    } catch {
      toast.error("Could not copy Studio link.");
    }
  }

  function runApprovalAction(
    action: "submit" | "approve" | "request_changes",
    options?: { message?: string }
  ) {
    if (!campaignObject || !resolvedCampaignObjectId) {
      toast.error("Campaign Plan data is not ready.");
      return;
    }

    startTransition(async () => {
      const payload = {
        campaignObjectId: resolvedCampaignObjectId,
        conversationId,
        campaignObject: serializeCampaignObject(campaignObject) as Record<string, unknown>,
      };

      const result =
        action === "submit"
          ? await submitCampaignPlanForReviewAction(payload)
          : action === "approve"
            ? await approveCampaignPlanAction(payload)
            : await requestCampaignPlanChangesAction({
                ...payload,
                message: options?.message,
              });

      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  if (isRunning && !presentation) {
    return <SectionSkeleton variant="cards" />;
  }

  if (!presentation) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Presentation status pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  const lifecycleLabel = approvalContext?.lifecycleLabel ?? "—";
  const presentationStatus =
    approvalContext?.presentationStatus ?? presentation.status;
  const approvalLabel =
    PRESENTATION_STATUS_LABELS[presentationStatus] ?? presentationStatus;
  const isApproved =
    approvalContext?.lifecycleStatus === "approved" ||
    approvalContext?.lifecycleStatus === "published";

  const readinessChecks = approvalContext?.readiness
    ? ["Budget", "Creator Slate", "Strategy", "Timeline", "Media Plan"].map((label) => {
        const item = approvalContext.readiness.mandatory.find(
          (entry) => entry.label.toLowerCase() === label.toLowerCase()
        );
        return { label, satisfied: item?.satisfied ?? false };
      })
    : [];

  const actionButtons = (
    <>
      {approvalContext?.canSubmitForReview ? (
        <button
          type="button"
          className={refMode ? cn(STUDIO_REF_CLASSES.btn, STUDIO_REF_CLASSES.btnPrimary) : STUDIO_CLASSES.actBtn}
          disabled={pending}
          onClick={() => runApprovalAction("submit")}
        >
          <SendIcon className="size-3" aria-hidden />
          Submit for Review
        </button>
      ) : null}
      {approvalContext?.canApprove ? (
        <button
          type="button"
          className={refMode ? STUDIO_REF_CLASSES.btn : STUDIO_CLASSES.actBtnApprove}
          disabled={pending}
          onClick={() => runApprovalAction("approve")}
        >
          <CheckIcon className="size-3" aria-hidden />
          Approve
        </button>
      ) : null}
      {approvalContext?.canRequestChanges ? (
        <button
          type="button"
          className={refMode ? STUDIO_REF_CLASSES.btn : STUDIO_CLASSES.actBtn}
          disabled={pending}
          onClick={() => runApprovalAction("request_changes")}
        >
          <MessageSquareWarningIcon className="size-3" aria-hidden />
          Request Changes
        </button>
      ) : null}
      <button
        type="button"
        className={refMode ? STUDIO_REF_CLASSES.btn : STUDIO_CLASSES.actBtn}
        onClick={handleExportPdf}
      >
        <FileTextIcon className="size-3" aria-hidden />
        Export PDF
      </button>
      <button
        type="button"
        className={refMode ? STUDIO_REF_CLASSES.btn : STUDIO_CLASSES.actBtn}
        onClick={handleExportPpt}
        disabled={!resolvedCampaignObjectId}
      >
        <PresentationIcon className="size-3" aria-hidden />
        Export PPT
      </button>
      <button
        type="button"
        className={refMode ? STUDIO_REF_CLASSES.btn : STUDIO_CLASSES.actBtn}
        onClick={() => void handleCopyStudioLink()}
      >
        <LinkIcon className="size-3" aria-hidden />
        Copy link
      </button>
    </>
  );

  if (refMode) {
    return (
      <div className="min-w-0">
        <div className={STUDIO_REF_CLASSES.readinessHead}>
          <div>
            <div className={STUDIO_REF_CLASSES.readinessTitle}>Campaign Plan Readiness</div>
            <div className={STUDIO_REF_CLASSES.readinessSub}>
              Mandatory planning items — not a section completion percentage
            </div>
          </div>
          <span className={STUDIO_REF_CLASSES.readyBadge}>
            {approvalContext?.readiness?.statusLabel ?? "Ready for review"}
          </span>
        </div>

        {readinessChecks.length > 0 ? (
          <div className={STUDIO_REF_CLASSES.checkRowList}>
            {readinessChecks.map((item) => (
              <span key={item.label} className={STUDIO_REF_CLASSES.checkOk}>
                <CheckIcon aria-hidden />
                {item.label}
              </span>
            ))}
          </div>
        ) : null}

        {approvalContext?.readiness?.optionalRemaining ? (
          <div className={STUDIO_REF_CLASSES.remainingNote}>
            {approvalContext.readiness.optionalRemaining} optional recommendation
            {approvalContext.readiness.optionalRemaining === 1 ? "" : "s"} remaining
          </div>
        ) : null}

        <div className={STUDIO_REF_CLASSES.statusMetaGrid}>
          <PsBox label="Version" value={`v${approvalContext?.currentVersion ?? 0}`} />
          <PsBox label="Lifecycle" value={lifecycleLabel} />
          <PsBox label="Presentation" value={approvalLabel} />
          <PsBox label="Status" value={approvalContext?.readiness.statusLabel ?? "—"} />
          <PsBox
            label="Client approval"
            value={isApproved ? "Approved" : "Pending review"}
          />
          <PsBox
            label="Director review"
            value={
              approvalContext?.lifecycleStatus === "in_review"
                ? "Awaiting sign-off"
                : isApproved
                  ? "Signed off"
                  : "Not submitted"
            }
          />
        </div>

        <div className={STUDIO_REF_CLASSES.signoffActions}>{actionButtons}</div>

        {campaignObject ? (
          <div className="mt-3">
            <GenerateCampaignLauncher
              campaignObject={campaignObject}
              conversationId={conversationId}
              variant="compact"
            />
          </div>
        ) : null}

        {loadingContext ? (
          <p className={STUDIO_REF_CLASSES.remainingNote}>Loading approval status…</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {approvalContext?.readiness ? (
        <CampaignPlanReadinessChecklist readiness={approvalContext.readiness} />
      ) : null}

      <div className={STUDIO_CLASSES.psGrid}>
        <PsBox label="Version" value={`v${approvalContext?.currentVersion ?? 0}`} />
        <PsBox label="Lifecycle" value={lifecycleLabel} />
        <PsBox label="Presentation" value={approvalLabel} />
        <PsBox label="Status" value={approvalContext?.readiness.statusLabel ?? "—"} />
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <PsBox
          label="Client Approval"
          value={isApproved ? "Approved" : "Pending review"}
        />
        <PsBox
          label="Director Review"
          value={
            approvalContext?.lifecycleStatus === "in_review"
              ? "Awaiting sign-off"
              : isApproved
                ? "Signed off"
                : "Not submitted"
          }
        />
      </div>

      {approvalContext?.lifecycleStatus === "in_review" ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">
          Campaign Plan is awaiting Campaign Director review. Quotation and execution
          generation unlock after approval.
        </p>
      ) : null}

      {approvalContext?.lifecycleStatus === "draft" &&
      approvalContext.readiness.status === "not_ready" ? (
        <p className="text-[11px] text-muted-foreground">
          Complete all mandatory readiness items before submitting for director review.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        {actionButtons}
      </div>

      {campaignObject ? (
        <GenerateCampaignLauncher
          campaignObject={campaignObject}
          conversationId={conversationId}
          variant="compact"
        />
      ) : null}

      {loadingContext ? (
        <p className="text-[10px] text-muted-foreground">Loading approval status…</p>
      ) : null}
    </div>
  );
}
