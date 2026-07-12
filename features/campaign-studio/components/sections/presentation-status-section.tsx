"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  MessageSquareWarningIcon,
  PresentationIcon,
  SendIcon,
  ShareIcon,
} from "lucide-react";
import { toast } from "sonner";

import { serializeCampaignObject } from "@/features/campaign-intelligence";
import {
  approveCampaignPlanAction,
  getCampaignPlanApprovalContext,
  requestCampaignPlanChangesAction,
  submitCampaignPlanForReviewAction,
  type CampaignPlanApprovalContext,
} from "@/features/campaign-plan/actions/campaign-plan-approval";
import { CampaignPlanReadinessChecklist } from "@/features/campaign-plan/components/campaign-plan-readiness-checklist";

import { openCampaignProposalPreview } from "../../export/campaign-proposal-preview";
import { useCreatorHydration } from "../../hooks/use-creator-hydration";
import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { PsBox } from "./shared/studio-ui-primitives";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
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
      hydrated.map((v) => ({
        displayName: v.displayName,
        handle: v.handle,
        platform: v.platform,
        followers: v.followers,
        engagementRate: v.engagementRate,
        reason: v.reason,
      })),
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
        {approvalContext?.canSubmitForReview ? (
          <button
            type="button"
            className={STUDIO_CLASSES.actBtn}
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
            className={STUDIO_CLASSES.actBtnApprove}
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
            className={STUDIO_CLASSES.actBtn}
            disabled={pending}
            onClick={() => runApprovalAction("request_changes")}
          >
            <MessageSquareWarningIcon className="size-3" aria-hidden />
            Request Changes
          </button>
        ) : null}
        <button type="button" className={STUDIO_CLASSES.actBtn} onClick={handleExportPdf}>
          <FileTextIcon className="size-3" aria-hidden />
          Export PDF
        </button>
        <button type="button" className={STUDIO_CLASSES.actBtn} disabled>
          <PresentationIcon className="size-3" aria-hidden />
          Export PPT
        </button>
        <button type="button" className={STUDIO_CLASSES.actBtn} disabled>
          <ShareIcon className="size-3" aria-hidden />
          Share
        </button>
        <button type="button" className={STUDIO_CLASSES.actBtn} disabled>
          <CopyIcon className="size-3" aria-hidden />
          Duplicate
        </button>
      </div>

      {loadingContext ? (
        <p className="text-[10px] text-muted-foreground">Loading approval status…</p>
      ) : null}
    </div>
  );
}
