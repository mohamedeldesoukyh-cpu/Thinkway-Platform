"use client";

import { useEffect, useState } from "react";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

import { mixPostsForDeliverables, resolveContentPostPlatform } from "../creator-snapshot";
import {
  DATA_NOT_AVAILABLE,
  formatCompactCount,
  formatEngagementPct,
  formatLocation,
  formatMatchPercent,
  formatPlatformLabel,
  NOT_AVAILABLE,
  TO_BE_CONFIRMED,
} from "../format";
import { breakdownForCreator } from "../platform-breakdown";
import { flagFromCountry, qualityBadge, qualityGaugePercent, engagementBadge, engagementGaugePercent } from "../presentation";
import { clientReviewPostDisplay } from "../review-media";
import type {
  ClientAudienceSlice,
  ClientContentPost,
  ClientCreatorBrief,
  ClientCreatorCard,
  ClientDeliverableItem,
  ClientHistoricalMonth,
} from "../types";
import { RetryableReviewImage, ReviewAvatar } from "./review-avatar";
import { IconCat, IconChart, IconCheck, IconClose, IconHeart } from "./review-icons";
import { ReviewPlatformBreakdown } from "./review-platform-breakdown";
import { ReviewPlatformMark } from "./review-platform-mark";

const REPORT_NAV = [
  { id: "overview", label: "Overview" },
  { id: "engagement", label: "Engagement" },
  { id: "growth", label: "Follower growth" },
  { id: "audience", label: "Audience quality" },
  { id: "demographics", label: "Demographics" },
  { id: "historical", label: "Historical" },
] as const;

type ReportNavId = (typeof REPORT_NAV)[number]["id"];

export function AdvancedReportModal({
  open,
  onClose,
  creator,
  brief,
  currency,
  index,
  token,
}: {
  open: boolean;
  onClose: () => void;
  creator: ClientCreatorCard;
  brief: ClientCreatorBrief | null;
  currency: string;
  index: number;
  token: string;
}) {
  const [section, setSection] = useState<ReportNavId>("overview");
  const view = brief?.creatorId === creator.creatorId ? brief : null;
  const audience = view?.audience ?? creator.audience;
  const performance = view?.performance ?? creator.performance;
  const platformRows = breakdownForCreator(creator, view);
  const followers = view?.followers ?? creator.followers;
  const er = view?.engagementRate ?? creator.engagementRate ?? performance?.engagementRate;
  const reach = performance?.estimatedReach ?? creator.estimatedReach;
  const location =
    view?.location || formatLocation(creator.city, creator.country) || DATA_NOT_AVAILABLE;
  const categories = view?.categories.length
    ? view.categories
    : creator.categories?.length
      ? creator.categories
      : [creator.category, creator.niche].filter((value): value is string => Boolean(value));
  const quality = qualityBadge(audience?.qualityLabel);
  const gauge = qualityGaugePercent(audience?.qualityLabel);
  const posts = (view?.contentFeed.length ? view.contentFeed : creator.contentFeed ?? creator.contentExamples) ?? [];
  const deliverableItems = view?.deliverableItems.length ? view.deliverableItems : creator.deliverableItems;
  const historical = view?.historical.length ? view.historical : creator.historical ?? [];
  const match = formatMatchPercent(view?.matchPercent ?? creator.matchPercent);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal open" role="dialog" aria-modal="true" aria-label="Advanced report">
      <div className="report">
        <div className="rp-bar">
          <p className="t">
            Advanced report
            <span className="b">Creator report</span>
          </p>
          <button type="button" className="rp-close" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>
        <div className="rp-head">
          <ReviewAvatar
            className="portrait"
            initialsClassName="ini"
            url={view?.avatarUrl || creator.avatarUrl}
            profileUrl={view?.profileUrl || creator.profileUrl}
            name={view?.displayName || creator.displayName}
            index={index}
            token={token}
          />
          <div className="rp-kpis">
            <div className="rp-kpi platforms">
              <p className="l">Platforms</p>
              <ReviewPlatformBreakdown rows={platformRows} variant="detail" />
            </div>
            <div className="rp-kpi">
              <p className="l">Est. reach</p>
              <p className="v">{formatCompactCount(reach)}</p>
            </div>
          </div>
        </div>
        <nav className="rp-nav">
          {REPORT_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === section ? "on" : undefined}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="rp-body">
          {section === "overview" ? (
            <OverviewSection
              creator={creator}
              view={view}
              location={location}
              categories={categories}
              match={match}
              currency={currency}
              posts={posts}
              token={token}
              followers={followers}
              er={er}
              reach={reach}
              audience={audience}
              historical={historical}
              deliverableItems={deliverableItems}
            />
          ) : null}
          {section === "engagement" ? (
            <EngagementSection
              creator={creator}
              performance={performance}
              posts={posts}
              token={token}
              deliverableItems={deliverableItems}
            />
          ) : null}
          {section === "growth" ? <GrowthSection audience={audience} historical={historical} /> : null}
          {section === "audience" ? (
            <AudienceSection audience={audience} quality={quality} gauge={gauge} />
          ) : null}
          {section === "demographics" ? <DemographicsSection audience={audience} /> : null}
          {section === "historical" ? <HistoricalSection rows={historical} /> : null}
        </div>
      </div>
    </div>
  );
}

