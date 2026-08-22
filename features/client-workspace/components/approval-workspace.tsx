"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  decideReviewAction,
  requestReviewChangesAction,
} from "../actions/client-workspace-actions";
import {
  CLIENT_CHANGE_AREAS,
  CLIENT_CHANGE_AREA_LABEL,
  type ClientChangeArea,
} from "../constants";
import { NOT_AVAILABLE, TO_BE_CONFIRMED } from "../format";
import {
  campaignRosterFallback,
  clientCampaignGlanceCounts,
  clientCampaignViewKind,
  CLIENT_CAMPAIGN_POST_STATUS_LABEL,
  emptyClientCampaignExecution,
  formatClientCampaignPerformance,
  formatClientScheduleDate,
  groupClientCampaignPosts,
  type ClientCampaignPostRow,
} from "../campaign-execution";
import { approvalWorkspaceKind } from "../journey-state";
import {
  CAMPAIGN_SETTING_UP_COPY,
  INVALID_ZERO_SELECTION_APPROVAL_MESSAGE,
  isValidClientCommercialApproval,
} from "../selection-flow";
import { countSelections } from "../status";
import type { ClientWorkspaceView } from "../types";
import { useClientWorkspaceState } from "./client-workspace-state";
import { ReviewPlatformMark } from "./review-platform-mark";

