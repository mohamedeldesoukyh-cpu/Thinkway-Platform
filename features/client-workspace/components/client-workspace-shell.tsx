"use client";

import type { ClientReviewStatus, ClientWorkspaceSectionId } from "../constants";
import { CLIENT_PROPOSAL_STATUS_LABEL, CLIENT_WORKSPACE_SECTION_LABEL } from "../constants";
import { QUOTATION_STAGE_LABEL, SHORTLIST_STAGE_LABEL, clientWorkspacePathReviewId, clientWorkspaceVersionPill } from "../journey-state";
import { primaryActionForJourney } from "../selection-flow";
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
  const pathReviewId = clientWorkspacePathReviewId({
    historical: Boolean(view.journey?.historical),
    viewedReviewId: view.review.id,
    canonicalReviewId: view.journey?.canonicalReviewId,
  });
  const quotationLabel = view.journey ? QUOTATION_STAGE_LABEL[view.journey.quotationStage] : CLIENT_PROPOSAL_STATUS_LABEL[view.review.status];
  const shortlistLabel = view.journey ? SHORTLIST_STAGE_LABEL[view.journey.shortlistStage] : null;
  const statusTone = view.journey?.historical ? "cur" : statusPillTone(view.review.status);
  const versionLabel = clientWorkspaceVersionPill({
    historical: Boolean(view.journey?.historical),
    reviewNumber: view.review.reviewNumber,
    newerReviewNumber: view.newerReviewNumber,
  });
  const primary = primaryActionForJourney({
    canConfirmCreators: Boolean(view.journey?.canConfirmCreators),
    canApproveFinalQuotation: Boolean(view.journey?.canApproveFinalQuotation),
  });
  const primaryHref = buildClientReviewPath(
    pathReviewId,
    token,
    primary.kind === "confirm" ? "creators" : "approval"
  );
  const primaryLabel = primary.kind ? primary.label : null;

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
          {view.journey?.historical ? <span className="stpill cur">Read only</span> : null}
          {shortlistLabel && !view.journey?.historical ? (
            <span className="stpill cur">Shortlist · {shortlistLabel}</span>
          ) : null}
          <span className="stpill cur">{versionLabel}</span>
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
                onClick={(event) =>
                  openSection(event, primary.kind === "confirm" ? "creators" : "approval")
                }
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
