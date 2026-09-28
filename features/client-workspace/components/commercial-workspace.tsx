"use client";

import { CommercialInvestment } from "./commercial-investment";


import { clientCreatorIdentity, DELIVERABLES_TO_BE_CONFIRMED, formatHandleLabel, TO_BE_CONFIRMED } from "../format";
import { deliverablesLabel } from "../deliverables";
import {
  canOpenCommercialWorkspace,
  clientQuotationCommercialView,
  commercialLockedUntilCreatorApprovalMessage,
  consolidationContract,
  PRICE_PENDING_LABEL,
  REVIEW_YOUR_SELECTION_LABEL,
  UNPRICED_INCLUDED_MESSAGE,
} from "../selection-flow";
import type { ClientWorkspaceView } from "../types";
import { useClientWorkspaceState } from "./client-workspace-state";
import { CommercialQuotationDelivery } from "./commercial-quotation-delivery";
import { CommercialClientIo } from "./commercial-client-io";
import { FinalQuotationApprovalCard } from "./final-quotation-approval-card";
import { ReviewAvatar } from "./review-avatar";

export function CommercialWorkspace({
  view,
  token,
}: {
  view: ClientWorkspaceView;
  token?: string;
}) {
  const { goToSection } = useClientWorkspaceState();
  const commercialOpen = canOpenCommercialWorkspace({
    selectionConfirmed: view.journey?.selectionConfirmed,
    historical: view.journey?.historical,
    quotationStage: view.journey?.quotationStage,
  });

  if (!commercialOpen) {
    return (
      <div className="card">
        <p className="ck">Commercial</p>
        <h2>Awaiting creator approval</h2>
        <p className="note">{commercialLockedUntilCreatorApprovalMessage(Boolean(view.hideCostAndFees))}</p>
        <div className="dacts" style={{ justifyContent: "flex-start", marginTop: 18 }}>
          <button type="button" className="btn pri" onClick={() => goToSection("creators")}>
            {REVIEW_YOUR_SELECTION_LABEL}
          </button>
        </div>
      </div>
    );
  }

  const quotationView = clientQuotationCommercialView(view.creators, view.journey?.clientSelection);
  const creatorsById = new Map(view.creators.map((creator) => [creator.creatorId, creator]));
  const included = quotationView.original.creatorIds
    .map((id) => creatorsById.get(id))
    .filter((creator): creator is NonNullable<typeof creator> => Boolean(creator));
  const pricingRequired = quotationView.pricingRequiredIds
    .map((id) => creatorsById.get(id))
    .filter((creator): creator is NonNullable<typeof creator> => Boolean(creator));
  return (
    <div className="cm-commercial">
      <CommercialInvestment view={view} />
      {quotationView.pendingCommercialApprovalIds.length > 0 ? (
        <div className="card">
          <p className="ck">New pricing</p>
          <h2>Approve newly priced creators on Your Selection</h2>
          <p className="note">
            Thinkway confirmed pricing for {quotationView.pendingCommercialApprovalIds.length === 1 ? "a creator" : "creators"}{" "}
            who were not priced at approval. Select them on Your Selection and Approve Selected Creators
            before they appear here. This does not automatically add them to the quotation.
          </p>
          <div className="dacts" style={{ justifyContent: "flex-start", marginTop: 18 }}>
            <button type="button" className="btn pri" onClick={() => goToSection("creators")}>
              {REVIEW_YOUR_SELECTION_LABEL}
            </button>
          </div>
        </div>
      ) : null}

      {pricingRequired.length > 0 ? (
      <div className="card">
        <p className="ck">Pricing required</p>
        <h2>Client Approved · to be confirmed</h2>
        <p className="note">
          This creator is part of your approved selection but is not included in the current quotation
          because pricing has not yet been confirmed.
        </p>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Deliverables</th>
                <th className="r">Investment</th>
              </tr>
            </thead>
            <tbody>
              {pricingRequired.map((creator, index) => {
                  const identity = clientCreatorIdentity(creator.displayName, creator.handle);
                  return (
                <tr key={creator.creatorId}>
                  <td>
                    <div className="cn">
                      <ReviewAvatar
                        className="av"
                        url={creator.avatarUrl}
                        profileUrl={creator.profileUrl}
                        handle={creator.handle}
                        platform={creator.platform}
                        platformAccounts={creator.platformAccounts}
                        name={identity.name}
                        index={included.length + index}
                        token={token}
                      />
                      <span>
                        <div className="nm">{identity.name}</div>
                        {identity.handle ? <div className="hd">{formatHandleLabel(identity.handle)}</div> : null}
                      </span>
                    </div>
                  </td>
                  <td>
                    {(() => {
                      const label = deliverablesLabel(creator.deliverableItems, creator.deliverables);
                      return label === DELIVERABLES_TO_BE_CONFIRMED ? TO_BE_CONFIRMED : label;
                    })()}
                  </td>
                  <td className="r tbc">{PRICE_PENDING_LABEL}</td>
                </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <p className="note">{UNPRICED_INCLUDED_MESSAGE}</p>
      </div>
      ) : null}

      {(() => {
        const consolidate = consolidationContract(view.journey?.approvedQuotationCount ?? 0);
        if (!consolidate.eligible) return null;
        return (
          <div className="card">
            <p className="ck">Multiple quotations</p>
            <h2>{consolidate.actionLabel}</h2>
            <p className="note">
              {consolidate.approvedQuotationCount} approved quotations can later be combined into a new
              quotation version. {consolidate.helper}
            </p>
            <button type="button" className="btn sec" disabled>
              {consolidate.actionLabel}
            </button>
          </div>
        );
      })()}
      {token ? <FinalQuotationApprovalCard view={view} token={token} /> : null}
      <div className="cm-doc-grid">
      {token ? <CommercialQuotationDelivery view={view} token={token} /> : null}
      {token ? <CommercialClientIo token={token} initial={view.commercialIo} /> : null}
      </div>
    </div>
  );
}
