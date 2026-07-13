"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { MixRow } from "./shared/studio-ui-primitives";
import { STUDIO_CLASSES, STUDIO_TIER_COLORS } from "../../constants/studio-tokens";
import { resolveCreatorMix, type CreatorMixTier } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

function CreatorMixDonut({ tiers }: { tiers: CreatorMixTier[] }) {
  const segments = tiers.filter((tier) => tier.percent > 0);
  const totalCreators = tiers.reduce((sum, tier) => sum + tier.count, 0);

  if (segments.length === 0) {
    return (
      <div className="flex size-[140px] items-center justify-center rounded-full border border-dashed border-[#0B0F1A]/8 bg-[#EEF1F8]">
        <span className="px-3 text-center text-xs text-[#6B7280]">No mix data</span>
      </div>
    );
  }

  let cumulative = 0;
  const gradientStops = segments
    .map((tier) => {
      const start = cumulative;
      cumulative += tier.percent;
      const color = STUDIO_TIER_COLORS[tier.tier] ?? "#9AA3B2";
      return `${color} ${start}% ${cumulative}%`;
    })
    .join(", ");

  const summary = segments
    .map((t) => `${t.tier} ${t.percent}%`)
    .join(", ");

  return (
    <div
      className="relative mx-auto size-[140px] shrink-0"
      role="img"
      aria-label={`Creator tier distribution: ${summary}`}
    >
      <div
        className="size-full rounded-full"
        style={{ background: `conic-gradient(${gradientStops})` }}
      />
      <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-white dark:bg-background">
        <span className="text-2xl font-black leading-none text-foreground">{totalCreators}</span>
        <span className="mt-0.5 text-[10px] font-extrabold tracking-wide text-[#6B7280] uppercase">
          Creators
        </span>
      </div>
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
  const creatorsData = (campaignObject?.sections.creators.data ?? {}) as CreatorsSectionData;
  const slateIntelligence = creatorsData.slateIntelligence;
  const actualMix = slateIntelligence?.actualMix ?? [];
  const tierShortages = slateIntelligence?.tierShortages ?? [];
  if (tiers.length === 0) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Creator mix pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  const mixSummary = tiers
    .filter((t) => t.percent > 0)
    .map((t) => `${t.tier.toLowerCase()} ${t.percent}%`)
    .join(", ");

  return (
    <div className="min-w-0">
      {tierShortages.length > 0 ? (
        <div className="mb-3 space-y-1 rounded-lg border border-amber-300/80 bg-amber-50/80 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
          {tierShortages.map((warning) => (
            <p key={warning.tier} className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
              {warning.message}
            </p>
          ))}
        </div>
      ) : null}
      {actualMix.length > 0 ? (
        <div className="mb-3 rounded-lg border border-[#0057FF]/20 bg-[#0057FF]/5 px-3 py-2">
          <p className="text-[10px] font-extrabold tracking-wide text-[#0057FF] uppercase">
            Active slate mix
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {actualMix.map((t) => `${t.tier} ${t.count}`).join(" · ")}
          </p>
        </div>
      ) : null}
      {tiers.map((tier) => (
        <MixRow
          key={tier.tier}
          label={`${tier.tier} · ${tier.count} ${tier.count === 1 ? "creator" : "creators"}`}
          percent={tier.percent}
          color={STUDIO_TIER_COLORS[tier.tier] ?? "#9AA3B2"}
        />
      ))}

      <div className="mt-4 flex flex-wrap items-center gap-6">
        <CreatorMixDonut tiers={tiers} />
        <p className="max-w-[360px] text-xs leading-relaxed text-[#6B7280]">
          {mixSummary
            ? `Tier mix aligned to Director Strategy: ${mixSummary}.`
            : "Tier mix will populate once creator strategy is finalized."}
          {tiers.find((t) => t.reasoning)?.reasoning
            ? ` ${tiers.find((t) => t.reasoning)?.reasoning}`
            : null}
        </p>
      </div>
    </div>
  );
}
