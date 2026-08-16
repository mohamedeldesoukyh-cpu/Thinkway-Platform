"use client";

import { SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

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
  const { discoveryIds, recommendationCount, profilesScreened } =
    resolveCreatorCounts(campaignObject);
  const sufficiency = resolveStudioDiscoverySufficiency(campaignObject, isRunning);
  const hasCandidates =
    discovery.total > 0 || discoveryIds.length > 0 || recommendationCount > 0;

  if (isRunning && !hasCandidates && !discovery.phase) {
    return <SectionSkeleton variant="pipeline" />;
  }

  const screenedLabel =
    (profilesScreened != null && profilesScreened > 0
      ? profilesScreened.toLocaleString()
      : null) ??
    (discovery.profilesScreened != null && discovery.profilesScreened > 0
      ? discovery.profilesScreened.toLocaleString()
      : formatPipelineCount(
          discovery.pipeline.find((s) => s.id === "screened")?.count ??
            discovery.pipeline.find((s) => s.id === "database")?.count ??
            discovery.pipeline.find((s) => s.id === "db")?.count ??
            0
        ));

  const recommendedLabel =
    recommendationCount > 0
      ? recommendationCount.toLocaleString()
      : discovery.total > 0
        ? discovery.total.toLocaleString()
        : "—";

  const summaryText =
    recommendationCount > 0 && screenedLabel !== "—"
      ? `${recommendedLabel} recommended from ${screenedLabel} profiles screened`
      : discovery.total > 0 && screenedLabel !== "—"
        ? `${recommendedLabel} final candidates from ${screenedLabel} profiles screened`
        : discovery.total > 0
          ? `${recommendedLabel} recommended creators`
          : null;

  return (
    <div className="min-w-0 space-y-3">
      <div className="rounded-xl border border-[#0057FF]/20 bg-[#0057FF]/5 px-3 py-2.5">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#0057FF]">
          {sufficiency.title}
        </p>
        <p className="mt-1 text-[12px] text-foreground">{sufficiency.detail}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Inventory {sufficiency.inventoryCount} · Qualified {sufficiency.qualifiedCount}
          {sufficiency.recommendedQuantity != null
            ? ` · Recommended quantity ${sufficiency.recommendedQuantity}`
            : ""}
          {sufficiency.factsConfirmed ? " · Driven by confirmed Campaign Facts" : ""}
        </p>
        {sufficiency.missingIntelligence.length > 0 ? (
          <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
            Missing intelligence: {sufficiency.missingIntelligence.slice(0, 4).join("; ")}
          </p>
        ) : null}
        <p className="mt-1 text-[11px] font-semibold text-foreground">
          Next: {sufficiency.nextAction}
        </p>
      </div>

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

      {summaryText ? (
        <div className={refMode ? STUDIO_REF_CLASSES.funnelResult : STUDIO_CLASSES.funnelResult}>
          {summaryText}
        </div>
      ) : sufficiency.state === "acquisition_running" ? (
        <p className="text-sm text-muted-foreground">Acquisition in progress…</p>
      ) : (
        <div className="rounded-xl border border-dashed border-[#0B0F1A]/8 bg-[#F5F8FF]/50 px-4 py-5 text-center dark:border-border">
          <SearchIcon className="mx-auto mb-2 size-5 text-[#6B7280]/60" />
          <p className="text-sm font-bold text-foreground">{sufficiency.title}</p>
          <p className="mt-1 text-xs text-[#6B7280]">{sufficiency.nextAction}</p>
          <Button type="button" size="sm" className="mt-3 bg-[#0C9D57] hover:bg-[#0a8a4c]">
            {sufficiency.state === "no_inventory" ? "Broaden Discovery" : "Run Discovery"}
          </Button>
        </div>
      )}
    </div>
  );
}