export function ApprovalWorkspace({
  view,
  token,
}: {
  view: ClientWorkspaceView;
  token: string;
}) {
  const { selection, selectedCreators, goToSection } = useClientWorkspaceState();
  const counts = countSelections(
    selection,
    view.creators.map((creator) => creator.creatorId)
  );
  const journey = view.journey;
  const quotationStage = journey?.quotationStage ?? "draft";
  const commerciallyApproved = isValidClientCommercialApproval({
    quotationStage,
    selectedCount: counts.accepted,
  });
  const kind = clientCampaignViewKind({
    commerciallyApproved,
    campaignStarted: Boolean(journey?.campaignStarted),
  });
  const approvalKind = approvalWorkspaceKind({
    historical: Boolean(journey?.historical),
    quotationStage,
    canApproveShortlist: Boolean(journey?.canApproveShortlist),
    canApproveQuotation: Boolean(journey?.canApproveQuotation),
    selectedCount: counts.accepted,
  });
  const execution = view.campaignExecution ?? emptyClientCampaignExecution();
  const posts =
    execution.posts.length > 0
      ? execution.posts
      : commerciallyApproved
        ? campaignRosterFallback(selectedCreators)
        : [];
  const glance = clientCampaignGlanceCounts(posts);
  const groups = groupClientCampaignPosts(posts);

  if (approvalKind === "historical") {
    const approvedOn = view.review.approvedAt
      ? new Date(view.review.approvedAt).toLocaleDateString("en-GB")
      : null;
    const versionLabel =
      view.review.source === "quotation"
        ? `Quotation v${view.review.reviewNumber}`
        : `Shortlist v${view.review.reviewNumber}`;
    return (
      <div className="card">
        <p className="ck">Historical version</p>
        <h2>
          {versionLabel} · Historical / Superseded
        </h2>
        <p className="note">
          Historical / Superseded · Read only.
          {approvedOn ? ` Approved on ${approvedOn}.` : ""} This version is not the current journey
          and cannot be approved, rejected, or sent for changes.
        </p>
      </div>
    );
  }

  if (quotationStage === "approved" && counts.accepted === 0) {
    return (
      <div className="card">
        <p className="ck">Campaign</p>
        <h2>Selection required</h2>
        <p className="note">{INVALID_ZERO_SELECTION_APPROVAL_MESSAGE}</p>
      </div>
    );
  }

  if (kind === "needs_quotation_approval") {
    return (
      <>
        <div className="card">
          <p className="ck">Campaign</p>
          <h2>Final quotation approval required</h2>
          <p className="note">
            Creator selection is confirmed. Approve the final quotation on Commercial to let Thinkway
            set up this campaign.
          </p>
          <div className="dacts" style={{ justifyContent: "flex-start", marginTop: 18 }}>
            <button type="button" className="btn pri" onClick={() => goToSection("commercial")}>
              Review Commercial
            </button>
          </div>
        </div>
        <CampaignChangeActions view={view} token={token} />
      </>
    );
  }

  if (kind === "setting_up") {
    return (
      <div className="card">
        <p className="ck">Campaign</p>
        <h2>{view.overview.campaignName}</h2>
        <p className="note">{CAMPAIGN_SETTING_UP_COPY}</p>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <p className="ck">Campaign</p>
        <h2>{view.overview.campaignName}</h2>
        <p className="note">
          Approved creators and publication schedule from the Thinkway campaign. Scheduled time of
          day is added when it exists on the campaign.
        </p>
        <div className="glance" style={{ marginTop: 18 }}>
          <div className="gi">
            <p className="l">Approved creators</p>
            <p className="v">{selectedCreators.length}</p>
          </div>
          <div className="gi">
            <p className="l">Upcoming</p>
            <p className="v">{glance.upcoming}</p>
          </div>
          <div className="gi">
            <p className="l">Overdue</p>
            <p className="v">{glance.overdue}</p>
          </div>
          <div className="gi">
            <p className="l">Live</p>
            <p className="v">{glance.live}</p>
          </div>
          <div className="gi">
            <p className="l">Completed</p>
            <p className="v">{glance.completed}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="ck">Publication plan</p>
        <h2>Creators and go-live</h2>
        {groups.length > 0 ? (
          groups.map((group) => (
            <div key={group.id} style={{ marginTop: group.id === groups[0]?.id ? 0 : 22 }}>
              <p className="ck">{group.label}</p>
              <CampaignExecutionTable rows={group.posts} />
            </div>
          ))
        ) : (
          <p className="note">{CAMPAIGN_SETTING_UP_COPY}</p>
        )}
      </div>
      <CampaignChangeActions view={view} token={token} />
    </>
  );
}

function campaignStatusClass(row: ClientCampaignPostRow): string {
  if (row.status === "live" || row.status === "completed") return "sc ok";
  if (row.status === "overdue") return "sc rej";
  return "sc";
}

function CampaignExecutionTable({ rows }: { rows: ClientCampaignPostRow[] }) {
  return (
    <div className="tbl-scroll">
      <table className="tbl">
        <thead>
          <tr>
            <th>Creator</th>
            <th>Platform</th>
            <th>Deliverable</th>
            <th>Scheduled</th>
            <th>Status</th>
            <th>Publication date</th>
            <th>Published content</th>
            <th>Performance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
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
              <td>{formatClientScheduleDate(row.scheduledDate) ?? TO_BE_CONFIRMED}</td>
              <td>
                <span className={campaignStatusClass(row)}>
                  {CLIENT_CAMPAIGN_POST_STATUS_LABEL[row.status]}
                </span>
              </td>
              <td>{formatClientScheduleDate(row.publicationDate) ?? NOT_AVAILABLE}</td>
              <td>
                {row.contentUrl ? (
                  <a href={row.contentUrl} target="_blank" rel="noopener noreferrer">
                    View post
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
  );
}

function CampaignChangeActions({
  view,
  token,
}: {
  view: ClientWorkspaceView;
  token: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [areas, setAreas] = useState<ClientChangeArea[]>(["campaign"]);
  const [error, setError] = useState<string | null>(null);
  const journey = view.journey;
  if (!journey?.canRequestQuotationChanges && !journey?.canRejectQuotation) return null;

  function toggle(area: ClientChangeArea) {
    setAreas((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : [...current, area]
    );
  }

  return (
    <>
      {journey?.canRequestQuotationChanges ? (
        <div className="card">
          <p className="ck">Request changes</p>
          <h2>Tell Thinkway what to update</h2>
          <div className="catchips">
            {CLIENT_CHANGE_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                className={areas.includes(area) ? "catchip on" : "catchip"}
                onClick={() => toggle(area)}
              >
                {CLIENT_CHANGE_AREA_LABEL[area]}
              </button>
            ))}
          </div>
          <textarea
            className="f"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="What needs to change?"
          />
          <div style={{ height: 14 }} />
          <button
            type="button"
            className="btn sec"
            disabled={pending || !summary.trim()}
            onClick={() =>
              startTransition(async () => {
                await requestReviewChangesAction({
                  token,
                  summary,
                  areas,
                  stage: "quotation",
                });
                router.refresh();
              })
            }
          >
            Send request
          </button>
        </div>
      ) : null}
      {journey?.canRejectQuotation ? (
        <div className="card">
          <p className="ck" style={{ color: "var(--bad)" }}>
            Reject quotation
          </p>
          <h2>Rejecting the quotation does not reject the shortlist</h2>
          <textarea
            className="f"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Why is this quotation being rejected?"
          />
          {error ? <p style={{ color: "var(--bad)", fontSize: 13 }}>{error}</p> : null}
          <div className="dacts" style={{ justifyContent: "flex-start", marginTop: 14 }}>
            <button
              type="button"
              className="btn no"
              disabled={pending || !rejectReason.trim()}
              onClick={() =>
                startTransition(async () => {
                  const result = await decideReviewAction({
                    token,
                    decision: "rejected",
                    reason: rejectReason,
                    stage: "quotation",
                  });
                  if (!result.ok) setError(result.message);
                  router.refresh();
                })
              }
            >
              Reject quotation
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
