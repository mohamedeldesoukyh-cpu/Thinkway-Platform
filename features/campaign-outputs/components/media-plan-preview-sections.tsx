import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { cn } from "@/lib/utils";

import type { MediaPlanCampaignContext, MediaPlanDeadline, MediaPlanData } from "../generators/media-plan";
import type { MediaPlanStrategySummary } from "../media-plan-strategy-summary";
import { buildMediaPlanStrategyBlocks, type MediaPlanStrategyBlock } from "../media-plan-strategy-blocks";
import {
  MEDIA_PLAN_COST_VAT_DISCLAIMER,
  MEDIA_PLAN_PRICING_DISCLAIMER,
  MEDIA_PLAN_USAGE_RIGHTS_DISCLAIMER,
} from "../generators/media-plan";
import { formatMoney } from "../generators/generator-utils";
import { MEDIA_PLAN_BRAND, MEDIA_PLAN_WEEK_PHASE_COLORS } from "./media-plan-brand";
import type { MediaPlanCreativeConceptDisplay } from "../media-plan-creative-direction";
import { InfluencerConceptsSheet } from "./influencer-concepts-sheet";
import type { CampaignObject } from "@/features/campaign-intelligence";
import { deriveMediaPlanWeekPhase } from "../media-plan-strategy-narrative";
import { weeklyObjectiveCardFlex, weeklyObjectiveWeightBarWidth } from "../media-plan-week-objectives-layout";
import { SafeSvgHtml } from "@/components/security/safe-html";

import { platformIconSvgHtml, resolvePlatformBarBackground } from "../platform-brand";

function PlatformBarLabel({ platform }: { platform: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <SafeSvgHtml
        className="inline-flex shrink-0 leading-none"
        html={platformIconSvgHtml(platform, 14)}
      />
      {platform}
    </span>
  );
}

