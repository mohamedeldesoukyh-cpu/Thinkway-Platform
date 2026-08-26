"use client";

import {
  formatClientDashboardDate,
  formatClientScheduleDate,
  type ClientCampaignPostRow,
} from "../campaign-execution";
import {
  CAMPAIGN_SETUP_IN_PROGRESS_COPY,
  CONTENT_REVIEW_NOTE,
  NEEDS_ATTENTION_COPY,
  PERFORMANCE_PENDING_COPY,
  clientCampaignLegendCounts,
  formatCampaignPageUpdatedAt,
  projectClientCampaignDashboard,
} from "../campaign-dashboard";
import { clientContentToReview, type ClientContentReviewItem } from "../content-approval";
import { ContentToReview } from "./content-to-review";
import { CampaignPublicationPlan } from "./campaign-publication-plan";
import { clientWorkspaceVersionPill } from "../journey-state";

export function CampaignDashboard({
  campaignName,
  clientLabel,
  creatorCount,
  updatedAt,
  reviewNumber,
  historical,
  newerReviewNumber,
  inCampaign,
  posts,
  contentItems,
  token,
}: {
  campaignName: string;
  clientLabel: string;
  creatorCount: number;
  updatedAt: string | null;
  reviewNumber: number;
  historical: boolean;
  newerReviewNumber: number | null;
  inCampaign: boolean;
  posts: ClientCampaignPostRow[];
  contentItems: ClientContentReviewItem[];
  token: string;
}) {
  const dashboard = projectClientCampaignDashboard(posts);
  const pendingReview = clientContentToReview(contentItems);
  const contentSection = (
    <ContentToReview items={contentItems} token={token} note={CONTENT_REVIEW_NOTE} />
  );
  const updatedLabel = formatCampaignPageUpdatedAt(updatedAt);
  const versionLabel = clientWorkspaceVersionPill({
    historical,
    reviewNumber,
    newerReviewNumber,
  });
  const approvedCreators = dashboard.ready
    ? dashboard.counts.approvedCreators
    : creatorCount;

  if (!dashboard.ready) {
    return (
      <>
        <CampaignPageHead
          campaignName={campaignName}
          clientLabel={clientLabel}
          creatorCount={approvedCreators}
          updatedLabel={updatedLabel}
          versionLabel={versionLabel}
          inCampaign={inCampaign}
        />
        <div className="card">
          <p className="ck">Campaign</p>
          <h2>{campaignName}</h2>
          <p className="note">{CAMPAIGN_SETUP_IN_PROGRESS_COPY}</p>
        </div>
        {contentSection}
      </>
    );
  }

  const { counts, progress, live, overdue, performanceMetrics } = dashboard;
  const legend = clientCampaignLegendCounts(counts);
  const firstLive = live[0] ?? null;

  return (
    <>
      <CampaignPageHead
        campaignName={campaignName}
        clientLabel={clientLabel}
        creatorCount={counts.approvedCreators}
        updatedLabel={updatedLabel}
        versionLabel={versionLabel}
        inCampaign={inCampaign}
      />

      <AttentionBar items={pendingReview} overdue={overdue} />

      <section className="card">
        <div className="cx-kpis">
          <div className="cx-kpi">
            <p className="kl">Creators</p>
            <p className="kv num">{counts.approvedCreators}</p>
            <p className="ks">Approved &amp; contracted</p>
          </div>
          <div className="cx-kpi">
            <p className="kl">Deliverables</p>
            <p className="kv num">{counts.deliverables}</p>
            <p className="ks">Across the plan</p>
          </div>
          <div className={`cx-kpi${counts.live > 0 ? " cx-kpi--live" : ""}`}>
            <p className="kl">Live</p>
            <p className="kv num">{counts.live}</p>
            <p className="ks">Published &amp; tracking</p>
          </div>
          <div className={`cx-kpi${counts.overdue > 0 ? " cx-kpi--alert" : ""}`}>
            <p className="kl">Overdue</p>
            <p className="kv num">{counts.overdue}</p>
            <p className="ks">Past scheduled date</p>
          </div>
        </div>

        {progress ? (
          <div className="cx-prog">
            <div className="cx-prog__r">
              <span className="cx-prog__l">{progress.headline}</span>
              <span className="cx-prog__v num">{progress.percent}%</span>
            </div>
            <div className="track" aria-hidden="true">
              <span className="fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <div className="cx-prog__legend">
              <span className="cx-leg">
                <i style={{ background: "var(--ok, #10b981)" }} />
                Live <b>{legend.live}</b>
              </span>
              <span className="cx-leg">
                <i style={{ background: "var(--bad, #ef4444)" }} />
                Overdue <b>{legend.overdue}</b>
              </span>
              <span className="cx-leg">
                <i style={{ background: "var(--blue)" }} />
                Scheduled <b>{legend.scheduled}</b>
              </span>
              <span className="cx-leg">
                <i style={{ background: "#cfd6e4" }} />
                To be confirmed <b>{legend.scheduling}</b>
              </span>
              <span className="cx-leg">
                <i style={{ background: "#cfd6e4" }} />
                Completed <b>{legend.completed}</b>
              </span>
            </div>
          </div>
        ) : null}
      </section>

      {contentSection}

      <section className="card">
        <p className="ck">Performance</p>
        <h2>Live campaign performance</h2>
        <p className="note">
          {live.length > 0
            ? `From ${live.length} live publication${live.length === 1 ? "" : "s"}. Updates as more creators go live.`
            : PERFORMANCE_PENDING_COPY}
        </p>
        {performanceMetrics.length > 0 ? (
          <div className="camp-perf" style={{ marginTop: 16 }}>
            {performanceMetrics.map((metric) => (
              <div className="mc" key={metric.key}>
                <p className="l">{metric.label}</p>
                <p className="v num">{metric.formatted}</p>
                <p className="s">
                  {metric.key === "views" && firstLive
                    ? `${firstLive.creatorName} · ${firstLive.deliverable}`
                    : "Across live posts"}
                </p>
              </div>
            ))}
            {firstLive ? (
              <div className="mc">
                <p className="l">Published</p>
                <p className="v num">
                  {formatClientDashboardDate(firstLive.publicationDate) ?? "Live"}
                </p>
                <p className="s">
                  {firstLive.contentUrl ? (
                    <a href={firstLive.contentUrl} target="_blank" rel="noopener noreferrer">
                      View publication →
                    </a>
                  ) : (
                    firstLive.deliverable
                  )}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="note">{PERFORMANCE_PENDING_COPY}</p>
        )}
      </section>

      <CampaignPublicationPlan posts={posts} />
    </>
  );
}

function CampaignPageHead({
  campaignName,
  clientLabel,
  creatorCount,
  updatedLabel,
  versionLabel,
  inCampaign,
}: {
  campaignName: string;
  clientLabel: string;
  creatorCount: number;
  updatedLabel: string | null;
  versionLabel: string;
  inCampaign: boolean;
}) {
  return (
    <div className="cx-head">
      <div>
        <p className="ck">Campaign</p>
        <h1>{campaignName}</h1>
        <p className="sub">
          {clientLabel ? `${clientLabel} · ` : ""}
          <b>
            {creatorCount} creator{creatorCount === 1 ? "" : "s"} approved
          </b>
          {updatedLabel ? ` · Updated ${updatedLabel}` : ""}
        </p>
      </div>
      <div className="cx-headmeta">
        {inCampaign ? <span className="cx-pill cx-pill--live">In campaign</span> : null}
        <span className="cx-pill">{versionLabel}</span>
      </div>
    </div>
  );
}

function AttentionBar({
  items,
  overdue,
}: {
  items: ClientContentReviewItem[];
  overdue: ClientCampaignPostRow[];
}) {
  const count = items.length + overdue.length;
  if (count === 0) return null;
  return (
    <section className="cx-act" id="actionBar">
      <div className="cx-act__top">
        <span className="cx-act__n num">{count}</span>
        <span className="cx-act__t">{NEEDS_ATTENTION_COPY}</span>
      </div>
      <div className="cx-act__list">
        {items.map((item) => (
          <div className="cx-item" key={`${item.assetId}:${item.versionId}`}>
            <span className="cx-item__ic cx-item__ic--rev">▶</span>
            <span className="cx-item__b">
              <span className="cx-item__t">
                {item.assetTypeLabel} from {item.creatorName}
              </span>
              <span className="cx-item__s">
                Awaiting your approval
                {item.platformLabel ? ` · ${item.platformLabel}` : ""}
                {` · v${item.versionNumber}`}
              </span>
            </span>
            <a className="btn pri" href="#review">
              Review
            </a>
          </div>
        ))}
        {overdue.map((row) => (
          <div className="cx-item" key={row.id}>
            <span className="cx-item__ic cx-item__ic--od">!</span>
            <span className="cx-item__b">
              <span className="cx-item__t">
                {row.creatorName} · {row.deliverable} overdue
              </span>
              <span className="cx-item__s">
                {formatClientScheduleDate(row.scheduledDate)
                  ? `Was scheduled ${formatClientScheduleDate(row.scheduledDate)} — Thinkway is chasing`
                  : "Thinkway is chasing this overdue deliverable"}
              </span>
            </span>
            <a className="btn" href="#publication-plan">
              View
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
