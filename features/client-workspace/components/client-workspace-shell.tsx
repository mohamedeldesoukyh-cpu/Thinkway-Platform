"use client";

import type { ClientWorkspaceSectionId } from "../constants";
import { CLIENT_WORKSPACE_SECTION_LABEL } from "../constants";
import { SHORTLIST_STAGE_LABEL, clientWorkspacePathReviewId, clientWorkspaceVersionPill } from "../journey-state";
import {
  commercialStageCopy,
  headerJourneyCta,
  isPricedClientInvestment,
  selectionCalculator,
} from "../selection-flow";
import { buildClientReviewPath } from "../security/review-token";
import type { ClientWorkspaceView } from "../types";
import { ClientJourneyStrip } from "./journey-strip";
import { useClientWorkspaceState } from "./client-workspace-state";
import { ClientWorkspaceIdentityMark } from "./identity-logo-mark";
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
  const { selection } = useClientWorkspaceState();
  const calc = selectionCalculator(view.creators, selection);
  const preparedFor = view.overview.clientLabel?.trim() || view.overview.campaignName;
  const pathReviewId = clientWorkspacePathReviewId({
    historical: Boolean(view.journey?.historical),
    viewedReviewId: view.review.id,
    canonicalReviewId: view.journey?.canonicalReviewId,
  });
  const commercialCopy = view.journey
    ? commercialStageCopy({
        quotationStage: view.journey.quotationStage,
        selectedCount: calc.selectedCount,
        pricedSelectedCount: calc.pricedSelectedCount,
        pricedInvestment: calc.pricedInvestment,
        currency: view.commercial.currency,
        selectionConfirmed: Boolean(view.journey.selectionConfirmed),
        hasAnyPrice: view.creators.some((creator) => isPricedClientInvestment(creator.investmentAmount)),
        pendingCommercialApproval: Boolean(view.journey.pendingCommercialApprovalCreatorIds?.length),
      })
    : { label: "In Review", tone: "active" as const };
  const quotationLabel = commercialCopy.label;
  const shortlistLabel = view.journey ? SHORTLIST_STAGE_LABEL[view.journey.shortlistStage] : null;
  const statusTone = view.journey?.historical ? "cur" : journeyToneToPill(commercialCopy.tone);
  const versionLabel = clientWorkspaceVersionPill({
    historical: Boolean(view.journey?.historical),
    reviewNumber: view.review.reviewNumber,
    newerReviewNumber: view.newerReviewNumber,
  });
  const headerCta = headerJourneyCta({
    canApproveFinalQuotation: Boolean(view.journey?.canApproveFinalQuotation),
    pendingCommercialApproval: Boolean(view.journey?.pendingCommercialApprovalCreatorIds?.length),
  });
  const hideHeaderCtaOn = headerCta.section;
  const showHeaderSelectionNav = Boolean(view.canDecide && section !== hideHeaderCtaOn);
  const headerHref = buildClientReviewPath(pathReviewId, token, headerCta.section);

  function openSection(event: React.MouseEvent<HTMLAnchorElement>, next: ClientWorkspaceSectionId) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onSectionChange(next);
  }

  return (
    <div className="tw-review">
      <header className="bar">
        <div className="wrap row">
          <ClientWorkspaceIdentityMark identityLogo={view.identityLogo} />
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
          {view.canDecide ? (
            <>
              <a
                className="btn sec"
                href={buildClientReviewPath(pathReviewId, token, "feedback")}
                onClick={(event) => openSection(event, "feedback")}
              >
                Request changes
              </a>
              {showHeaderSelectionNav ? (
                <a
                  className="btn sec"
                  href={headerHref}
                  onClick={(event) => openSection(event, headerCta.section)}
                >
                  {headerCta.label}
                </a>
              ) : null}
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

function journeyToneToPill(tone: "idle" | "active" | "attention" | "ok" | "bad"): "rev" | "cur" | "ok" | "bad" {
  if (tone === "ok") return "ok";
  if (tone === "bad") return "bad";
  if (tone === "attention" || tone === "active") return "rev";
  return "cur";
}
