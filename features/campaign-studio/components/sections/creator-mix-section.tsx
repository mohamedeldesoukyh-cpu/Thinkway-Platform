"use client";

import { Progress } from "@/components/ui/progress";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { PAIR_STRATEGY_CARD } from "../../constants/studio-layout";
import { resolveCreatorMix, type CreatorMixTier } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";
import { cn } from "@/lib/utils";

const TIER_COLORS: Record<string, string> = {
  Nano: "bg-slate-400",
  Micro: "bg-brand-product",
  Mid: "bg-violet-500",
  Macro: "bg-indigo-500",
  Celebrity: "bg-amber-500",
};

const TIER_PROGRESS_CLASS: Record<string, string> = {
  Nano: "mt-2 h-2 [&>div]:bg-slate-400",
  Micro: "mt-2 h-2 [&>div]:bg-brand-product",
  Mid: "mt-2 h-2 [&>div]:bg-violet-500",
  Macro: "mt-2 h-2 [&>div]:bg-indigo-500",
  Celebrity: "mt-2 h-2 [&>div]:bg-amber-500",
};

const TIER_HEX_COLORS: Record<string, string> = {
  Nano: "#94a3b8",
  Micro: "#1D9E75",
  Mid: "#8b5cf6",
  Macro: "#6366f1",
  Celebrity: "#f59e0b",
};

function CreatorMixDoughnutRing({ tiers }: { tiers: CreatorMixTier[] }) {
  const segments = tiers.filter((tier) => tier.percent > 0);
  const totalCreators = tiers.reduce((sum, tier) => sum + tier.count, 0);

  if (segments.length === 0) {
    return (
      <div className="flex size-32 items-center justify-center rounded-full border border-dashed border-border/60 bg-muted/10 sm:size-36">
        <span className="px-3 text-center text-xs text-muted-foreground">No mix data</span>
      </div>
    );
  }

  let cumulative = 0;
  const gradientStops = segments
    .map((tier) => {
      const start = cumulative;
      cumulative += tier.percent;
      const color = TIER_HEX_COLORS[tier.tier] ?? "#94a3b8";
      return `${color} ${start}% ${cumulative}%`;
    })
    .join(", ");

  return (
    <div
      className="relative mx-auto size-32 shrink-0 sm:size-36"
      role="img"
      aria-label={`Creator tier distribution: ${segments.map((t) => `${t.tier} ${t.percent}%`).join(", ")}`}
    >
      <div
        className="size-full rounded-full transition-[background] duration-500 motion-reduce:transition-none"
        style={{ background: `conic-gradient(${gradientStops})` }}
      />
      <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-background">
        <span className="text-xl font-bold leading-none text-foreground sm:text-2xl">{totalCreators}</span>
        <span className="mt-1 text-[9px] font-medium tracking-wide text-muted-foreground uppercase sm:text-[10px]">
          Creators
        </span>
      </div>
    </div>
  );
}

function CreatorMixDistributionPanel({ tiers }: { tiers: CreatorMixTier[] }) {
  const hasMixData = tiers.some((tier) => tier.percent > 0);

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-muted/10 px-3 py-4 sm:px-4">
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        Mix distribution
      </p>

      {!hasMixData ? (
        <div className="mt-4 flex flex-col items-center justify-center gap-2 py-6 text-center">
          <CreatorMixDoughnutRing tiers={tiers} />
          <p className="max-w-xs text-xs text-muted-foreground">
            Tier percentages are not available yet. Creator counts are shown above.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex min-w-0 flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-6">
          <CreatorMixDoughnutRing tiers={tiers} />

          <div className="min-w-0 w-full flex-1 space-y-2.5">
            {tiers.map((tier) => (
              <div
                key={tier.tier}
                className="min-w-0 rounded-lg border border-border/40 bg-background/60 px-3 py-2.5"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`size-3 shrink-0 rounded-full ${TIER_COLORS[tier.tier] ?? "bg-muted"}`} />
                  <span className="text-sm font-bold text-foreground">{tier.tier}</span>
                  <span className="text-xs font-medium text-brand-product">{tier.percent}%</span>
                  <span className="text-xs text-muted-foreground">
                    {tier.count} {tier.count === 1 ? "creator" : "creators"}
                  </span>
                </div>
                {tier.reasoning ? (
                  <p className="mt-1.5 break-words text-[11px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                    {tier.reasoning}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type CreatorMixSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

export function CreatorMixSection({
  campaignObject,
  fallbackText,
  status,
}: CreatorMixSectionProps) {
  if (status === "running" && !fallbackText.trim() && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  const tiers = resolveCreatorMix(campaignObject);
  if (tiers.length === 0) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Creator mix pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="hidden min-w-0 space-y-2 sm:block">
        {tiers.map((tier) => (
          <div key={tier.tier} className={PAIR_STRATEGY_CARD}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`size-3 rounded-full ${TIER_COLORS[tier.tier] ?? "bg-muted"}`} />
                <span className="text-sm font-bold">{tier.tier}</span>
                <span className="text-xs text-muted-foreground">
                  {tier.count} creators · {tier.percent}%
                </span>
              </div>
            </div>
            <Progress
              value={tier.percent}
              className={TIER_PROGRESS_CLASS[tier.tier] ?? "mt-2 h-2 [&>div]:bg-muted"}
            />
            <p className="mt-1.5 break-words text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
              {tier.reasoning}
            </p>
          </div>
        ))}
      </div>

      <CreatorMixDistributionPanel tiers={tiers} />
    </div>
  );
}
