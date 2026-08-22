"use client";

import type { ReactNode } from "react";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

import { formatCompactCount, formatEngagementPct, formatPlatformLabel, providedText, TO_BE_CONFIRMED } from "../format";
import { campaignPlatformsFromRoster, looksLikePlatformList } from "../deliverables";
import {
  creatorMixFromRoster,
  donutGradient,
  flagFromCountry,
  MIX_BAR_COLORS,
  overviewApproachPillars,
  overviewExecutiveLead,
  rosterHeadline,
  rosterSourceLine,
} from "../presentation";
import type { ClientWorkspaceView } from "../types";
import { useClientWorkspaceState } from "./client-workspace-state";
import { KpiIcon } from "./review-icons";
import { ProposalSummaryCard } from "./proposal-summary-card";
import { ReviewPlatformMark } from "./review-platform-mark";

function Glance({
  label,
  value,
  missing,
}: {
  label: string;
  value: ReactNode;
  missing?: boolean;
}) {
  return (
    <div className="gi">
      <p className="l">{label}</p>
      <div className={missing ? "v tbc" : "v"}>{value}</div>
    </div>
  );
}

function Kpi({
  name,
  label,
  value,
  missing,
}: {
  name: "reach" | "engage" | "trend" | "cpe" | "cpm" | "money" | "people";
  label: string;
  value: string;
  missing?: boolean;
}) {
  return (
    <div className="card kpi">
      <div className="ic">
        <KpiIcon name={name} />
      </div>
      <p className="kl">{label}</p>
      <p className={missing ? "kv tbc" : "kv"}>{value}</p>
    </div>
  );
}

function Highlight({ label, value, missing }: { label: string; value: string; missing?: boolean }) {
  return (
    <div className="ov-high">
      <div className="l">{label}</div>
      <div className={missing ? "v tbc" : "v"}>{value}</div>
    </div>
  );
}

function MixTrackRow({
  avatar,
  count,
  max,
  labeled,
}: {
  avatar: ReactNode;
  count: number;
  max: number;
  labeled?: boolean;
}) {
  return (
    <div className={labeled ? "ov-drow ov-drow-lbl" : "ov-drow"}>
      {avatar}
      <span className="ov-track">
        <span className="ov-fill" style={{ width: `${(count / max) * 100}%` }} />
      </span>
      <span className="ov-num">{count}</span>
    </div>
  );
}

function uniqueLabels(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    const id = key.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(key);
  }
  return result;
}

function money(value: number | undefined, currency: string): string {
  return value != null ? formatMoneyKpi(value, currency) : TO_BE_CONFIRMED;
}

