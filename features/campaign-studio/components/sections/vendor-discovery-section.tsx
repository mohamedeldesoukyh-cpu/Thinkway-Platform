"use client";

import { SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { SectionSkeleton } from "./shared/section-skeleton";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { resolveVendorDiscovery, resolveCreatorCounts } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type VendorDiscoverySectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

function formatPipelineCount(count: number): string {
  return count > 0 ? count.toLocaleString() : "—";
}

export function VendorDiscoverySection({
  campaignObject,
  status,
}: VendorDiscoverySectionProps) {
  const isRunning = status === "running";
  const discovery = resolveVendorDiscovery(campaignObject, isRunning);
  const { discoveryIds, recommendationCount } = resolveCreatorCounts(campaignObject);
  const hasCandidates =
    discovery.total > 0 || discoveryIds.length > 0 || recommendationCount > 0;

  if (isRunning && !hasCandidates && !discovery.phase) {
    return <SectionSkeleton variant="pipeline" />;
  }

  const screenedLabel =
    discovery.profilesScreened != null && discovery.profilesScreened > 0
      ? discovery.profilesScreened.toLocaleString()
      : formatPipelineCount(
          discovery.pipeline.find((s) => s.id === "screened")?.count ??
            discovery.pipeline.find((s) => s.id === "database")?.count ??
            discovery.pipeline.find((s) => s.id === "db")?.count ??
            0
        );

  const finalLabel =
    discovery.total > 0
      ? discovery.total.toLocaleString()
      : recommendationCount > 0
        ? recommendationCount.toLocaleString()
        : "—";

  const summaryText =
    discovery.total > 0 && screenedLabel !== "—"
      ? `${finalLabel} final candidates from ${screenedLabel} profiles screened`
      : discovery.total > 0
        ? `${finalLabel} recommended creators`
        : null;

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {discovery.pipeline.map((stage, index) => (
          <div key={stage.id} className="flex min-w-0 items-center gap-2">
            <div className={STUDIO_CLASSES.funnelStep}>
              <span>{stage.label}</span>
              <b className="font-mono">{formatPipelineCount(stage.count)}</b>
            </div>
            {index < discovery.pipeline.length - 1 ? (
              <span className="shrink-0 text-[#B9C2D9]">→</span>
            ) : null}
          </div>
        ))}
      </div>

      {summaryText ? (
        <div className={STUDIO_CLASSES.funnelResult}>{summaryText}</div>
      ) : status === "pending" ? (
        <div className="rounded-xl border border-dashed border-[#0B0F1A]/8 bg-[#F5F8FF]/50 px-4 py-5 text-center dark:border-border">
          <SearchIcon className="mx-auto mb-2 size-5 text-[#6B7280]/60" />
          <p className="text-sm font-bold text-foreground">Discovery pipeline ready</p>
          <p className="mt-1 text-xs text-[#6B7280]">
            Run live discovery to populate vendor candidates
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-3 bg-[#0C9D57] hover:bg-[#0a8a4c]"
          >
            Run Live Discovery
          </Button>
        </div>
      ) : null}
    </div>
  );
}
