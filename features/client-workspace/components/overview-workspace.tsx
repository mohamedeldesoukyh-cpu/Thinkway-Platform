import { formatMoneyKpi } from "@/lib/finance/currency-format";

import { formatCompactCount, formatEngagementPct, formatPlatformLabel, providedText, TO_BE_CONFIRMED } from "../format";
import {
  creatorMixFromRoster,
  donutGradient,
  rosterHeadline,
  rosterSourceLine,
  strategicPillars,
} from "../presentation";
import { buildClientReviewPath } from "../security/review-token";
import type { ClientWorkspaceView } from "../types";
import { IconCheck, KpiIcon } from "./review-icons";
import Link from "next/link";

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
      : o.deliverables.join(" · ");
  const forecast = view.mediaPlanSummary;
  const maxCategory = Math.max(...mix.categories.map((item) => item.count), 1);
  const maxMarket = Math.max(...mix.markets.map((item) => item.count), 1);
  const er =
    forecast.averageEngagementRate != null
      ? formatEngagementPct(forecast.averageEngagementRate)
      : TO_BE_CONFIRMED;
  const approvalHref = buildClientReviewPath(view.review.id, token, "approval");
  const feedbackHref = buildClientReviewPath(view.review.id, token, "feedback");

  return (
    <>
      <div className="kpis">
        <Kpi name="reach" label="Est. reach" value={formatCompactCount(forecast.estimatedReach)} />
        <Kpi name="engage" label="Engagements" value={formatCompactCount(forecast.estimatedEngagements)} />
        <Kpi name="trend" label="Eng. rate" value={er} />
        <Kpi name="cpe" label="CPE" value={money(forecast.cpe, forecast.currency)} />
        <Kpi name="cpm" label="CPM" value={money(forecast.cpm, forecast.currency)} />
        <Kpi
          name="money"
          label={forecast.emv != null ? "Est. EMV" : "Creators"}
          value={forecast.emv != null ? money(forecast.emv, forecast.currency) : String(view.creators.length)}
        />
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
              <Glance label="Creators" value={rosterHeadline(view.creators.length)} />
              <Glance
                label="Investment"
                value={
                  o.commercial.totalInvestment > 0
                    ? formatMoneyKpi(o.commercial.totalInvestment, o.commercial.currency)
                    : TO_BE_CONFIRMED
                }
                missing={o.commercial.totalInvestment <= 0}
              />
            </div>
          </div>

          <div className="card">
            <p className="ck">Creator mix</p>
            <h2>Who is in this proposal</h2>
            <p className="note">
              {rosterHeadline(view.creators.length)}. {rosterSourceLine(view.review.source)}.
            </p>
            <div className="split" style={{ marginBottom: 26 }}>
              <div>
                <p className="subh">Creator tier</p>
                {mix.tiers.length > 0 ? (
                  <div className="donutwrap">
                    <div className="donut" style={{ background: donutGradient(mix.tiers) }}>
                      <div className="mid">
                        <b>{view.creators.length}</b>
                        <span>creators</span>
                      </div>
                    </div>
                    <div className="legend">
                      {mix.tiers.map((tier, index) => (
                        <div className="lg" key={tier.label}>
                          <span
                            className="sw"
                            style={{ background: ["#0057FF", "#1A6FFF", "#c9d6f2", "#7F77DD"][index % 4] }}
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
                  <div className="barset">
                    {mix.markets.map((item) => (
                      <div className="bar" key={item.label}>
                        <span className="bl">{item.label}</span>
                        <span className="bt">
                          <span className="bf" style={{ width: `${(item.count / maxMarket) * 100}%` }} />
                        </span>
                        <span className="bn">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="unavailable">Market split unavailable</p>
                )}
                <p className="subh" style={{ marginTop: 22 }}>
                  Platform
                </p>
                <div className="barset">
                  {(platforms.length ? platforms : ["To be confirmed"]).map((platform) => (
                    <div className="bar" key={platform}>
                      <span className="bl">{platform}</span>
                      <span className="bt">
                        <span className="bf" style={{ width: "100%" }} />
                      </span>
                      <span className="bn">{view.creators.length}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="subh">Category mix</p>
            {mix.categories.length > 0 ? (
              <div className="barset">
                {mix.categories.slice(0, 8).map((item) => (
                  <div className="bar" key={item.label}>
                    <span className="bl">{item.label}</span>
                    <span className="bt">
                      <span className="bf" style={{ width: `${(item.count / maxCategory) * 100}%` }} />
                    </span>
                    <span className="bn">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="unavailable">Category mix unavailable</p>
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
          <div className="sumcard">
            <div className="h">
              <p className="st">Proposal summary</p>
              <p className="ss">
                {o.campaignName} · v{view.review.reviewNumber}
              </p>
            </div>
            <div className="sumrow big">
              <span className="k">Investment</span>
              <span className="v">
                {o.commercial.totalInvestment > 0
                  ? formatMoneyKpi(o.commercial.totalInvestment, o.commercial.currency)
                  : TO_BE_CONFIRMED}
              </span>
            </div>
            <div className="sumrow">
              <span className="k">Creators</span>
              <span className="v">{view.creators.length}</span>
            </div>
            <div className="sumrow">
              <span className="k">Est. reach</span>
              <span className="v">{formatCompactCount(forecast.estimatedReach)}</span>
            </div>
            <div className="sumrow">
              <span className="k">Engagements</span>
              <span className="v">{formatCompactCount(forecast.estimatedEngagements)}</span>
            </div>
            <div className="sumrow">
              <span className="k">Engagement rate</span>
              <span className="v">{er}</span>
            </div>
            <div className="sumrow">
              <span className="k">CPE</span>
              <span className="v">{money(forecast.cpe, forecast.currency)}</span>
            </div>
            <div className="sumrow">
              <span className="k">CPM</span>
              <span className="v">{money(forecast.cpm, forecast.currency)}</span>
            </div>
            {forecast.emv != null ? (
              <div className="sumrow">
                <span className="k">Est. media value</span>
                <span className="v">{money(forecast.emv, forecast.currency)}</span>
              </div>
            ) : null}
            {view.canDecide ? (
              <div className="sumcta">
                <Link className="btn primary" href={approvalHref}>
                  <IconCheck />
                  Approve proposal
                </Link>
                <Link
                  className="btn"
                  href={feedbackHref}
                  style={{ background: "rgba(255,255,255,.08)", color: "#fff", borderColor: "rgba(255,255,255,.18)" }}
                >
                  Request changes
                </Link>
              </div>
            ) : null}
          </div>
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
