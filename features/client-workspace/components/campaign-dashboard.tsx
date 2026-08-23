"use client";

import {
  CLIENT_CAMPAIGN_POST_STATUS_LABEL,
  formatClientCampaignPerformance,
  formatClientDashboardDate,
  formatClientScheduleDate,
  type ClientCampaignPostRow,
} from "../campaign-execution";
import {
  CAMPAIGN_SETUP_IN_PROGRESS_COPY,
  NO_OVERDUE_PUBLICATIONS_COPY,
  NO_UPCOMING_PUBLICATIONS_COPY,
  PERFORMANCE_PENDING_COPY,
  projectClientCampaignDashboard,
  type ClientCampaignDashboardCounts,
} from "../campaign-dashboard";
import { NOT_AVAILABLE, TO_BE_CONFIRMED } from "../format";
import type { ClientContentReviewItem } from "../content-approval";
import { ContentToReview } from "./content-to-review";
import { ReviewPlatformMark } from "./review-platform-mark";

const OVERVIEW_KPIS: Array<{ key: keyof ClientCampaignDashboardCounts; label: string }> = [
  { key: "approvedCreators", label: "Approved Creators" },
  { key: "scheduled", label: "Scheduled" },
  { key: "dueToday", label: "Due Today" },
  { key: "live", label: "Live" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

function campaignStatusClass(row: ClientCampaignPostRow): string {
  if (row.status === "live" || row.status === "completed") return "sc ok";
  if (row.status === "overdue") return "sc rej";
  return "sc";
}

export function CampaignDashboard({
  campaignName,
  posts,
  contentItems,
  token,
}: {
  campaignName: string;
  posts: ClientCampaignPostRow[];
  contentItems: ClientContentReviewItem[];
  token: string;
}) {
  const dashboard = projectClientCampaignDashboard(posts);
  const contentSection = <ContentToReview items={contentItems} token={token} />;

  if (!dashboard.ready) {
    return (
      <>
        <div className="card">
          <p className="ck">Campaign</p>
          <h2>{campaignName}</h2>
          <p className="note">{CAMPAIGN_SETUP_IN_PROGRESS_COPY}</p>
        </div>
        {contentSection}
      </>
    );
  }

  const { counts, progress, upcoming, live, overdue, performanceMetrics } = dashboard;

  return (
    <>
      <div className="card">
        <p className="ck">Campaign</p>
        <h2>{campaignName}</h2>
        <p className="note">Campaign progress from the Thinkway campaign publication plan.</p>
        <div className="kpis">
          {OVERVIEW_KPIS.map((item) => (
            <div className="kpi" key={item.key}>
              <p className="kl">{item.label}</p>
              <p className="kv">{counts[item.key]}</p>
            </div>
          ))}
        </div>
        {progress ? (
          <div className="camp-progress">
            <p className="ck">Campaign Progress</p>
            <p className="hl">{progress.headline}</p>
            <div className="track" aria-hidden="true">
              <div className="fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="note">
              {progress.percent}% · {progress.explanation}
            </p>
          </div>
        ) : null}
      </div>

      <div className="camp-dash-split">
        <div className="card">
          <p className="ck">Upcoming</p>
          <h2>Next publications</h2>
          {upcoming.length > 0 ? (
            <div className="tbl-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Creator</th>
                    <th>Deliverable</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((row) => (
                    <tr key={`upcoming:${row.id}`}>
                      <td className="name">{row.creatorName}</td>
                      <td>{row.deliverable || TO_BE_CONFIRMED}</td>
                      <td>{formatClientDashboardDate(row.scheduledDate) ?? TO_BE_CONFIRMED}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="note">{NO_UPCOMING_PUBLICATIONS_COPY}</p>
          )}
        </div>

        <div className="card">
          <p className="ck">Overdue</p>
          <h2>Overdue publications</h2>
          {overdue.length > 0 ? (
            <div className="tbl-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Creator</th>
                    <th>Deliverable</th>
                    <th>Scheduled date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((row) => (
                    <tr key={`overdue:${row.id}`}>
                      <td className="name">{row.creatorName}</td>
                      <td>{row.deliverable || TO_BE_CONFIRMED}</td>
                      <td>{formatClientScheduleDate(row.scheduledDate) ?? TO_BE_CONFIRMED}</td>
                      <td>
                        <span className={campaignStatusClass(row)}>
                          {CLIENT_CAMPAIGN_POST_STATUS_LABEL[row.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="note">{NO_OVERDUE_PUBLICATIONS_COPY}</p>
          )}
        </div>
      </div>

      {contentSection}

      {live.length > 0 ? (
        <div className="card">
          <p className="ck">Live</p>
          <h2>Live campaign</h2>
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Platform</th>
                  <th>Deliverable</th>
                  <th>Published date</th>
                  <th>View publication</th>
                  <th>Available performance</th>
                </tr>
              </thead>
              <tbody>
                {live.map((row) => (
                  <tr key={`live:${row.id}`}>
                    <td className="name">{row.creatorName}</td>
                    <td>
                      {row.platform ? (
                        <span className="ov-plat-row" title={row.platformLabel || row.platform}>
                          <span className="ov-pav ov-pav-sm">
                            <ReviewPlatformMark platform={row.platform || row.platformLabel} />
                          </span>
                          {row.platformLabel || row.platform}
                        </span>
                      ) : (
                        TO_BE_CONFIRMED
                      )}
                    </td>
                    <td>{row.deliverable || TO_BE_CONFIRMED}</td>
                    <td>{formatClientDashboardDate(row.publicationDate) ?? NOT_AVAILABLE}</td>
                    <td>
                      {row.contentUrl ? (
                        <a href={row.contentUrl} target="_blank" rel="noopener noreferrer">
                          View publication
                        </a>
                      ) : (
                        NOT_AVAILABLE
                      )}
                    </td>
                    <td>{formatClientCampaignPerformance(row.performance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="card">
        <p className="ck">Performance</p>
        <h2>Campaign performance</h2>
        {performanceMetrics.length > 0 ? (
          <div className="camp-perf">
            {performanceMetrics.map((metric) => (
              <div className="mc" key={metric.key}>
                <p className="l">{metric.label}</p>
                <p className="v">{metric.formatted}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="note">{PERFORMANCE_PENDING_COPY}</p>
        )}
      </div>
    </>
  );
}
