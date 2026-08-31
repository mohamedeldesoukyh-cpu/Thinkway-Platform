"use client";

import { useState } from "react";

import {
  clientCampaignOpenHref,
  formatClientDashboardDate,
  partitionClientCampaignPostsByValueScope,
  type ClientCampaignPostRow,
} from "../campaign-execution";
import {
  ADDED_VALUE_PLAN_NOTE,
  CAMPAIGN_SETUP_IN_PROGRESS_COPY,
  CONTENT_REVIEW_NOTE,
  NEEDS_ATTENTION_COPY,
  PERFORMANCE_PENDING_COPY,
  formatCampaignPageUpdatedAt,
  projectClientCampaignDashboard,
} from "../campaign-dashboard";
import { clientCampaignBarSegments, clientOverdueStrip, clientReviewAttention } from "../campaign-tab-aggregates";
import { clientContentToReview, type ClientContentReviewItem } from "../content-approval";
import { ContentToReview } from "./content-to-review";
import { CampaignPublicationPlan } from "./campaign-publication-plan";
import { CampaignProgressGraph } from "./campaign-progress-graph";
import { clientWorkspaceVersionPill } from "../journey-state";
import type { ClientCreatorCard } from "../types";

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
  creators,
  token,
  campaignStartDate,
  campaignEndDate,
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
  creators: ClientCreatorCard[];
  token: string;
  campaignStartDate?: string | null;
  campaignEndDate?: string | null;
}) {
  const dashboard = projectClientCampaignDashboard(posts);
  const { agreed: agreedPosts, addedValue: addedValuePosts } =
    partitionClientCampaignPostsByValueScope(posts);
  const pendingReview = clientContentToReview(contentItems);
  const [overdueFocus, setOverdueFocus] = useState(0);
  const contentSection = (
    <ContentToReview
      items={contentItems}
      token={token}
      note={CONTENT_REVIEW_NOTE}
      creators={creators}
    />
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
  const firstLive = live[0] ?? null;
  const segments = clientCampaignBarSegments(posts);

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

      <AttentionBar items={pendingReview} />
      <OverdueStrip posts={overdue} onViewAll={() => setOverdueFocus((current) => current + 1)} />

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
              <span className="cx-prog__v num">{progress.publishedLabel}</span>
            </div>
            <div className="cx-bar2" aria-hidden="true">
              {segments
                .filter((segment) => segment.count > 0)
                .map((segment) => (
                  <span
                    key={segment.key}
                    className={`cx-bar2__${segment.key}`}
                    style={{ width: `${segment.percent}%` }}
                  />
                ))}
            </div>
            <div className="cx-prog__legend">
              {segments.map((segment) => (
                <span className="cx-leg" key={segment.key}>
                  <i className={`cx-bar2__${segment.key}`} />
                  {segment.label} <b>{segment.count}</b>
                </span>
              ))}
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
                  {clientCampaignOpenHref(firstLive) ? (
                    <a
                      href={clientCampaignOpenHref(firstLive)!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
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

      <CampaignProgressGraph
        posts={posts}
        startDate={campaignStartDate}
        endDate={campaignEndDate}
        creators={creators}
        token={token}
      />
      <CampaignPublicationPlan
        posts={agreedPosts}
        creators={creators}
        token={token}
        focusOverdue={overdueFocus}
      />
      {addedValuePosts.length > 0 ? (
        <CampaignPublicationPlan
          posts={addedValuePosts}
          creators={creators}
          token={token}
          eyebrow="Added value"
          title="Beyond the assignment"
          note={ADDED_VALUE_PLAN_NOTE}
          sectionId="added-value"
        />
      ) : null}
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

function AttentionBar({ items }: { items: ClientContentReviewItem[] }) {
  const attention = clientReviewAttention(items);
  if (!attention) return null;
  return (
    <section className="cx-act" id="actionBar">
      <div className="cx-act__top">
        <span className="cx-act__n num">{attention.count}</span>
        <span className="cx-act__t">{NEEDS_ATTENTION_COPY}</span>
      </div>
      <div className="cx-act__row">
        <span className="cx-act__ic" aria-hidden="true">
          ▶
        </span>
        <span className="cx-act__b">
          <span className="cx-act__h">{attention.headline}</span>
          <span className="cx-act__s">{attention.detail}</span>
        </span>
        <a className="btn pri" href="#review">
          Review
        </a>
      </div>
    </section>
  );
}

function OverdueStrip({
  posts,
  onViewAll,
}: {
  posts: ClientCampaignPostRow[];
  onViewAll: () => void;
}) {
  const strip = clientOverdueStrip(posts);
  if (!strip) return null;
  return (
    <section className="cx-status" id="overdueStrip">
      <span className="cx-status__ic" aria-hidden="true">
        !
      </span>
      <span className="cx-status__b">
        <span className="cx-status__h">{strip.headline}</span>
        <span className="cx-status__s">{strip.detail}</span>
      </span>
      <button type="button" className="btn" onClick={onViewAll}>
        View all
      </button>
    </section>
  );
}
