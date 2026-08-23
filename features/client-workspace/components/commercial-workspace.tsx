"use client";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

import { clientCreatorIdentity, DELIVERABLES_TO_BE_CONFIRMED, formatHandleLabel, formatPlatformLabel, NOT_AVAILABLE, TO_BE_CONFIRMED } from "../format";
import { breakdownForCreator } from "../platform-breakdown";
import { deliverablesLabel } from "../deliverables";
import { originalInvestmentForDisplay, visibleOriginalCurrencyAmount } from "../quotation-client-facing";
import {
  canOpenCommercialWorkspace,
  clientQuotationCommercialView,
  COMMERCIAL_LOCKED_UNTIL_CREATOR_APPROVAL_MESSAGE,
  consolidationContract,
  isValidClientCommercialApproval,
  INVALID_ZERO_SELECTION_APPROVAL_MESSAGE,
  ORIGINAL_QUOTATION_TOTAL_LABEL,
  PRICE_PENDING_LABEL,
  REVIEW_YOUR_SELECTION_LABEL,
  UNPRICED_INCLUDED_MESSAGE,
} from "../selection-flow";
import { allocationSlices, MIX_BAR_COLORS, rosterHeadline } from "../presentation";
import type { ClientWorkspaceView } from "../types";
import { useClientWorkspaceState } from "./client-workspace-state";
import { CommercialQuotationDelivery } from "./commercial-quotation-delivery";
import { FinalQuotationApprovalCard } from "./final-quotation-approval-card";
import { ReviewAvatar } from "./review-avatar";
import { ReviewPlatformMark } from "./review-platform-mark";

