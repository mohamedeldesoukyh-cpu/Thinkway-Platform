"use client";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

import { formatCompactCount, formatEngagementPct, formatPlatformLabel, providedText, TO_BE_CONFIRMED } from "../format";
import {
  creatorMixFromRoster,
  donutGradient,
  MIX_BAR_COLORS,
  rosterHeadline,
  rosterSourceLine,
  strategicPillars,
  type CreatorMixSlice,
} from "../presentation";
import type { ClientWorkspaceView } from "../types";
import { useClientWorkspaceState } from "./client-workspace-state";
import { KpiIcon } from "./review-icons";
import { ProposalSummaryCard } from "./proposal-summary-card";

function Glance({ label, value, missing }: { label: string; value: string; missing?: boolean }) {
  return (
    <div className="gi">
      <p className="l">{label}</p>
      <p className={missing ? "v tbc" : "v"}>{value}</p>
    </div>
  );
}

function Kpi({
  name,
  label,
  value,
}: {
  name: "reach" | "engage" | "trend" | "cpe" | "cpm" | "money";
  label: string;
  value: string;
}) {
  return (
    <div className="kpi">
      <div className="ic">
        <KpiIcon name={name} />
      </div>
      <p className="kl">{label}</p>
      <p className="kv">{value}</p>
    </div>
  );
}

