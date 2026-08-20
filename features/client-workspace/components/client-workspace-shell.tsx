"use client";

import type { ClientReviewStatus, ClientWorkspaceSectionId } from "../constants";
import { CLIENT_PROPOSAL_STATUS_LABEL, CLIENT_WORKSPACE_SECTION_LABEL } from "../constants";
import { QUOTATION_STAGE_LABEL, SHORTLIST_STAGE_LABEL } from "../journey-state";
import { buildClientReviewPath } from "../security/review-token";
import type { ClientWorkspaceView } from "../types";
import { ClientJourneyStrip } from "./journey-strip";
import { IconCheck, LogoMark } from "./review-icons";
import { ReviewUpdateBanner } from "./review-update-banner";

export function ClientWorkspaceShell({
  view,
  token,
  section,
  onSectionChange,
  children,
}: {
  view: ClientWorkspaceView;
  token: string;
  section: ClientWorkspaceSectionId;
  onSectionChange: (section: ClientWorkspaceSectionId) => void;
  children: React.ReactNode;
}) {
  const preparedFor = view.overview.clientLabel?.trim() || view.overview.campaignName;
  const pathReviewId = view.journey?.canonicalReviewId ?? view.review.id;
  const quotationLabel = view.journey ? QUOTATION_STAGE_LABEL[view.journey.quotationStage] : CLIENT_PROPOSAL_STATUS_LABEL[view.review.status];
  const shortlistLabel = view.journey ? SHORTLIST_STAGE_LABEL[view.journey.shortlistStage] : null;
  const statusTone = statusPillTone(view.review.status);
  const primaryHref = buildClientReviewPath(pathReviewId, token, "approval");
  const primaryLabel = view.journey?.canApproveQuotation
    ? "Approve Quotation"
    : view.journey?.canApproveShortlist
      ? "Approve Shortlist"
      : null;

  function openSection(event: React.MouseEvent<HTMLAnchorElement>, next: ClientWorkspaceSectionId) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onSectionChange(next);
  }

  return (
    <div className="tw-review">
      <header className="bar">
        <div className="wrap row">
          <div className="logo">
            <LogoMark />
            <b>
              THINK<span>WAY</span>
            </b>
          </div>
          <div className="camp">
            <b>{view.overview.campaignName}</b>
          </div>
          <div className="sp" />
          <span className={`stpill ${statusTone}`}>{quotationLabel}</span>
          {shortlistLabel ? <span className="stpill cur">Shortlist · {shortlistLabel}</span> : null}
          <span className="stpill cur">
            {view.newerReviewNumber ? `Updated · v${view.newerReviewNumber}` : `Current · v${view.review.reviewNumber}`}
          </span>
          {view.canDecide && primaryLabel ? (
            <>
              <a
                className="btn sec"
                href={buildClientReviewPath(pathReviewId, token, "feedback")}
                onClick={(event) => openSection(event, "feedback")}
              >
                Request changes
              </a>
              <a
                className="btn pri"
                href={primaryHref}
                onClick={(event) => openSection(event, "approval")}
              >
                <IconCheck />
                {primaryLabel}
              </a>
            </>
          ) : null}
        </div>
      </header>
      <div className="tw-review-body">
        <ClientJourneyStrip view={view} />
        {view.clientUpdate?.items.length ? (
          <ReviewUpdateBanner
            reviewId={view.review.id}
            token={token}
            updatedAt={view.clientUpdate.updatedAt}
            items={view.clientUpdate.items}
          />
        ) : null}

        <nav className="tabs">
          <div className="wrap row">
            {view.visibleSections.map((item) => (
              <a
                key={item}
                href={buildClientReviewPath(pathReviewId, token, item)}
                className={item === section ? "tab on" : "tab"}
                onClick={(event) => openSection(event, item)}
              >
                {CLIENT_WORKSPACE_SECTION_LABEL[item]}
              </a>
            ))}
          </div>
        </nav>

        <main className="wrap main">{children}</main>
        <p className="foot">
          Confidential · Thinkway Platform
          {preparedFor ? ` · Prepared for ${preparedFor}` : ""}
        </p>
      </div>
    </div>
  );
}

function statusPillTone(status: ClientReviewStatus): "rev" | "cur" | "ok" | "bad" {
  if (status === "approved") return "ok";
  if (status === "rejected" || status === "revoked") return "bad";
  if (status === "awaiting_review" || status === "changes_requested") return "rev";
  return "cur";
}