function OverviewSection({
  creator,
  view,
  location,
  categories,
  match,
  currency,
  posts,
  token,
  followers,
  er,
  reach,
  audience,
  historical,
  deliverableItems,
}: {
  creator: ClientCreatorCard;
  view: ClientCreatorBrief | null;
  location: string;
  categories: string[];
  match?: string;
  currency: string;
  posts: ClientContentPost[];
  token: string;
  followers?: number;
  er?: number;
  reach?: number;
  audience: ClientCreatorCard["audience"];
  historical: ClientHistoricalMonth[];
  deliverableItems?: ClientDeliverableItem[];
}) {
  const handle = view?.handle || creator.handle;
  const platformRows = breakdownForCreator(creator, view);
  const multiPlatform =
    platformRows.filter((row) => row.platform && row.platform !== "_other").length > 1;
  const platform = multiPlatform
    ? undefined
    : formatPlatformLabel(view?.platform || creator.platform);
  const bio = view?.bio || creator.bio;
  const fit = view?.campaignFit || creator.fitExplanation;
  const erBadge = engagementBadge(er);
  const erGauge = engagementGaugePercent(er);
  const latest = historical.length > 0 ? historical[historical.length - 1] : undefined;
  const followingRatio =
    followers != null && latest?.following != null && latest.following > 0
      ? (followers / latest.following).toFixed(2)
      : undefined;
  const investment =
    (view?.investmentAmount ?? creator.investmentAmount) != null
      ? formatMoneyKpi(
          view?.investmentAmount ?? creator.investmentAmount ?? 0,
          view?.investmentCurrency ?? creator.investmentCurrency ?? currency
        )
      : TO_BE_CONFIRMED;
  return (
    <>
      <div className="rp-sec">
        <p className="st">{handle ? `${handle} · Content categories` : "Content categories"}</p>
        {categories.length > 0 ? (
          <div className="cats">
            {categories.slice(0, 6).map((category) => (
              <div className="catc" key={category}>
                <div className="ic">
                  <IconCat />
                </div>
                <p className="l">{category}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="unavailable">Category unavailable</p>
        )}
      </div>
      {multiPlatform ? null : (
      <div className="rp-sec">
        <p className="st">{platform ? `${platform} engagement rate` : "Engagement rate"}</p>
        <div className="rp-big">
          <span className="n">{formatEngagementPct(er)}</span>
          {erBadge ? <span className={`badge ${erBadge.className}`}>{erBadge.text}</span> : null}
        </div>
        <p className="desc">How much audiences engage with this creator’s available content.</p>
        {erGauge != null ? <QualityGauge percent={erGauge} /> : null}
      </div>
      )}
      <GrowthChart
        title="Follower growth"
        audience={audience}
        historical={historical}
      />
      {followingRatio ? (
        <div className="rp-sec">
          <p className="st">Follower-to-following ratio</p>
          <p className="rp-big">
            <span className="n">{followingRatio}</span>
          </p>
        </div>
      ) : null}
      <div className="rp-sec">
        <p className="st">Profile</p>
        <p className="rp-big">
          <span className="n">{view?.displayName || creator.displayName}</span>
        </p>
        <p className="desc">
          {[`${flagFromCountry(creator.country)} ${location}`.trim()]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="desc" style={{ marginTop: 10 }}>
          {bio?.trim() || DATA_NOT_AVAILABLE}
        </p>
        <ReviewPlatformBreakdown rows={platformRows} variant="detail" />
        <div className="asum" style={{ marginTop: 12 }}>
          <div>
            <p className="l">Est. reach</p>
            <p className={reach != null ? "v" : "v tbc"}>{formatCompactCount(reach)}</p>
          </div>
        </div>
      </div>
      <div className="rp-sec">
        <p className="st">Campaign fit</p>
        {match ? (
          <div className="rp-big">
            <span className="n">{match}</span>
            <span className="badge exc">Match</span>
          </div>
        ) : null}
        <p className="desc">{fit?.trim() || TO_BE_CONFIRMED}</p>
      </div>
      <div className="rp-sec">
        <p className="st">Investment</p>
        <p className="rp-big">
          <span className="n">{investment}</span>
        </p>
      </div>
      <div className="rp-sec">
        <p className="st">Recent content</p>
        <ContentFeatureGrid posts={posts} token={token} deliverableItems={deliverableItems} />
      </div>
    </>
  );
}

function EngagementSection({
  creator,
  performance,
  posts,
  token,
  deliverableItems,
}: {
  creator: ClientCreatorCard;
  performance: ClientCreatorCard["performance"];
  posts: ClientContentPost[];
  token: string;
  deliverableItems?: ClientDeliverableItem[];
}) {
  const likes = performance?.avgLikes ?? creator.avgLikes;
  const comments = performance?.avgComments ?? creator.avgComments;
  const views = performance?.avgViews ?? creator.avgViews;
  const er = performance?.engagementRate ?? creator.engagementRate;
  const reach = performance?.estimatedReach ?? creator.estimatedReach;
  return (
    <div className="rp-sec">
      <p className="st">Engagement</p>
      <div className="trio">
        <Metric label="Avg likes" value={formatCompactCount(likes)} />
        <Metric label="Avg comments" value={formatCompactCount(comments)} />
        <Metric label="Avg views" value={formatCompactCount(views)} />
      </div>
      <div className="duo" style={{ marginTop: 12 }}>
        <Metric label="Engagement rate" value={formatEngagementPct(er)} />
        <Metric label="Est. reach" value={formatCompactCount(reach)} />
      </div>
      <p className="desc" style={{ marginTop: 12 }}>
        {performance?.engagementExplanation ||
          performance?.likesExplanation ||
          "Engagement figures use stored creator performance for this proposal."}
      </p>
      <div style={{ marginTop: 18 }}>
        <p className="st">Content snapshots</p>
        <ContentFeatureGrid posts={posts} token={token} deliverableItems={deliverableItems} />
      </div>
    </div>
  );
}

function GrowthSection({
  audience,
  historical,
}: {
  audience: ClientCreatorCard["audience"];
  historical: ClientHistoricalMonth[];
}) {
  return <GrowthChart title="Follower growth" audience={audience} historical={historical} />;
}

function GrowthChart({
  title,
  audience,
  historical,
}: {
  title: string;
  audience: ClientCreatorCard["audience"];
  historical: ClientHistoricalMonth[];
}) {
  const series = historical.map((row) => row.followers).filter((value): value is number => value != null);
  if (audience?.growthPercent == null && audience?.followerGrowth == null && series.length < 2) {
    return (
      <div className="rp-sec">
        <p className="st">{title}</p>
        <p className="unavailable">Follower growth unavailable</p>
      </div>
    );
  }
  const badge = audience?.growthPercent == null ? undefined : audience.growthPercent >= 0 ? "avg" : "avg";
  return (
    <div className="rp-sec">
      <p className="st">{title}</p>
      {audience?.growthPercent != null ? (
        <div className="rp-big">
          <span className="n">{`${audience.growthPercent > 0 ? "+" : ""}${audience.growthPercent.toFixed(2)}%`}</span>
          <span className={`badge ${badge}`}>{audience.growthTrend && audience.growthTrend !== "Unknown" ? audience.growthTrend : "Recorded"}</span>
        </div>
      ) : null}
      <div className="duo">
        {audience?.followerGrowth != null ? (
          <Metric label="Follower change" value={formatCompactCount(audience.followerGrowth)} />
        ) : null}
        {audience?.growthTrend && audience.growthPercent == null ? (
          <Metric label="Trend" value={audience.growthTrend} />
        ) : null}
      </div>
      {series.length >= 2 ? <FollowerSparkline values={series} /> : null}
      <p className="desc" style={{ marginTop: 12 }}>
        {series.length >= 2
          ? "Chart uses this creator's frozen monthly follower history."
          : "Growth is shown as a verified change only."}
      </p>
    </div>
  );
}

function QualityGauge({ percent }: { percent: number }) {
  return (
    <>
      <div className="gauge">
        <span className="mk" style={{ left: `calc(${percent}% - 2px)` }} />
      </div>
      <div className="gauge-l">
        <span className="lo">Low</span>
        <span>Average</span>
        <span className="hi">Excellent</span>
      </div>
    </>
  );
}

function FollowerSparkline({ values }: { values: number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 36 - ((value - min) / range) * 28;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke="#0057FF" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function AudienceSection({
  audience,
  quality,
  gauge,
}: {
  audience: ClientCreatorCard["audience"];
  quality?: { className: string; text: string };
  gauge?: number;
}) {
  if (!audience) {
    return (
      <div className="rp-sec">
        <p className="st">Audience</p>
        <p className="unavailable">Audience data unavailable</p>
      </div>
    );
  }
  return (
    <>
      <div className="rp-sec">
        <p className="st">Audience quality</p>
        {quality && gauge != null ? (
          <>
            {audience.qualityLabel === "High Quality" || audience.qualityLabel === "Good" ? (
              <div className="aq-ok">
                <IconCheck />
                <div>
                  <b>{quality.text}</b>
                  <div>{audience.summary || "Audience quality is based on verified creator signals for this proposal."}</div>
                </div>
              </div>
            ) : audience.qualityLabel === "Monitor" ? (
              <div className="aq-warn">
                <div className="lft">
                  <IconChart />
                  <div>
                    <b>{quality.text}</b>
                    <div>Audience quality should be reviewed against campaign goals.</div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="bench">
              <span className="n">{quality.text}</span>
              <span className={`badge ${quality.className}`}>{audience.qualityLabel}</span>
            </div>
            <div className="gauge">
              <span className="mk" style={{ left: `calc(${gauge}% - 2px)` }} />
            </div>
            <div className="gauge-l">
              <span className="lo">Low</span>
              <span>Average</span>
              <span className="hi">Excellent</span>
            </div>
          </>
        ) : (
          <p className="unavailable">Audience quality unavailable</p>
        )}
        {audience.summary ? <p className="desc" style={{ marginTop: 12 }}>{audience.summary}</p> : null}
      </div>
      {audience.qualityIndicators?.length ? (
        <div className="rp-sec">
          <p className="st">Audience signals</p>
          <div className="aq-check">
            {audience.qualityIndicators.slice(0, 8).map((item) => (
              <div key={item}>
                <IconCheck />
                {item}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="rp-sec">
        <p className="st">Interests</p>
        {audience.interests.length > 0 ? (
          <div className="cats">
            {audience.interests.slice(0, 6).map((interest) => (
              <div className="catc" key={interest}>
                <div className="ic">
                  <IconChart />
                </div>
                <p className="l">{interest}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="unavailable">Interests unavailable</p>
        )}
      </div>
    </>
  );
}

function DemographicsSection({ audience }: { audience: ClientCreatorCard["audience"] }) {
  if (!audience || (audience.ages.length === 0 && audience.genders.length === 0 && audience.locations.length === 0)) {
    return (
      <div className="rp-sec">
        <p className="st">Demographics</p>
        <p className="unavailable">Demographics unavailable</p>
      </div>
    );
  }
  const female = audience.genders.find((slice) => /female|women/i.test(slice.label));
  const male = audience.genders.find((slice) => /male|men/i.test(slice.label) && !/female/i.test(slice.label));
  return (
    <div className="demo">
      <div>
        <p className="st">Age</p>
        {audience.ages.length > 0 ? <SliceBars items={audience.ages} /> : <p className="unavailable">Age unavailable</p>}
        <p className="st" style={{ marginTop: 22 }}>
          Gender
        </p>
        {female?.percent != null || male?.percent != null ? (
          <>
            <div className="gsplit">
              <span className="f" style={{ width: `${female?.percent ?? 0}%` }} />
              <span className="m" style={{ width: `${male?.percent ?? 0}%` }} />
            </div>
            <div className="glabels">
              <span>
                Female <b>{female?.percent != null ? `${Math.round(female.percent)}%` : NOT_AVAILABLE}</b>
              </span>
              <span>
                Male <b>{male?.percent != null ? `${Math.round(male.percent)}%` : NOT_AVAILABLE}</b>
              </span>
            </div>
          </>
        ) : audience.genders.length > 0 ? (
          <SliceBars items={audience.genders} />
        ) : (
          <p className="unavailable">Gender unavailable</p>
        )}
      </div>
      <div>
        <p className="st">Locations</p>
        {audience.locations.length > 0 ? (
          <SliceBars items={audience.locations} />
        ) : (
          <p className="unavailable">Location mix unavailable</p>
        )}
      </div>
    </div>
  );
}

function SliceBars({ items }: { items: ClientAudienceSlice[] }) {
  const max = Math.max(...items.map((item) => item.percent ?? 0), 1);
  return (
    <div className="barset">
      {items.map((item) => (
        <div className="bar" key={item.label}>
          <span className="bl">{item.label}</span>
          <span className="bt">
            <span className="bf" style={{ width: `${((item.percent ?? 0) / max) * 100}%` }} />
          </span>
          <span className="bn">{item.percent != null ? `${Math.round(item.percent)}%` : "—"}</span>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mc">
      <p className="l">{label}</p>
      <p className="v sm">{value}</p>
    </div>
  );
}

function HistoricalSection({ rows }: { rows: ClientHistoricalMonth[] }) {
  if (rows.length === 0) {
    return (
      <div className="rp-sec">
        <p className="st">Historical</p>
        <p className="unavailable">Historical performance series unavailable</p>
      </div>
    );
  }
  return (
    <div className="rp-sec">
      <p className="st">Historical</p>
      <div className="histtbl">
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th className="r">Followers</th>
              <th className="r">Growth</th>
              <th className="r">Following</th>
              <th className="r">Posts</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((row) => (
              <tr key={row.periodMonth}>
                <td>{row.periodMonth.slice(0, 7)}</td>
                <td className="r">{formatCompactCount(row.followers)}</td>
                <td className={row.monthlyGrowthRate != null && row.monthlyGrowthRate < 0 ? "r down" : "r up"}>
                  {row.monthlyGrowthRate != null
                    ? `${row.monthlyGrowthRate > 0 ? "+" : ""}${(row.monthlyGrowthRate * (Math.abs(row.monthlyGrowthRate) <= 1 ? 100 : 1)).toFixed(2)}%`
                    : NOT_AVAILABLE}
                </td>
                <td className="r">{formatCompactCount(row.following)}</td>
                <td className="r">{formatCompactCount(row.postsCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function isInstagram(platform?: string): boolean {
  return platform?.trim().toLowerCase() === "instagram";
}

export function ContentFeatureGrid({
  posts,
  token,
  variant = "feature",
  deliverableItems,
}: {
  posts: ClientContentPost[];
  token?: string;
  variant?: "feature" | "square";
  deliverableItems?: ClientDeliverableItem[];
}) {
  const mixed = mixPostsForDeliverables(posts, deliverableItems, 6);
  if (mixed.length === 0) {
    return <p className="unavailable">Recent content unavailable</p>;
  }
  return (
    <div className={variant === "square" ? "posts" : "posts-feat"}>
      {mixed.map((post, index) => {
        const className = variant === "feature" && index === 0 ? "post big" : "post";
        const display = token ? clientReviewPostDisplay(token, post) : { thumbnail: post.thumbnail ?? undefined, href: post.url ?? undefined };
        const src = display.thumbnail;
        const platform = resolveContentPostPlatform(post);
        const inner = (
          <>
            {src ? <RetryableReviewImage src={src} /> : null}
            {platform ? (
              <span className="plat-badge" title={platform}>
                <ReviewPlatformMark platform={platform} />
              </span>
            ) : null}
            <span className="lk">
              <IconHeart />
              {post.likes != null ? formatCompactCount(post.likes) : NOT_AVAILABLE}
            </span>
          </>
        );
        const key = `${post.url ?? post.thumbnail ?? index}`;
        return display.href ? (
          <a key={key} className={className} href={display.href} target="_blank" rel="noreferrer">
            {inner}
          </a>
        ) : (
          <div key={key} className={className}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
