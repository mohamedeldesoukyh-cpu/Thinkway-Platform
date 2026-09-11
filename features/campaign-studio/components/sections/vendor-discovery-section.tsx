"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import { STUDIO_REF_CLASSES } from "../../constants/campaign-studio-ref-tokens";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { useStudioRefMode } from "../../hooks/use-studio-ref-mode";
import { resolveVendorDiscovery, resolveCreatorCounts } from "../../services/section-data-resolver";
import { resolveStudioDiscoverySufficiency } from "../../services/studio-discovery-sufficiency";
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
  const refMode = useStudioRefMode();
  const isRunning = status === "running";
  const discovery = resolveVendorDiscovery(campaignObject, isRunning);
  const { discoveryIds, recommendationCount } = resolveCreatorCounts(campaignObject);
  const sufficiency = resolveStudioDiscoverySufficiency(campaignObject, isRunning);
  const hasCandidates =
    discovery.total > 0 || discoveryIds.length > 0 || recommendationCount > 0;

  if (isRunning && !hasCandidates && !discovery.phase) {
    return <SectionSkeleton variant="pipeline" />;
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="rounded-xl border border-[#0057FF]/20 bg-[#0057FF]/5 px-3 py-2.5">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#0057FF]">
          {sufficiency.title}
        </p>
        {/*
          The single Discovery explanation on the Creators screen.
          The header block above carries the numbers — required, on slate,
          short, and this state — so the "Inventory N · Qualified N ·
          Recommended quantity N" line that used to sit here repeated all three
          of them one block later.
        */}
        <p className="mt-1 text-[12px] text-foreground">{sufficiency.detail}</p>
        {sufficiency.missingIntelligence.length > 0 ? (
          <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
            Missing intelligence: {sufficiency.missingIntelligence.slice(0, 4).join("; ")}
          </p>
        ) : null}
        <p className="mt-1 text-[11px] font-semibold text-foreground">
          Next: {sufficiency.nextAction}
        </p>
      </div>

      {/*
        The pipeline is the compact Discovery status: screened → qualified →
        recommended, once. It replaces the "N recommended from M profiles
        screened" strip that used to restate its first and last chip directly
        underneath it, and the dashed empty panel that restated the card above.
        With nothing searched there are no counts to show, and the card above is
        the whole story.
      */}
      {hasCandidates ? (
      <div className={refMode ? STUDIO_REF_CLASSES.funnelRow : "flex min-w-0 flex-wrap items-center gap-2"}>
        {discovery.pipeline.map((stage, index) => (
          <div key={stage.id} className={refMode ? "contents" : "flex min-w-0 items-center gap-2"}>
            <div className={refMode ? STUDIO_REF_CLASSES.funnelStep : STUDIO_CLASSES.funnelStep}>
              <span>{stage.label}</span>
              <b className={refMode ? undefined : "font-mono"}>{formatPipelineCount(stage.count)}</b>
            </div>
            {index < discovery.pipeline.length - 1 ? (
              <span className={refMode ? STUDIO_REF_CLASSES.funnelArrow : "shrink-0 text-[#B9C2D9]"}>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>
      ) : sufficiency.state === "acquisition_running" ? (
        <p className="text-sm text-muted-foreground">Acquisition in progress…</p>
      ) : null}
    </div>
  );
}