function marketDisplay(value?: string): { label: string; flag: string; missing: boolean } {
  const label = value?.trim() ?? "";
  return {
    label: providedText(label),
    flag: flagFromCountry(label),
    missing: !label,
  };
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
  const platformLabels =
    mix.platforms.length > 0
      ? mix.platforms.map((item) => item.label)
      : uniqueLabels(
          campaignPlatformsFromRoster(roster, o.platforms).map(
            (platform) => formatPlatformLabel(platform) ?? platform
          )
        );
  const glancePlatforms = platformLabels;
  const deliverableFallback = o.deliverables.filter((item) => !looksLikePlatformList(item)).join(" · ");
  const deliverables =
    selectedSummary.activityMix.length > 0
      ? selectedSummary.activityMix.map((item) => `${item.count} ${item.label}`).join(" · ")
      : deliverableFallback;
  const forecast = selectedSummary;
  const hasSelection = selectedCreators.length > 0;
  const reachLabel =
    hasSelection && forecast.estimatedReach != null ? formatCompactCount(forecast.estimatedReach) : undefined;
  const engagementLabel =
    hasSelection && forecast.averageEngagementRate != null ? formatEngagementPct(forecast.averageEngagementRate) : undefined;
  const investmentLabel =
    selectedCommercial.totalInvestment > 0
      ? formatMoneyKpi(selectedCommercial.totalInvestment, o.commercial.currency)
      : undefined;
  const lead = overviewExecutiveLead({
    selectedCount: selectedCreators.length,
    pricedCount: selectedCommercial.pricedSelectedCount ?? 0,
    unpricedCount: selectedCommercial.unpricedSelectedCount ?? 0,
    platformLabels,
    reachLabel,
    engagementLabel,
    investmentLabel,
  });
  const pillars = overviewApproachPillars({
    platformLabels,
    activityMix: selectedSummary.activityMix,
    categories: mix.categories.map((item) => item.label),
  });
  const market = marketDisplay(o.market);
  const platformMax = Math.max(...mix.platforms.map((item) => item.count), 1);
  const marketMax = Math.max(...mix.markets.map((item) => item.count), 1);
  const categoryMax = Math.max(...mix.categories.map((item) => item.count), 1);

  return (
    <>
      <div className="card ov-exec-card">
        <div className="ov-exec">
          <div className="ov-exec-txt">
            <p className="ck">Campaign overview</p>
            <h2>Executive summary</h2>
            <p className="ov-lead">{lead}</p>
          </div>
          <div className="ov-highs">
            <Highlight label="Est. reach" value={reachLabel ?? TO_BE_CONFIRMED} missing={!reachLabel} />
            <Highlight label="Eng. rate" value={engagementLabel ?? TO_BE_CONFIRMED} missing={!engagementLabel} />
            <Highlight label="Creators" value={String(selectedCreators.length)} />
            <Highlight
              label="Investment"
              value={investmentLabel ?? TO_BE_CONFIRMED}
              missing={!investmentLabel}
            />
          </div>
        </div>
      </div>
      <div className="kpis">
        <Kpi
          name="reach"
          label="Est. reach"
          value={reachLabel ?? TO_BE_CONFIRMED}
          missing={!reachLabel}
        />
        <Kpi
          name="engage"
          label="Engagements"
          value={hasSelection ? formatCompactCount(forecast.estimatedEngagements) : TO_BE_CONFIRMED}
          missing={!hasSelection || forecast.estimatedEngagements == null}
        />
        <Kpi name="trend" label="Eng. rate" value={engagementLabel ?? TO_BE_CONFIRMED} missing={!engagementLabel} />
        <Kpi
          name="cpe"
          label="CPE"
          value={hasSelection ? money(forecast.cpe, forecast.currency) : TO_BE_CONFIRMED}
          missing={!hasSelection || forecast.cpe == null}
        />
        <Kpi
          name="cpm"
          label="CPM"
          value={hasSelection ? money(forecast.cpm, forecast.currency) : TO_BE_CONFIRMED}
          missing={!hasSelection || forecast.cpm == null}
        />
        <Kpi name="people" label="Creators" value={String(selectedCreators.length)} />
      </div>

      <div className="grid2">
        <div>
          <div className="card">
            <p className="ck">Campaign at a glance</p>
            <h2>What Thinkway is proposing</h2>
            <div className="glance" style={{ marginTop: 18 }}>
              <Glance label="Campaign" value={o.campaignName} />
              <Glance label="Objective" value={providedText(o.objective)} missing={!o.objective?.trim()} />
              <Glance label="Audience" value={providedText(o.audience)} missing={!o.audience?.trim()} />
              <Glance
                label="Market"
                value={
                  market.flag ? (
                    <span className="ov-market">
                      <span className="ov-pav ov-pav-flag ov-pav-sm" title={market.label}>
                        {market.flag}
                      </span>
                      {market.label}
                    </span>
                  ) : (
                    market.label
                  )
                }
                missing={market.missing}
              />
              <Glance
                label="Duration"
                value={providedText(o.durationLabel, TO_BE_CONFIRMED)}
                missing={!o.durationLabel?.trim()}
              />
              <Glance
                label="Platforms"
                value={
                  glancePlatforms.length > 0 ? (
                    <span className="ov-plat-row">
                      {glancePlatforms.map((platform) => (
                        <span className="ov-pav ov-pav-sm" key={platform} title={formatPlatformLabel(platform) ?? platform}>
                          <ReviewPlatformMark platform={platform} />
                        </span>
                      ))}
                    </span>
                  ) : (
                    TO_BE_CONFIRMED
                  )
                }
                missing={glancePlatforms.length === 0}
              />
              <Glance
                label="Deliverables"
                value={deliverables || TO_BE_CONFIRMED}
                missing={!deliverables}
              />
              <Glance label="Selected creators" value={`${selectedCreators.length} of ${view.creators.length}`} />
              <Glance
                label="Selected investment"
                value={investmentLabel ?? TO_BE_CONFIRMED}
                missing={!investmentLabel}
              />
            </div>
          </div>

          <div className="card">
            <p className="ck">Creator mix</p>
            <h2>Selection analysis</h2>
            <p className="note">
              {hasSelection
                ? `${selectedCreators.length} accepted of ${rosterHeadline(view.creators.length)} · ${rosterSourceLine(view.review.source)}.`
                : "Select creators on Shortlist, then Continue to Your Selection to update this mix."}
            </p>
            {hasSelection ? (
              <div className="ov-analysis">
                <div>
                  <p className="subh" style={{ textAlign: "center" }}>
                    By tier
                  </p>
                  {mix.tiers.length > 0 ? (
                    <div className="donutwrap">
                      <div className="donut" style={{ background: donutGradient(mix.tiers) }}>
                        <div className="mid">
                          <b>{selectedCreators.length}</b>
                          <span>Selected</span>
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
                  <p className="ov-colhd">By platform</p>
                  {mix.platforms.length > 0 ? (
                    <div className="ov-rows">
                      {mix.platforms.map((item) => (
                        <MixTrackRow
                          key={item.label}
                          count={item.count}
                          max={platformMax}
                          avatar={
                            <span className="ov-pav" title={item.label}>
                              <ReviewPlatformMark platform={item.label} />
                            </span>
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="unavailable">Platform mix unavailable</p>
                  )}
                  <p className="ov-colhd">By market</p>
                  {mix.markets.length > 0 ? (
                    <div className="ov-rows">
                      {mix.markets.map((item) => {
                        const flag = flagFromCountry(item.label);
                        return (
                          <MixTrackRow
                            key={item.label}
                            count={item.count}
                            max={marketMax}
                            avatar={
                              flag ? (
                                <span className="ov-pav ov-pav-flag" title={item.label}>
                                  {flag}
                                </span>
                              ) : (
                                <span className="ov-name">{item.label}</span>
                              )
                            }
                            labeled={!flag}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <p className="unavailable">Market split unavailable</p>
                  )}
                  <p className="ov-colhd">By category</p>
                  {mix.categories.length > 0 ? (
                    <div className="ov-catgrid">
                      {mix.categories.slice(0, 8).map((item) => (
                        <MixTrackRow
                          key={item.label}
                          count={item.count}
                          max={categoryMax}
                          labeled
                          avatar={<span className="ov-name">{item.label}</span>}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="unavailable">Category mix unavailable</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="unavailable">Selection mix updates after creators are selected.</p>
            )}
          </div>

          <div className="card">
            <p className="ck">Why this approach</p>
            <h2>Strategic approach</h2>
            {pillars.length > 0 ? (
              <div className="ov-strat">
                {pillars.map((pillar) => (
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
          <ProposalSummaryCard view={view} token={token} selection={selection} showActions={false} />
          <div className="card" style={{ marginTop: 16 }}>
            <p className="ck" style={{ marginBottom: 8 }}>
              Campaign fit
            </p>
            <p className="note" style={{ margin: 0 }}>
              {o.audience?.trim() ||
                o.market?.trim() ||
                "Target geo and audience match will be confirmed once objective and audience data are provided."}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
