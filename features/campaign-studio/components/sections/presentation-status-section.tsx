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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { openCampaignProposalPreview } from "../../export/campaign-proposal-document";
import { useCreatorHydration } from "../../hooks/use-creator-hydration";
import { ExecutiveCard } from "./shared/executive-card";
import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
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
  ready: "Ready for Review",
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
  const updatedAt = campaignObject?.updatedAt;
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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ExecutiveCard label="Version" value={completion.version} accent="neutral" />
        <ExecutiveCard
          label="Completion"
          value={`${completion.completionPercent}%`}
          accent="green"
        />
        <ExecutiveCard
          label="Sections Complete"
          value={`${completion.sectionsComplete} / ${completion.totalSections}`}
          accent="purple"
        />
        <ExecutiveCard
          label="Approval Status"
          value={STATUS_LABELS[presentation.status] ?? presentation.status}
          accent="green"
        />
      </div>

      <Progress value={completion.completionPercent} className="h-2 [&>div]:bg-[#1D9E75]" />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <ExecutiveCard
          label="Client Approval"
          value={presentation.status === "approved" ? "Approved" : "Pending review"}
          accent={presentation.status === "approved" ? "green" : "purple"}
        />
        <ExecutiveCard
          label="Internal Approval"
          value={presentation.status === "ready" || presentation.status === "approved" ? "Signed off" : "In progress"}
          accent="neutral"
        />
        <ExecutiveCard
          label="Campaign"
          value={presentation.campaignName ?? "Draft in progress"}
          accent="green"
        />
        <ExecutiveCard
          label="Last Updated"
          value={
            updatedAt
              ? new Date(updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Just now"
          }
          accent="neutral"
        />
      </div>

      {presentation.brandName ? (
        <Badge variant="outline" className="text-[10px]">
          {presentation.brandName}
        </Badge>
      ) : null}

      <div className="flex flex-wrap gap-1.5 pt-1">
        <Button type="button" size="xs" className="h-7 bg-[#1D9E75] hover:bg-[#178f69]">
          <CheckIcon className="size-3" />
          Approve
        </Button>
        <Button type="button" size="xs" variant="outline" className="h-7">
          <MessageSquareWarningIcon className="size-3" />
          Request Changes
        </Button>
        <Button
          type="button"
          size="xs"
          variant="secondary"
          className="h-7"
          onClick={handleExportPdf}
        >
          <FileTextIcon className="size-3" />
          Export PDF
        </Button>
        <Button type="button" size="xs" variant="secondary" className="h-7">
          <PresentationIcon className="size-3" />
          Export PPT
        </Button>
        <Button type="button" size="xs" variant="secondary" className="h-7">
          <ShareIcon className="size-3" />
          Share
        </Button>
        <Button type="button" size="xs" variant="secondary" className="h-7">
          <CopyIcon className="size-3" />
          Duplicate
        </Button>
      </div>
    </div>
  );
}