function MixBars({ items }: { items: CreatorMixSlice[] }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div className="barset">
      {items.map((item, index) => (
        <div className="bar" key={item.label}>
          <span className="bl">{item.label}</span>
          <span className="bt">
            <span
              className="bf"
              style={{
                width: `${(item.count / max) * 100}%`,
                background: MIX_BAR_COLORS[index % MIX_BAR_COLORS.length],
              }}
            />
          </span>
          <span className="bn">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

function money(value: number | undefined, currency: string): string {
  return value != null ? formatMoneyKpi(value, currency) : TO_BE_CONFIRMED;
}

export function OverviewWorkspace({
  view,
  token,
}: {
  view: ClientWorkspaceView;
  token: string;
}) {
  const { selection, selectedCreators, selectedSummary, selectedCommercial } = useClientWorkspaceState();
  const o = view.overview;
  const roster = selectedCreators.length > 0 ? selectedCreators : [];
  const mix = creatorMixFromRoster(roster);
  const pillars = strategicPillars({
    overview: o,
    strategyBody: view.strategyBody,
    activityMix: selectedSummary.activityMix,
    categories: mix.categories.map((item) => item.label),
  });
  const platforms = o.platforms.map((platform) => formatPlatformLabel(platform) ?? platform);
  const deliverables =
    selectedSummary.activityMix.length > 0
      ? selectedSummary.activityMix.map((item) => `${item.count} ${item.label}`).join(" · ")
      : o.deliverables.join(" · ");
  const forecast = selectedSummary;
  const er =
    forecast.averageEngagementRate != null
      ? formatEngagementPct(forecast.averageEngagementRate)
      : TO_BE_CONFIRMED;
  const hasSelection = selectedCreators.length > 0;

  return (
    <>
      <div className="kpis">
        <Kpi name="reach" label="Est. reach" value={hasSelection ? formatCompactCount(forecast.estimatedReach) : TO_BE_CONFIRMED} />
        <Kpi name="engage" label="Engagements" value={hasSelection ? formatCompactCount(forecast.estimatedEngagements) : TO_BE_CONFIRMED} />
        <Kpi name="trend" label="Eng. rate" value={hasSelection ? er : TO_BE_CONFIRMED} />
        <Kpi name="cpe" label="CPE" value={hasSelection ? money(forecast.cpe, forecast.currency) : TO_BE_CONFIRMED} />
        <Kpi name="cpm" label="CPM" value={hasSelection ? money(forecast.cpm, forecast.currency) : TO_BE_CONFIRMED} />
        <Kpi name="money" label="Creators" value={String(selectedCreators.length)} />
      </div>

      <div className="grid2">
        <div>
          <div className="card">
            <p className="ck">Campaign at a glance</p>
            <h2>What Thinkway is proposing</h2>
            <div className="glance">
              <Glance label="Campaign" value={o.campaignName} />
              <Glance label="Objective" value={providedText(o.objective)} missing={!o.objective?.trim()} />
              <Glance label="Audience" value={providedText(o.audience)} missing={!o.audience?.trim()} />
              <Glance label="Market" value={providedText(o.market)} missing={!o.market?.trim()} />
              <Glance
                label="Duration"
                value={providedText(o.durationLabel, TO_BE_CONFIRMED)}
                missing={!o.durationLabel?.trim()}
              />
              <Glance
                label="Platforms"
                value={platforms.length ? platforms.join(" · ") : TO_BE_CONFIRMED}
                missing={platforms.length === 0}
              />
              <Glance
                label="Deliverables"
                value={deliverables || TO_BE_CONFIRMED}
                missing={!deliverables}
              />
              <Glance label="Selected creators" value={`${selectedCreators.length} of ${view.creators.length}`} />
              <Glance
                label="Selected investment"
                value={
                  selectedCommercial.totalInvestment > 0
                    ? formatMoneyKpi(selectedCommercial.totalInvestment, o.commercial.currency)
                    : TO_BE_CONFIRMED
                }
                missing={selectedCommercial.totalInvestment <= 0}
              />
            </div>
          </div>

          <div className="card">
            <p className="ck">Creator mix</p>
            <h2>Who is in this selection</h2>
            <p className="note">
              {hasSelection
                ? `${selectedCreators.length} accepted of ${rosterHeadline(view.creators.length)}. ${rosterSourceLine(view.review.source)}.`
                : "Accept creators on the Creators tab to update this mix."}
            </p>
            {hasSelection ? (
              <>
            <div className="split" style={{ marginBottom: 26 }}>
              <div>
                <p className="subh">Creator tier</p>
                {mix.tiers.length > 0 ? (
                  <div className="donutwrap">
                    <div className="donut" style={{ background: donutGradient(mix.tiers) }}>
                      <div className="mid">
                        <b>{selectedCreators.length}</b>
                        <span>selected</span>
                      </div>
                    </div>
                    <div className="legend">
                      {mix.tiers.map((tier, index) => (
                        <div className="lg" key={tier.label}>
                          <span
                            className="sw"
                            style={{ background: MIX_BAR_COLORS[index % MIX_BAR_COLORS.length] }}
                          />
                          {tier.label} <b>{tier.count}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="unavailable">Creator size unavailable</p>
                )}
              </div>
              <div>
                <p className="subh">Market split</p>
                {mix.markets.length > 0 ? (
                  <MixBars items={mix.markets} />
                ) : (
                  <p className="unavailable">Market split unavailable</p>
                )}
                <p className="subh" style={{ marginTop: 22 }}>
                  Platform
                </p>
                {mix.platforms.length > 0 ? (
                  <MixBars items={mix.platforms} />
                ) : (
                  <p className="unavailable">Platform mix unavailable</p>
                )}
                {mix.genders.length > 0 ? (
                  <>
                    <p className="subh" style={{ marginTop: 22 }}>
                      Audience
                    </p>
                    <MixBars items={mix.genders} />
                  </>
                ) : null}
              </div>
            </div>
            <p className="subh">Category mix</p>
            {mix.categories.length > 0 ? (
              <MixBars items={mix.categories.slice(0, 8)} />
            ) : (
              <p className="unavailable">Category mix unavailable</p>
            )}
              </>
            ) : (
              <p className="unavailable">Selection mix updates after creators are accepted.</p>
            )}
          </div>

          <div className="card">
            <p className="ck">Why this approach</p>
            <h2>Strategic approach</h2>
            {pillars.length > 0 ? (
              <div className="split">
                {pillars.slice(0, 4).map((pillar) => (
                  <div key={pillar.title}>
                    <p className="subh">{pillar.title}</p>
                    <p style={{ fontSize: 14, color: "var(--ink)", margin: 0 }}>{pillar.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="unavailable">Strategic approach to be confirmed</p>
            )}
          </div>
        </div>

        <aside className="side">
          <ProposalSummaryCard view={view} token={token} selection={selection} />
          <div className="card" style={{ marginTop: 16 }}>
            <p className="ck" style={{ marginBottom: 8 }}>
              Campaign fit
            </p>
            <p className="note" style={{ margin: 0 }}>
              {o.audience?.trim() ||
                o.market?.trim() ||
                "Target geo and audience match to be confirmed once objective and audience data are provided."}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
