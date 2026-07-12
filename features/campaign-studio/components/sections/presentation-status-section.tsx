"use client";

import { useMemo } from "react";
import {
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  MessageSquareWarningIcon,
  PresentationIcon,
  ShareIcon,
} from "lucide-react";
import { toast } from "sonner";

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
  resolvePresentationCompletion,
  resolvePresentationData,
} from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type PresentationStatusSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready: "Ready",
  awaiting_approval: "Awaiting Approval",
  approved: "Approved",
};

export function PresentationStatusSection({
  campaignObject,
  fallbackText,
  status,
}: PresentationStatusSectionProps) {
  const isRunning = status === "running";
  const presentation = resolvePresentationData(campaignObject);
  const completion = resolvePresentationCompletion(campaignObject);
  const { ids } = resolveCreatorIds(campaignObject);
  const { vendors: hydrated } = useCreatorHydration(ids);

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

  if (isRunning && !presentation) {
    return <SectionSkeleton variant="cards" />;
  }

  if (!presentation) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Presentation status pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  const approvalLabel = STATUS_LABELS[presentation.status] ?? presentation.status;

  return (
    <div className="space-y-3.5">
      <div className={STUDIO_CLASSES.psGrid}>
        <PsBox label="Version" value={completion.version} />
        <PsBox label="Completion" value={`${completion.completionPercent}%`} />
        <PsBox
          label="Sections"
          value={`${completion.sectionsComplete} / ${completion.totalSections}`}
        />
        <PsBox label="Approval" value={approvalLabel} />
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <PsBox
          label="Client Approval"
          value={presentation.status === "approved" ? "Approved" : "Pending review"}
        />
        <PsBox
          label="Internal Approval"
          value={
            presentation.status === "ready" || presentation.status === "approved"
              ? "Signed off"
              : "In progress"
          }
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" className={STUDIO_CLASSES.actBtnApprove}>
          <CheckIcon className="size-3" aria-hidden />
          Approve
        </button>
        <button type="button" className={STUDIO_CLASSES.actBtn}>
          <MessageSquareWarningIcon className="size-3" aria-hidden />
          Request Changes
        </button>
        <button type="button" className={STUDIO_CLASSES.actBtn} onClick={handleExportPdf}>
          <FileTextIcon className="size-3" aria-hidden />
          Export PDF
        </button>
        <button type="button" className={STUDIO_CLASSES.actBtn}>
          <PresentationIcon className="size-3" aria-hidden />
          Export PPT
        </button>
        <button type="button" className={STUDIO_CLASSES.actBtn}>
          <ShareIcon className="size-3" aria-hidden />
          Share
        </button>
        <button type="button" className={STUDIO_CLASSES.actBtn}>
          <CopyIcon className="size-3" aria-hidden />
          Duplicate
        </button>
      </div>
    </div>
  );
}
