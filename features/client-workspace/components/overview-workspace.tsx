import { formatMoneyKpi } from "@/lib/finance/currency-format";

import { formatPlatformLabel, NOT_AVAILABLE, providedText, TO_BE_CONFIRMED } from "../format";
import { creatorMixFromRoster, rosterHeadline, rosterSourceLine, strategicPillars } from "../presentation";
import type { ClientWorkspaceView } from "../types";
import { Chip, MetricCard, MixBars, Panel, formatForecastCount, formatForecastMoney } from "./media-plan-ui";

export function OverviewWorkspace({ view }: { view: ClientWorkspaceView }) {
  const o = view.overview;
  const mix = creatorMixFromRoster(view.creators);
  const pillars = strategicPillars({
    overview: o,
    strategyBody: view.strategyBody,
    activityMix: view.mediaPlanSummary.activityMix,
    categories: mix.categories.map((item) => item.label),
  });
  const platforms = o.platforms.map((platform) => formatPlatformLabel(platform) ?? platform);
  const deliverables =
    view.mediaPlanSummary.activityMix.length > 0
      ? view.mediaPlanSummary.activityMix.map((item) => `${item.count} ${item.label}`).join(" · ")
      : o.deliverables.length > 0
        ? o.deliverables.join(" · ")
        : TO_BE_CONFIRMED;
  const forecast = view.mediaPlanSummary;
  const hasForecast =
    forecast.estimatedReach != null ||
    forecast.estimatedEngagements != null ||
    forecast.cpe != null ||
    forecast.cpm != null ||
    forecast.emv != null;

  return (
    <div className="space-y-5">
      <Panel eyebrow="Campaign at a glance" title="What Thinkway is proposing">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Glance label="Campaign" value={o.campaignName} />
          <Glance label="Objective" value={providedText(o.objective)} />
          <Glance label="Audience" value={providedText(o.audience)} />
          <Glance label="Market" value={providedText(o.market)} />
          <Glance label="Duration" value={providedText(o.durationLabel, TO_BE_CONFIRMED)} />
          <Glance label="Platforms" value={platforms.length ? platforms.join(" · ") : NOT_AVAILABLE} />
          <Glance label="Deliverables" value={deliverables} />
          <Glance
            label="Creators"
            value={rosterHeadline(view.creators.length)}
            hint={rosterSourceLine(view.review.source)}
          />
          <Glance
            label="Investment"
            value={
              o.commercial.totalInvestment > 0
                ? formatMoneyKpi(o.commercial.totalInvestment, o.commercial.currency)
                : TO_BE_CONFIRMED
            }
          />
        </dl>
      </Panel>

      {hasForecast ? (
        <Panel eyebrow="Campaign performance" title="Forecast">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <MetricCard label="Estimated reach" value={formatForecastCount(forecast.estimatedReach)} />
            <MetricCard
              label="Estimated engagements"
              value={formatForecastCount(forecast.estimatedEngagements)}
            />
            {forecast.averageEngagementRate != null ? (
              <MetricCard
                label="Engagement rate"
                value={`${(forecast.averageEngagementRate > 0 && forecast.averageEngagementRate <= 1
                  ? forecast.averageEngagementRate * 100
                  : forecast.averageEngagementRate
                ).toFixed(1)}%`}
              />
            ) : null}
            <MetricCard label="CPE" value={formatForecastMoney(forecast.cpe, forecast.currency)} />
            <MetricCard label="CPM" value={formatForecastMoney(forecast.cpm, forecast.currency)} />
            {forecast.emv != null ? (
              <MetricCard label="EMV" value={formatForecastMoney(forecast.emv, forecast.currency)} />
            ) : null}
            <MetricCard
              label="Creators"
              value={String(view.creators.length)}
              hint={rosterHeadline(view.creators.length)}
            />
          </div>
        </Panel>
      ) : null}

      <Panel eyebrow="Activity mix" title="Proposed deliverables">
        {view.mediaPlanSummary.activityMix.length > 0 ? (
          <MixBars items={view.mediaPlanSummary.activityMix} />
        ) : (
          <p className="text-sm text-zinc-500">Deliverables to be confirmed</p>
        )}
      </Panel>

      <Panel eyebrow="Why this approach" title="Strategic approach">
        {pillars.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {pillars.map((pillar) => (
              <div key={pillar.title} className="rounded-2xl bg-zinc-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {pillar.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-700">{pillar.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Strategic approach to be confirmed</p>
        )}
      </Panel>

      <Panel eyebrow="Creator mix" title="Who is in this proposal">
        <p className="mb-4 text-sm text-zinc-500">
          {rosterHeadline(view.creators.length)}. {rosterSourceLine(view.review.source)}.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <MixGroup title="Recommended" slices={[{ label: "Proposed", count: view.creators.length }]} />
          <MixGroup title="Creator size" slices={mix.tiers} />
          <MixGroup title="Market" slices={mix.markets} />
          <MixGroup title="Categories" slices={mix.categories} />
          {mix.genders.length > 0 ? <MixGroup title="Audience gender" slices={mix.genders} /> : null}
        </div>
      </Panel>

      {view.timeline.phases.length > 0 ? (
        <Panel eyebrow="Timing" title="Campaign timeline">
          <p className="mb-3 text-sm text-zinc-600">{view.timeline.durationLabel}</p>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {view.timeline.phases.map((phase) => (
              <li key={phase.week} className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm">
                <p className="font-medium">
                  Week {phase.week} — {phase.label}
                </p>
                {phase.activities.length > 0 ? (
                  <p className="mt-1 text-zinc-500">{phase.activities.join(" · ")}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}
    </div>
  );
}

function Glance({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium leading-relaxed text-zinc-900">{value}</dd>
      {hint ? <p className="mt-0.5 text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}

function MixGroup({ title, slices }: { title: string; slices: Array<{ label: string; count: number }> }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{title}</p>
      {slices.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {slices.slice(0, 8).map((slice) => (
            <Chip key={`${slice.label}-${slice.count}`}>
              {slice.label} · {slice.count}
            </Chip>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">{NOT_AVAILABLE}</p>
      )}
    </div>
  );
}