function WeekWeightBars({ weights }: { weights: number[] }) {
  const avg = weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
  return (
    <div className="mt-2 space-y-2">
      {weights.map((weight, index) => {
        const phase = deriveMediaPlanWeekPhase(weight, index, weights.length, avg, weights);
        const color = MEDIA_PLAN_WEEK_PHASE_COLORS[phase] ?? MEDIA_PLAN_BRAND.electricBlue;
        return (
          <div key={`w-${index + 1}`} className="flex items-center gap-2">
            <span className="w-7 shrink-0 text-[10px] font-bold" style={{ color: MEDIA_PLAN_BRAND.muted }}>
              W{index + 1}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: MEDIA_PLAN_BRAND.lavender }}>
              <div className="h-full rounded-full" style={{ width: `${weight}%`, backgroundColor: color }} />
            </div>
            <span className="w-8 shrink-0 text-right text-[10px] font-bold" style={{ color: MEDIA_PLAN_BRAND.ink }}>
              {weight}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TierChipsRow({ chips }: { chips: Array<{ tier: string; count: number }> }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {chips.map((chip) => (
        <div
          key={chip.tier}
          className="rounded-lg border bg-white px-2 py-2 text-center"
          style={{
            borderColor: chip.tier === "UGC" ? "#1D9E75" : "rgba(11,15,26,0.08)",
            backgroundColor: chip.tier === "UGC" ? "#F0FDF7" : "#fff",
          }}
        >
          <p
            className="text-[16px] font-extrabold leading-none"
            style={{ color: chip.tier === "UGC" ? "#1D9E75" : MEDIA_PLAN_BRAND.electricBlue }}
          >
            {chip.count}
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: MEDIA_PLAN_BRAND.muted }}>
            {chip.tier}
          </p>
        </div>
      ))}
    </div>
  );
}

function deadlineDeliverables(deadline: MediaPlanDeadline): string[] {
  if (deadline.serviceTypes?.length) return deadline.serviceTypes;
  return deadline.serviceType?.trim() ? [deadline.serviceType] : [];
}

export const MEDIA_PLAN_DEADLINES_HEADING = "Production & Asset Delivery Deadlines";

export function MediaPlanCampaignCostBadge({
  cost,
  className = "",
  variant = "cover",
}: {
  cost?: { amount: number; currency: string };
  className?: string;
  variant?: "cover" | "inline";
}) {
  if (!cost) return null;

  if (variant === "cover") {
    return (
      <aside
        className={`inline-block rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur-sm ${className}`}
      >
        <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-white/80">
          Campaign cost
        </p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {formatMoney(cost.amount, cost.currency)}
        </p>
        <p className="mt-1.5 text-[9px] leading-snug text-white/70">{MEDIA_PLAN_COST_VAT_DISCLAIMER}</p>
        <p className="text-[9px] leading-snug text-white/70">{MEDIA_PLAN_USAGE_RIGHTS_DISCLAIMER}</p>
      </aside>
    );
  }

  return (
    <aside
      className={`shrink-0 rounded-xl border border-[#0B0F1A]/8 bg-white px-4 py-3 text-right shadow-sm ${className}`}
    >
      <p
        className="text-[10px] font-extrabold uppercase tracking-[0.5px]"
        style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
      >
        Campaign cost
      </p>
      <p
        className="mt-1 text-xl font-extrabold tracking-tight"
        style={{ color: MEDIA_PLAN_BRAND.deepNavy }}
      >
        {formatMoney(cost.amount, cost.currency)}
      </p>
      <p className="mt-1 text-[10px] font-medium leading-snug" style={{ color: MEDIA_PLAN_BRAND.muted }}>
        {MEDIA_PLAN_COST_VAT_DISCLAIMER}
      </p>
      <p className="text-[10px] font-medium leading-snug" style={{ color: MEDIA_PLAN_BRAND.muted }}>
        {MEDIA_PLAN_USAGE_RIGHTS_DISCLAIMER}
      </p>
    </aside>
  );
}

export function MediaPlanContextStrip({
  context,
  variant = "document",
}: {
  context?: MediaPlanCampaignContext;
  variant?: "document" | "cover";
}) {
  if (!context?.clientName && !context?.brandName && !context?.groupName && !context?.agencyName) {
    return null;
  }

  const fields = [
    context.groupName ? { label: "Group", value: context.groupName } : null,
    context.clientName ? { label: "Legal entity", value: context.clientName } : null,
    context.brandName ? { label: "Brand", value: context.brandName } : null,
    context.agencyName ? { label: "Agency", value: context.agencyName } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const isCover = variant === "cover";

  return (
    <dl
      className={
        isCover
          ? "mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/15 pt-4"
          : "mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#0B0F1A]/8 pt-4"
      }
    >
      {fields.map(({ label, value }) => (
        <div key={label}>
          <dt
            className="text-[10px] font-extrabold uppercase tracking-[0.5px]"
            style={{ color: isCover ? "rgba(255,255,255,0.7)" : MEDIA_PLAN_BRAND.muted }}
          >
            {label}
          </dt>
          <dd
            className="mt-0.5 text-[13px] font-semibold"
            style={{ color: isCover ? "#fff" : MEDIA_PLAN_BRAND.deepNavy }}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function MediaPlanStrategySection({
  summary,
  variant = "document",
  campaignObject,
  platformAllocation,
  onInfluencerConceptsPersist,
}: {
  summary?: MediaPlanStrategySummary;
  variant?: "document" | "cover";
  campaignObject?: CampaignObject;
  platformAllocation?: Record<string, number>;
  onInfluencerConceptsPersist?: (next: CampaignObject) => void | Promise<void>;
}) {
  if (!summary?.hasContent) {
    return (
      <section
        className={cn(
          "rounded-xl border border-dashed px-4 py-3",
          variant === "cover" ? "border-white/25 bg-white/5" : "border-[#0B0F1A]/12 bg-white"
        )}
      >
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.08em]"
          style={{ color: variant === "cover" ? "rgba(255,255,255,0.75)" : MEDIA_PLAN_BRAND.electricBlue }}
        >
          Campaign Strategy
        </p>
        <p
          className="mt-1 text-[12px] leading-relaxed"
          style={{ color: variant === "cover" ? "rgba(255,255,255,0.65)" : MEDIA_PLAN_BRAND.muted }}
        >
          Strategy summary will appear here once the campaign brief or strategy section is complete.
        </p>
      </section>
    );
  }

  const blocks = buildMediaPlanStrategyBlocks(summary, { clientFacing: true });

  const renderCreativeConcept = (concept: MediaPlanCreativeConceptDisplay) => {
    const renderFields = (
      fields: MediaPlanCreativeConceptDisplay["english"],
      locale: "en" | "ar"
    ) => (
      <div className={locale === "ar" ? "mt-2 border-t border-dashed border-[#0B0F1A]/10 pt-2" : ""} dir={locale === "ar" ? "rtl" : undefined}>
        {concept.source === "thinkway" && locale === "en" ? (
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: MEDIA_PLAN_BRAND.electricBlue }}>
            Thinkway Creative Recommendation
          </p>
        ) : null}
        {[
          locale === "ar" ? ["اسم المفهوم", fields.conceptName] : ["Concept Title", fields.conceptName],
          locale === "ar" ? ["الفكرة الإبداعية", fields.creativeIdea] : ["Creative Idea", fields.creativeIdea],
          locale === "ar" ? ["تسلسل القصة", fields.storyFlow] : ["Story Flow", fields.storyFlow],
          locale === "ar"
            ? ["نقاط الحديث", fields.talkingPoints?.join(" · ")]
            : ["Talking Points", fields.talkingPoints?.join(" · ")],
          locale === "ar" ? ["دعوة للعمل", fields.cta] : ["CTA", fields.cta],
          locale === "ar" ? ["حوار مقترح", fields.suggestedDialogue] : ["Suggested Dialogue", fields.suggestedDialogue],
          locale === "ar" ? ["ملاحظات المبدع", fields.creatorNotes] : ["Creator Notes", fields.creatorNotes],
        ]
          .filter(([, value]) => Boolean(value?.trim()))
          .map(([label, value]) => (
            <div key={`${locale}-${label}`} className="mb-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                {label}
              </p>
              <p className="text-[10px] leading-snug" style={{ color: MEDIA_PLAN_BRAND.ink }}>
                {value}
              </p>
            </div>
          ))}
      </div>
    );

    return (
      <div
        key={concept.name}
        className="rounded-lg border border-[#0B0F1A]/8 border-t-2 bg-white p-2"
        style={{ borderTopColor: MEDIA_PLAN_BRAND.electricBlue }}
      >
        {renderFields(concept.english, "en")}
        {concept.arabic ? renderFields(concept.arabic, "ar") : null}
      </div>
    );
  };

  const renderBlockContent = (block: MediaPlanStrategyBlock) => {
    if (block.label === "Campaign Rollout Strategy" && block.weekWeights?.length) {
      return (
        <>
          <WeekWeightBars weights={block.weekWeights} />
          {block.tierChips?.length ? <TierChipsRow chips={block.tierChips} /> : null}
        </>
      );
    }

    if (block.kind === "weekly-grid" && block.weeklyObjectives?.length) {
      return (
        <div className="mt-2 flex w-full max-w-full items-stretch gap-2 overflow-hidden">
          {block.weeklyObjectives.map((week) => {
            const phaseColor = MEDIA_PLAN_WEEK_PHASE_COLORS[week.phase] ?? MEDIA_PLAN_BRAND.electricBlue;
            return (
            <div
              key={week.week}
              className="min-w-0 flex-1 rounded-lg border border-[#0B0F1A]/8 bg-white p-2"
              style={{ flex: weeklyObjectiveCardFlex(), borderLeftWidth: 4, borderLeftColor: phaseColor }}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                <span style={{ color: MEDIA_PLAN_BRAND.electricBlue }}>W{week.week}</span>
                <span style={{ color: phaseColor }}>{week.phase}</span>
                <span className="ml-auto" style={{ color: MEDIA_PLAN_BRAND.ink }}>{week.weight}%</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ backgroundColor: MEDIA_PLAN_BRAND.lavender }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: weeklyObjectiveWeightBarWidth(week.weight), backgroundColor: phaseColor }}
                />
              </div>
              <ul className="mt-1 list-disc pl-3 text-[10px] leading-snug" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                {week.goals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            </div>
            );
          })}
        </div>
      );
    }

    if (block.kind === "creative-list" && block.creativeConceptDisplays?.length) {
      return (
        <div className="mt-2 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {block.creativeConceptDisplays.map((concept) => renderCreativeConcept(concept))}
          </div>
          {block.influencerConcepts?.length ? (
            <InfluencerConceptsSheet
              concepts={block.influencerConcepts}
              campaignObject={campaignObject}
              platformAllocation={platformAllocation}
              onPersist={onInfluencerConceptsPersist}
            />
          ) : null}
        </div>
      );
    }

    if (block.kind === "creative-list" && block.creativeItems?.length) {
      return (
        <div className="mt-2 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {block.creativeItems.map((entry) => (
            <div
              key={entry.format}
              className="rounded-lg border border-[#0B0F1A]/8 border-t-2 bg-white p-2"
              style={{ borderTopColor: MEDIA_PLAN_BRAND.electricBlue }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold" style={{ color: MEDIA_PLAN_BRAND.deepNavy }}>
                  {entry.format}
                </p>
              </div>
              <p className="mt-0.5 text-[10px] leading-snug" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                {entry.reason}
              </p>
            </div>
          ))}
          </div>
          {block.influencerConcepts?.length ? (
            <InfluencerConceptsSheet
              concepts={block.influencerConcepts}
              campaignObject={campaignObject}
              platformAllocation={platformAllocation}
              onPersist={onInfluencerConceptsPersist}
            />
          ) : null}
        </div>
      );
    }

    if (block.label === "Creative Direction" && block.influencerConcepts?.length) {
      return (
        <InfluencerConceptsSheet
          concepts={block.influencerConcepts}
          campaignObject={campaignObject}
          platformAllocation={platformAllocation}
          onPersist={onInfluencerConceptsPersist}
        />
      );
    }

    if (block.kind === "tier-chips" && block.tierChips?.length) {
      return (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {block.tierChips.map((chip) => (
              <div
                key={chip.tier}
                className="rounded-lg border bg-white px-2 py-2 text-center"
                style={{
                  borderColor: chip.tier === "UGC" ? "#1D9E75" : "rgba(11,15,26,0.08)",
                  backgroundColor: chip.tier === "UGC" ? "#F0FDF7" : "#fff",
                }}
              >
                <p
                  className="text-[18px] font-extrabold leading-none"
                  style={{ color: chip.tier === "UGC" ? "#1D9E75" : MEDIA_PLAN_BRAND.electricBlue }}
                >
                  {chip.count}
                </p>
                <p
                  className="mt-1 text-[9px] font-bold uppercase tracking-wide"
                  style={{ color: MEDIA_PLAN_BRAND.muted }}
                >
                  {chip.tier}
                </p>
              </div>
            ))}
          </div>
          <p
            className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed"
            style={{ color: variant === "cover" ? "rgba(255,255,255,0.92)" : MEDIA_PLAN_BRAND.ink }}
          >
            {block.body}
          </p>
        </>
      );
    }

    return (
      <p
        className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed"
        style={{ color: variant === "cover" ? "rgba(255,255,255,0.92)" : MEDIA_PLAN_BRAND.ink }}
      >
        {block.body}
      </p>
    );
  };

  return (
    <section
      className={cn(
        "space-y-3 rounded-xl border px-4 py-4",
        variant === "cover"
          ? "border-white/20 bg-white/10 backdrop-blur-sm"
          : "border-[#0B0F1A]/8 bg-white shadow-sm"
      )}
    >
      <h3
        className="text-[10px] font-extrabold uppercase tracking-[0.08em]"
        style={{ color: variant === "cover" ? "rgba(255,255,255,0.85)" : MEDIA_PLAN_BRAND.electricBlue }}
      >
        Campaign Strategy
      </h3>
      <div className="space-y-3">
        {blocks.map((block) => (
          <div
            key={block.label}
            className="rounded-lg border border-[#0B0F1A]/6 bg-[#FAFBFF] p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p
                className="text-[10px] font-bold uppercase tracking-wide"
                style={{ color: variant === "cover" ? "rgba(255,255,255,0.7)" : MEDIA_PLAN_BRAND.deepNavy }}
              >
                {block.label}
              </p>
            </div>
            {block.limitations ? (
              <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
                {block.limitations}
              </p>
            ) : null}
            {renderBlockContent(block)}
          </div>
        ))}
      </div>
    </section>
  );
}