export function CommercialWorkspace({
  view,
  token,
}: {
  view: ClientWorkspaceView;
  token?: string;
}) {
  const { selectedCommercial, goToSection } = useClientWorkspaceState();
  const showOriginalCurrency = Boolean(view.showOriginalCurrency);
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
        <p className="note">{COMMERCIAL_LOCKED_UNTIL_CREATOR_APPROVAL_MESSAGE}</p>
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
  const extensionSections = quotationView.extensions.map((section) => ({
    ...section,
    creators: section.creatorIds
      .map((id) => creatorsById.get(id))
      .filter((creator): creator is NonNullable<typeof creator> => Boolean(creator)),
  }));
  const pricingRequired = quotationView.pricingRequiredIds
    .map((id) => creatorsById.get(id))
    .filter((creator): creator is NonNullable<typeof creator> => Boolean(creator));
  const rosterCount = included.length + extensionSections.reduce((sum, section) => sum + section.creators.length, 0);
  const commercial = {
    ...selectedCommercial,
    creatorInvestment: quotationView.original.cost + extensionSections.reduce((sum, section) => sum + section.cost, 0),
    feeAmount:
      quotationView.original.agencyFees +
      extensionSections.reduce((sum, section) => sum + section.agencyFees, 0),
    totalInvestment: quotationView.totalInvestment,
    selectedCount: rosterCount,
    pricedSelectedCount: rosterCount,
    unpricedSelectedCount: pricingRequired.length,
  };
  const invalidEmptyApproval = isValidClientCommercialApproval({
    quotationStage: view.journey?.quotationStage ?? "",
    selectedCount: rosterCount,
  }) === false && view.journey?.quotationStage === "approved";
  const allocation = allocationSlices(commercial);
  const shownNames = new Set(
    [...included, ...extensionSections.flatMap((section) => section.creators)].map(
      (creator) => creator.displayName
    )
  );
  const extraLines = view.commercial.lines.filter((line) => !shownNames.has(line.label));
  const maxAlloc = Math.max(...(allocation?.map((item) => item.count) ?? [1]), 1);

  return (
    <>
      {token ? <FinalQuotationApprovalCard view={view} token={token} /> : null}
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
      <div className="card">
        <p className="ck">Campaign investment</p>
        <h2 className={commercial.totalInvestment > 0 ? "cm-total" : "cm-total tbc"}>
          {commercial.totalInvestment > 0
            ? formatMoneyKpi(commercial.totalInvestment, commercial.currency)
            : TO_BE_CONFIRMED}
        </h2>
        <p className="note">
          {invalidEmptyApproval
            ? INVALID_ZERO_SELECTION_APPROVAL_MESSAGE
            : `Final selected creators · ${rosterHeadline(commercial.selectedCount)}${
                commercial.unpricedSelectedCount
                  ? ` · ${commercial.unpricedSelectedCount} price pending`
                  : ""
              }${view.journey?.quotationStage === "updated" ? " · Updated — final quotation approval required" : ""}`}
        </p>
        <div className="glance">
          <div className="gi">
            <p className="l">Selected creators</p>
            <p className="v">{commercial.selectedCount}</p>
          </div>
          <div className="gi">
            <p className="l">Priced creators</p>
            <p className="v">{commercial.pricedSelectedCount ?? 0}</p>
          </div>
          <div className="gi">
            <p className="l">Pricing required</p>
            <p className={commercial.unpricedSelectedCount ? "v tbc" : "v"}>
              {commercial.unpricedSelectedCount ?? 0}
            </p>
          </div>
          <div className="gi">
            <p className="l">Cost</p>
            <p className={commercial.creatorInvestment > 0 ? "v" : "v tbc"}>
              {commercial.creatorInvestment > 0
                ? formatMoneyKpi(commercial.creatorInvestment, commercial.currency)
                : TO_BE_CONFIRMED}
            </p>
          </div>
          <div className="gi">
            <p className="l">Agency Fees</p>
            <p className={(commercial.feeAmount ?? 0) > 0 || commercial.creatorInvestment > 0 ? "v" : "v tbc"}>
              {commercial.creatorInvestment > 0
                ? formatMoneyKpi(commercial.feeAmount ?? 0, commercial.currency)
                : TO_BE_CONFIRMED}
            </p>
          </div>
          <div className="gi">
            <p className="l">Total Investment</p>
            <p className={commercial.totalInvestment > 0 ? "v" : "v tbc"}>
              {commercial.totalInvestment > 0
                ? formatMoneyKpi(commercial.totalInvestment, commercial.currency)
                : TO_BE_CONFIRMED}
            </p>
          </div>
        </div>
      </div>

      {allocation ? (
        <div className="card">
          <p className="ck">Budget allocation</p>
          <h2>How the investment is split</h2>
          <div className="barset">
            {allocation.map((item, index) => (
              <div className="bar" key={item.label}>
                <span className="bl">{item.label}</span>
                <span className="bt">
                <span
                  className="bf"
                  style={{
                    width: `${(item.count / maxAlloc) * 100}%`,
                    background: MIX_BAR_COLORS[index % MIX_BAR_COLORS.length],
                  }}
                />
                </span>
                <span className="bn">{item.count}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {included.length > 0 ? (
      <div className="card">
        <p className="ck">Included in current quotation</p>
        <h2>Client Approved · confirmed pricing</h2>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Platforms</th>
                <th>Deliverables</th>
                <th className="r">Cost</th>
                <th className="r">Agency Fees</th>
                <th className="r">Total Investment</th>
              </tr>
            </thead>
            <tbody>
              {included.map((creator, index) => {
                  const identity = clientCreatorIdentity(creator.displayName, creator.handle);
                  const platforms = breakdownForCreator(creator).filter(
                    (row) => row.platform && row.platform !== "_other"
                  );
                  const fee = Number(creator.agencyFeeAmount) || 0;
                  const lineTotal = (creator.investmentAmount ?? 0) + fee;
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
                        index={index}
                        token={token}
                      />
                      <span>
                        <div className="nm">{identity.name}</div>
                        {identity.handle ? <div className="hd">{formatHandleLabel(identity.handle)}</div> : null}
                      </span>
                    </div>
                  </td>
                  <td>
                    {platforms.length > 0 ? (
                      <div className="plat-stack">
                        {platforms.map((row) => (
                          <ReviewPlatformMark key={row.platform} platform={row.platform} />
                        ))}
                      </div>
                    ) : (
                      formatPlatformLabel(creator.platform) ?? NOT_AVAILABLE
                    )}
                  </td>
                  <td>
                    {(() => {
                      const label = deliverablesLabel(creator.deliverableItems, creator.deliverables);
                      return label === DELIVERABLES_TO_BE_CONFIRMED ? TO_BE_CONFIRMED : label;
                    })()}
                  </td>
                  <td className="r">
                    {formatMoneyKpi(creator.investmentAmount!, commercial.currency)}
                    {(() => {
                      const original = visibleOriginalCurrencyAmount(
                        originalInvestmentForDisplay(creator, commercial.currency),
                        showOriginalCurrency
                      );
                      return original ? (
                        <div className="inv-orig">
                          Original: {formatMoneyKpi(original.amount, original.currency)}
                        </div>
                      ) : null;
                    })()}
                  </td>
                  <td className="r">{formatMoneyKpi(fee, commercial.currency)}</td>
                  <td className="r">{formatMoneyKpi(lineTotal, commercial.currency)}</td>
                </tr>
                  );
                })}
            </tbody>
            <tfoot>
              <tr className="sub">
                <td colSpan={5}>Cost</td>
                <td className="r">{formatMoneyKpi(quotationView.original.cost, commercial.currency)}</td>
              </tr>
              <tr className="sub">
                <td colSpan={5}>Agency Fees</td>
                <td className="r">{formatMoneyKpi(quotationView.original.agencyFees, commercial.currency)}</td>
              </tr>
              <tr>
                <td colSpan={5}>Total Investment</td>
                <td className="r">{formatMoneyKpi(quotationView.original.total, commercial.currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      ) : null}

      {extensionSections.map((section) => (
        <div className="card" key={section.title}>
          <p className="ck">{section.title}</p>
          <h2>Client Approved · new creators only</h2>
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Platforms</th>
                  <th>Deliverables</th>
                  <th className="r">Cost</th>
                  <th className="r">Agency Fees</th>
                  <th className="r">Total Investment</th>
                </tr>
              </thead>
              <tbody>
                {section.creators.map((creator, index) => {
                  const identity = clientCreatorIdentity(creator.displayName, creator.handle);
                  const platforms = breakdownForCreator(creator).filter(
                    (row) => row.platform && row.platform !== "_other"
                  );
                  const fee = Number(creator.agencyFeeAmount) || 0;
                  const lineTotal = (creator.investmentAmount ?? 0) + fee;
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
                        {platforms.length > 0 ? (
                          <div className="plat-stack">
                            {platforms.map((row) => (
                              <ReviewPlatformMark key={row.platform} platform={row.platform} />
                            ))}
                          </div>
                        ) : (
                          formatPlatformLabel(creator.platform) ?? NOT_AVAILABLE
                        )}
                      </td>
                      <td>
                        {(() => {
                          const label = deliverablesLabel(creator.deliverableItems, creator.deliverables);
                          return label === DELIVERABLES_TO_BE_CONFIRMED ? TO_BE_CONFIRMED : label;
                        })()}
                      </td>
                      <td className="r">{formatMoneyKpi(creator.investmentAmount!, commercial.currency)}</td>
                      <td className="r">{formatMoneyKpi(fee, commercial.currency)}</td>
                      <td className="r">{formatMoneyKpi(lineTotal, commercial.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>{section.title}</td>
                  <td className="r">{formatMoneyKpi(section.total, commercial.currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}

      {extensionSections.length > 0 ? (
        <div className="card">
          <p className="ck">Investment summary</p>
          <h2>Original + extensions</h2>
          <div className="clist">
            <div className="cli">
              <span className="nm">{ORIGINAL_QUOTATION_TOTAL_LABEL}</span>
              <span className="rt">{formatMoneyKpi(quotationView.originalTotal, commercial.currency)}</span>
            </div>
            {quotationView.extensions.map((section) => (
              <div className="cli" key={section.title}>
                <span className="nm">{section.title}</span>
                <span className="rt">{formatMoneyKpi(section.total, commercial.currency)}</span>
              </div>
            ))}
            <div className="cli">
              <span className="nm">Total investment</span>
              <span className="rt">{formatMoneyKpi(quotationView.totalInvestment, commercial.currency)}</span>
            </div>
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

      {rosterCount === 0 && pricingRequired.length === 0 ? (
        <div className="card">
          <p className="ck">Commercial</p>
          <h2>No creators selected yet</h2>
          <p className="note">Select creators on Shortlist and Approve Selected Creators to build this commercial view.</p>
        </div>
      ) : null}

      {extraLines.length > 0 ? (
        <div className="card">
          <p className="ck">Additional commercial items</p>
          <h2>{view.quotation?.serialNumber ?? "Proposal commercial items"}</h2>
          {view.quotation?.name ? (
            <p className="note">
              {view.quotation.name}
              {view.quotation.version ? ` · Version ${view.quotation.version}` : ""}
            </p>
          ) : null}
          <div className="clist">
            {extraLines.map((line) => (
              <div className="cli" key={line.label}>
                <span className="nm">{line.label}</span>
                <span className="rt">
                  {line.amount != null ? formatMoneyKpi(line.amount, commercial.currency) : TO_BE_CONFIRMED}
                </span>
              </div>
            ))}
          </div>
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
      {token ? <CommercialQuotationDelivery view={view} token={token} /> : null}
    </>
  );
}
