"use client";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

import { clientCreatorIdentity, formatHandleLabel, formatPlatformLabel, NOT_AVAILABLE, providedText, TO_BE_CONFIRMED } from "../format";
import { breakdownForCreator } from "../platform-breakdown";
import { allocationSlices, MIX_BAR_COLORS, rosterHeadline } from "../presentation";
import type { ClientWorkspaceView } from "../types";
import { useClientWorkspaceState } from "./client-workspace-state";
import { ReviewAvatar } from "./review-avatar";
import { ReviewPlatformMark } from "./review-platform-mark";

export function CommercialWorkspace({
  view,
  token,
}: {
  view: ClientWorkspaceView;
  token?: string;
}) {
  const { selectedCreators, selectedCommercial, selectedSummary } = useClientWorkspaceState();
  const commercial = selectedCommercial;
  const roster = selectedCreators;
  const platforms = [
    ...new Set(
      roster
        .map((creator) => formatPlatformLabel(creator.platform) ?? creator.platform)
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const deliverableCount = selectedSummary.activityMix.reduce((sum, item) => sum + item.count, 0);
  const allocation = allocationSlices(commercial);
  const extraLines = view.commercial.lines.filter(
    (line) => !view.creators.some((creator) => creator.displayName === line.label)
  );
  const maxAlloc = Math.max(...(allocation?.map((item) => item.count) ?? [1]), 1);

  return (
    <>
      <div className="card">
        <p className="ck">Campaign investment</p>
        <h2 className={commercial.totalInvestment > 0 ? "cm-total" : "cm-total tbc"}>
          {commercial.totalInvestment > 0
            ? formatMoneyKpi(commercial.totalInvestment, commercial.currency)
            : TO_BE_CONFIRMED}
        </h2>
        <p className="note">
          {rosterHeadline(commercial.selectedCount)} selected of {view.creators.length} proposed
          {view.review.source === "shortlist" && view.journey?.quotationStage === "draft"
            ? " · Indicative investment — not commercially approved"
            : view.commercial.quotationTotal > 0
              ? ` · Quotation ${formatMoneyKpi(view.commercial.quotationTotal, commercial.currency)}`
              : ` · Quotation ${TO_BE_CONFIRMED}`}
          {" "}
          · Proposal v{view.review.reviewNumber}
          {view.quotation?.serialNumber ? ` · ${view.quotation.serialNumber}` : ""}
        </p>
        <div className="glance">
          <div className="gi">
            <p className="l">Creators</p>
            <p className="v">{roster.length}</p>
          </div>
          <div className="gi">
            <p className="l">Deliverables</p>
            <p className={deliverableCount > 0 ? "v" : "v tbc"}>
              {deliverableCount > 0 ? String(deliverableCount) : TO_BE_CONFIRMED}
            </p>
          </div>
          <div className="gi">
            <p className="l">Platforms</p>
            <p className={platforms.length ? "v" : "v tbc"}>
              {platforms.length ? platforms.join(" · ") : NOT_AVAILABLE}
            </p>
          </div>
          <div className="gi">
            <p className="l">Duration</p>
            <p className={view.overview.durationLabel?.trim() ? "v" : "v tbc"}>
              {providedText(view.overview.durationLabel, TO_BE_CONFIRMED)}
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

      <div className="card">
        <p className="ck">Creator investment</p>
        <h2>Selected roster</h2>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Platforms</th>
                <th>Deliverables</th>
                <th className="r">Investment</th>
              </tr>
            </thead>
            <tbody>
              {roster.length > 0 ? (
                roster.map((creator, index) => {
                  const identity = clientCreatorIdentity(creator.displayName, creator.handle);
                  const platforms = breakdownForCreator(creator).filter(
                    (row) => row.platform && row.platform !== "_other"
                  );
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
                    {creator.deliverables ||
                      creator.deliverableItems?.map((item) => `${item.quantity ?? 1} ${item.type}`).join(" · ") ||
                      TO_BE_CONFIRMED}
                  </td>
                  <td className="r">
                    {creator.investmentAmount != null
                      ? formatMoneyKpi(creator.investmentAmount, creator.investmentCurrency ?? commercial.currency)
                      : TO_BE_CONFIRMED}
                  </td>
                </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4}>Accept creators on the Creators tab to build this commercial view.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="sub">
                <td colSpan={3}>Subtotal · creator investment</td>
                <td className="r">
                  {commercial.creatorInvestment > 0
                    ? formatMoneyKpi(commercial.creatorInvestment, commercial.currency)
                    : TO_BE_CONFIRMED}
                </td>
              </tr>
              <tr>
                <td colSpan={3}>Total campaign investment</td>
                <td className="r">
                  {commercial.totalInvestment > 0
                    ? formatMoneyKpi(commercial.totalInvestment, commercial.currency)
                    : TO_BE_CONFIRMED}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

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
    </>
  );
}