export function MediaPlanDeadlinesTable({
  deadlines,
  variant = "document",
}: {
  deadlines: MediaPlanDeadline[];
  variant?: "document" | "inline";
}) {
  if (!deadlines.length) return null;

  const tableClass =
    variant === "document"
      ? "w-full min-w-[32rem] border-collapse text-[12px]"
      : "w-full min-w-[32rem] border-collapse text-[12px]";
  const wrapperClass =
    variant === "document"
      ? "overflow-x-auto rounded-xl border border-[#0B0F1A]/8 bg-white shadow-sm"
      : "overflow-x-auto rounded-lg border border-border";

  return (
    <div className={wrapperClass}>
      <table className={tableClass}>
        <thead>
          <tr
            className="text-left text-white"
            style={{ backgroundColor: MEDIA_PLAN_BRAND.deepNavy }}
          >
            {["Creator", "Deliverables", "Publish", "Production starts", "Assets due"].map((col) => (
              <th key={col} className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.5px]">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deadlines.map((deadline, index) => (
            <tr
              key={`${deadline.creator}-${deadline.publishWeek}-${deadline.publishDay}-${index}`}
              className="border-t border-[#0B0F1A]/6"
              style={
                index % 2 === 1
                  ? { backgroundColor: "rgba(232,239,254,0.35)" }
                  : undefined
              }
            >
              <td className="px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <CreatorAvatarImage
                    avatarUrl={deadline.avatarUrl ?? null}
                    profileUrl={deadline.profileUrl ?? null}
                    size="sm"
                    className="shrink-0 ring-1 ring-[#0B0F1A]/8"
                    alt={deadline.shortName ?? deadline.creator}
                  />
                  <div className="min-w-0">
                    <p
                      className="truncate font-semibold"
                      style={{ color: MEDIA_PLAN_BRAND.ink }}
                    >
                      {deadline.shortName ?? deadline.creator}
                    </p>
                    {deadline.handle ? (
                      <p className="truncate text-[10px]" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                        @{deadline.handle.replace(/^@/, "")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-3 py-2" style={{ color: MEDIA_PLAN_BRAND.ink }}>
                {deadlineDeliverables(deadline).length ? (
                  <ul className="space-y-0.5">
                    {deadlineDeliverables(deadline).map((type) => (
                      <li key={type} className="text-[11px] leading-snug">
                        {type}
                      </li>
                    ))}
                  </ul>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2" style={{ color: MEDIA_PLAN_BRAND.ink }}>
                Week {deadline.publishWeek} · {deadline.publishDay}
              </td>
              <td className="px-3 py-2" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                {deadline.productionStart}
              </td>
              <td className="px-3 py-2" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                {deadline.assetDelivery}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function shouldSkipMediaPlanSection(heading: string, hasDeadlinesData: boolean): boolean {
  if (heading.startsWith("Week ")) return true;
  if (heading === "Campaign Cost") return true;
  if (hasDeadlinesData && heading === MEDIA_PLAN_DEADLINES_HEADING) return true;
  if (
    heading === "Activation Waves" ||
    heading === "Platform Allocation" ||
    heading === "Creator Dependencies" ||
    heading === "Milestones & Windows"
  ) {
    return true;
  }
  return false;
}

function platformAllocationBars(data: MediaPlanData): Array<{ platform: string; percentage: number }> {
  const entries = Object.entries(data.platformAllocation);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return entries.map(([platform, count]) => ({
    platform,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
}

export function MediaPlanCoverStats({ data }: { data: MediaPlanData }) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {[
        { num: data.durationWeeks, lbl: "Weeks" },
        { num: data.postingSlotCount ?? data.creatorCount, lbl: "Ad slots" },
        { num: data.creatorCount, lbl: "Creators" },
      ].map(({ num, lbl }) => (
        <div
          key={lbl}
          className="min-w-[5.5rem] rounded-xl border border-white/15 bg-white/10 px-5 py-3.5 text-center"
        >
          <p className="text-2xl font-extrabold text-white sm:text-3xl">{num}</p>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white/75">
            {lbl}
          </p>
        </div>
      ))}
    </div>
  );
}

export function MediaPlanOperationsPanel({ data }: { data: MediaPlanData }) {
  const allocationBars = platformAllocationBars(data);
  const showWaves = data.planMode !== "planning" && data.waves.length > 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {showWaves ? (
      <div className="rounded-[14px] border border-[#0B0F1A]/8 bg-white p-4 shadow-sm">
        <h4
          className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.08em]"
          style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
        >
          Activation Waves
        </h4>
        <ul className="space-y-1 text-xs" style={{ color: MEDIA_PLAN_BRAND.ink }}>
          {data.waves.map((wave) => (
            <li key={wave.wave}>
              <span className="font-semibold" style={{ color: MEDIA_PLAN_BRAND.deepNavy }}>
                Wave {wave.wave}
              </span>{" "}
              — {wave.theme}{" "}
              <span style={{ color: MEDIA_PLAN_BRAND.muted }}>(wk {wave.weeks.join(", ")})</span>
            </li>
          ))}
        </ul>
      </div>
      ) : null}

      {allocationBars.length > 0 ? (
        <div className="rounded-[14px] border border-[#0B0F1A]/8 bg-white p-4 shadow-sm">
          <h4
            className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.08em]"
            style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
          >
            Platform Allocation
          </h4>
          <div className="space-y-2.5">
            {allocationBars.map((entry, index) => (
              <div key={entry.platform}>
                <div className="mb-1 flex justify-between text-[11px] font-semibold">
                  <span style={{ color: MEDIA_PLAN_BRAND.ink }}>
                    <PlatformBarLabel platform={entry.platform} />
                  </span>
                  <span style={{ color: MEDIA_PLAN_BRAND.muted }}>{entry.percentage}%</span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full"
                  style={{ backgroundColor: MEDIA_PLAN_BRAND.lavender }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${entry.percentage}%`,
                      background: resolvePlatformBarBackground(entry.platform, index),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[14px] border border-[#0B0F1A]/8 bg-white p-4 shadow-sm">
        <h4
          className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.08em]"
          style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
        >
          Milestones &amp; Windows
        </h4>
        <ul
          className="max-h-40 space-y-1 overflow-y-auto text-xs"
          style={{ color: MEDIA_PLAN_BRAND.ink }}
        >
          {data.milestones.slice(0, 14).map((m, i) => (
            <li key={`${m.type}-${m.week}-${i}`}>
              <span className="font-mono font-medium" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                Wk {m.week}
              </span>{" "}
              · {m.label}
            </li>
          ))}
        </ul>
      </div>

      {data.dependencies.length > 0 ? (
        <div className="rounded-[14px] border border-[#0B0F1A]/8 bg-white p-4 shadow-sm">
          <h4
            className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.08em]"
            style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
          >
            Creator Dependencies
          </h4>
          <ul className="space-y-1 text-xs" style={{ color: MEDIA_PLAN_BRAND.ink }}>
            {data.dependencies.map((dep) => (
              <li key={`${dep.creator}-${dep.dependsOn}`}>
                <span className="font-semibold" style={{ color: MEDIA_PLAN_BRAND.deepNavy }}>
                  {dep.creator}
                </span>{" "}
                <span style={{ color: MEDIA_PLAN_BRAND.muted }}>→ {dep.dependsOn}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
