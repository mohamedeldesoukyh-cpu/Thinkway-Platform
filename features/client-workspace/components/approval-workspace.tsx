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
import { campaignRosterFallback, clientCampaignViewKind, emptyClientCampaignExecution, overlayCampaignPostAvatars } from "../campaign-execution";
import { approvalWorkspaceKind } from "../journey-state";
import { emptyClientCampaignContent } from "../content-approval";
import {
  CAMPAIGN_SETTING_UP_COPY,
  INVALID_ZERO_SELECTION_APPROVAL_MESSAGE,
  isValidClientCommercialApproval,
} from "../selection-flow";
import { countSelections } from "../status";
import type { ClientWorkspaceView } from "../types";
import { CampaignDashboard } from "./campaign-dashboard";
import { CampaignScriptSection } from "./campaign-script-section";
import { useClientWorkspaceState } from "./client-workspace-state";

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
  const executionPosts = execution.posts;
  const contentItems = (view.campaignContent ?? emptyClientCampaignContent()).items;
  const rawPosts =
    executionPosts.length > 0
      ? executionPosts
      : commerciallyApproved
        ? campaignRosterFallback(selectedCreators)
        : [];
  const posts = overlayCampaignPostAvatars(rawPosts, view.creators);

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
      <>
        <div className="card">
          <p className="ck">Campaign</p>
          <h2>{view.overview.campaignName}</h2>
          <p className="note">{CAMPAIGN_SETTING_UP_COPY}</p>
        </div>
        {journey?.campaignHeaderId ? <CampaignScriptSection token={token} /> : null}
      </>
    );
  }

  return (
    <>
      <CampaignDashboard
        campaignName={view.overview.campaignName}
        clientLabel={view.overview.clientLabel}
        creatorCount={view.overview.creatorCount}
        updatedAt={view.review.updatedAt}
        reviewNumber={view.review.reviewNumber}
        historical={Boolean(journey?.historical)}
        newerReviewNumber={view.newerReviewNumber}
        inCampaign={kind === "in_campaign"}
        posts={posts}
        contentItems={contentItems}
        creators={view.creators}
        token={token}
        campaignStartDate={execution.startDate}
        campaignEndDate={execution.endDate}
      />
      <CampaignChangeActions view={view} token={token} />
    </>
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
