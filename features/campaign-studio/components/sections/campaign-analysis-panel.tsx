"use client";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CampaignScoreSet,
  CreatorsSectionData,
  PerformanceSectionData,
} from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

/**
 * Read-only campaign analysis.
 *
 * Renders what the Campaign Forecast Engine and the campaign score engine
 * already computed and persisted — it calculates nothing of its own, so the
 * numbers here can never disagree with the ones the rest of Studio uses.
 *
 * A metric is shown only when it exists. Cost lines are absent, not zeroed,
 * when no budget was given: an unknown is not the same as a zero.
 */

type HealthLevel = "Strong" | "Good" | "Moderate" | "Weak";

function levelFor(score: number): HealthLevel {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Good";
  if (score >= 45) return "Moderate";
  return "Weak";
}

const LEVEL_STYLES: Record<HealthLevel, { text: string; bar: string }> = {
  Strong: { text: "text-[#0C9D57]", bar: "bg-[#0C9D57]" },
  Good: { text: "text-[#1D9E75]", bar: "bg-[#1D9E75]" },
  Moderate: { text: "text-amber-700 dark:text-amber-400", bar: "bg-amber-500" },
  Weak: { text: "text-red-700 dark:text-red-400", bar: "bg-red-500" },
};

/**
 * The seven dimensions the score engine already produces. Kept in the engine's
 * own terms — these are the ones grounded in real Thinkway data, not a fresh
 * taxonomy invented for the panel.
 */
const HEALTH_DIMENSIONS: Array<{
  key: keyof Omit<CampaignScoreSet, "overall" | "basis" | "updatedAt">;
  label: string;
  /** Substring that identifies this dimension's line in `basis`. */
  basisPrefix: string;
}> = [
  { key: "brandFit", label: "Creator fit", basisPrefix: "Brand fit:" },
  { key: "audienceMatch", label: "Audience fit", basisPrefix: "Audience match:" },
  { key: "reach", label: "Reach potential", basisPrefix: "Reach:" },
  { key: "engagementForecast", label: "Engagement potential", basisPrefix: "Engagement forecast:" },
  { key: "contentCoverage", label: "Content coverage", basisPrefix: "Content coverage:" },
  { key: "budgetEfficiency", label: "Efficiency", basisPrefix: "Budget efficiency:" },
  { key: "risk", label: "Delivery confidence", basisPrefix: "Risk:" },
];

function compact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
      <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function HealthMeter({
  label,
  score,
  why,
}: {
  label: string;
  score: number;
  why?: string;
}) {
  const level = levelFor(score);
  const styles = LEVEL_STYLES[level];
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold">{label}</span>
        <span className={`text-[11px] font-extrabold uppercase tracking-wide ${styles.text}`}>
          {level}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${level}`}
      >
        <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${score}%` }} />
      </div>
      {why ? <p className="text-[11px] leading-snug text-muted-foreground">{why}</p> : null}
    </div>
  );
}

export function CampaignAnalysisPanel({ campaignObject }: { campaignObject?: CampaignObject }) {
  const performance = (campaignObject?.sections.performance.data ?? {}) as PerformanceSectionData;
  const creators = (campaignObject?.sections.creators.data ?? {}) as CreatorsSectionData;
  const forecast = performance.campaignForecast;
  const scores = performance.campaignScores;
  const facts = getCampaignFacts(campaignObject);

  const selectedCount = creators.recommendations?.creatorIds?.length ?? 0;
  if (!forecast && !scores) return null;

  const requested = facts?.requestedCreatorCount;
  const composition = creators.slateComposition;
  const shortfall = composition?.tierShortfall ?? [];

  const budget = facts?.budget;
  const currency = budget?.currency ?? "";
  // Efficiency needs both a budget and a projection. Absent either, the row is
  // omitted rather than shown as zero.
  const costPerView =
    budget && forecast && forecast.estimatedViews > 0
      ? budget.amount / forecast.estimatedViews
      : null;
  const costPerEngagement =
    budget && forecast && forecast.estimatedEngagements > 0
      ? budget.amount / forecast.estimatedEngagements
      : null;

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h3 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          Campaign analysis
        </h3>
        <p className="text-xs text-muted-foreground">
          {requested != null
            ? `Requested ${requested} · Recommended ${selectedCount}`
            : `Recommended ${selectedCount} creators`}
          {forecast ? ` · Forecast confidence ${forecast.confidenceLabel}` : ""}
        </p>
      </header>

      {composition?.requestedMix?.length ? (
        <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
          <p className="text-[11px]">
            <span className="font-semibold">Strategy mix:</span>{" "}
            {composition.requestedMix.map((t) => `${t.percent}% ${t.tier}`).join(" · ")}
          </p>
          <p className="text-[11px]">
            <span className="font-semibold">Achieved mix:</span>{" "}
            {composition.achievedMix.length > 0
              ? composition.achievedMix.map((t) => `${t.count} ${t.tier}`).join(" · ")
              : "—"}
          </p>
          {shortfall.length > 0 ? (
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              <span className="font-semibold">Mix warning:</span>{" "}
              {shortfall
                .map((t) => `${t.tier} ${t.achieved}/${t.requested}`)
                .join(" · ")}{" "}
              — inventory could not fill these tiers. No creator from an
              unrequested tier was substituted; broaden Discovery or adjust the
              mix.
            </p>
          ) : null}
        </div>
      ) : null}

      {forecast ? (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric label="Creators" value={String(selectedCount)} />
          <Metric label="Combined audience" value={compact(forecast.audienceSize)} />
          <Metric
            label="Est. reach"
            value={compact(forecast.estimatedReach)}
            hint={
              forecast.overlapDeduction > 0
                ? `net of ${compact(forecast.overlapDeduction)} overlap`
                : undefined
            }
          />
          <Metric label="Est. views" value={compact(forecast.estimatedViews)} />
          <Metric label="Est. engagements" value={compact(forecast.estimatedEngagements)} />
          <Metric
            label="Avg. engagement rate"
            value={
              forecast.averageEngagementRate != null
                ? `${forecast.averageEngagementRate.toFixed(1)}%`
                : "—"
            }
            hint={forecast.averageEngagementRate == null ? "no ER data on the slate" : undefined}
          />
          <Metric label="Est. impressions" value={compact(forecast.estimatedImpressions)} />
          {budget ? (
            <Metric
              label="Client budget"
              value={`${currency} ${budget.amount.toLocaleString()}`}
            />
          ) : null}
          {costPerView != null ? (
            <Metric label="Cost per view" value={`${currency} ${costPerView.toFixed(3)}`} />
          ) : null}
          {costPerEngagement != null ? (
            <Metric
              label="Cost per engagement"
              value={`${currency} ${costPerEngagement.toFixed(2)}`}
            />
          ) : null}
        </dl>
      ) : null}

      {scores ? (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
              Campaign health
            </h4>
            <span className="text-[11px] text-muted-foreground">
              Overall {levelFor(scores.overall)}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {HEALTH_DIMENSIONS.map((dimension) => (
              <HealthMeter
                key={dimension.key}
                label={dimension.label}
                score={scores[dimension.key]}
                why={scores.basis.find((line) => line.startsWith(dimension.basisPrefix))}
              />
            ))}
          </div>
        </div>
      ) : null}

      {forecast?.explanation?.length ? (
        <ul className="space-y-1 text-[11px] text-muted-foreground">
          {forecast.explanation.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
