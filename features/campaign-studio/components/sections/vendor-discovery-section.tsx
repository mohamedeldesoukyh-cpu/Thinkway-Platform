"use client";

import {
  CheckCircle2Icon,
  CircleIcon,
  Loader2Icon,
  SearchIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { SectionSkeleton } from "./shared/section-skeleton";
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
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {discovery.pipeline.map((stage, index) => (
          <div key={stage.id} className="flex min-w-0 items-center gap-1.5">
            <div
              className={cn(
                "flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all duration-300",
                stage.status === "complete" &&
                  "border-[#1D9E75]/40 bg-[#1D9E75]/10 text-[#1D9E75]",
                stage.status === "active" &&
                  "border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
                stage.status === "pending" && "border-border/60 bg-muted/30 text-muted-foreground"
              )}
            >
              {stage.status === "complete" ? (
                <CheckCircle2Icon className="size-3 shrink-0" />
              ) : stage.status === "active" ? (
                <Loader2Icon className="size-3 shrink-0 animate-spin" />
              ) : (
                <CircleIcon className="size-3 shrink-0" />
              )}
              <span className="break-words">{stage.label}</span>
              <span className="ml-0.5 shrink-0 rounded-full bg-background/60 px-1.5 text-[9px]">
                {formatPipelineCount(stage.count)}
              </span>
            </div>
            {index < discovery.pipeline.length - 1 ? (
              <span className="shrink-0 text-muted-foreground/40">→</span>
            ) : null}
          </div>
        ))}
      </div>

      {summaryText ? (
        <div className="min-w-0 rounded-xl border border-[#1D9E75]/30 bg-[#1D9E75]/5 px-4 py-3">
          <p className="break-words text-sm font-semibold text-[#1D9E75] [overflow-wrap:anywhere]">
            {summaryText}
          </p>
        </div>
      ) : status === "pending" ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-center">
          <SearchIcon className="mx-auto mb-2 size-5 text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground">Discovery pipeline ready</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Run live discovery to populate vendor candidates
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-3 bg-[#1D9E75] hover:bg-[#178f69]"
          >
            Run Live Discovery
          </Button>
        </div>
      ) : null}
    </div>
  );
}
