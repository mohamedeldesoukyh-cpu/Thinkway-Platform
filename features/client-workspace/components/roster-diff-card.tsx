"use client";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

import type { ClientStageDiff, ClientWorkspaceView } from "../types";

function moneyLabel(amount: number | undefined, currency: string): string {
  if (amount == null) return "—";
  return formatMoneyKpi(amount, currency);
}

function kindLabel(kind: ClientStageDiff["rows"][number]["kind"]): string {
  if (kind === "added") return "New creator added";
  if (kind === "removed") return "Creator removed";
  return "Existing approved creator";
}

export function RosterDiffCard({
  view,
}: {
  view: ClientWorkspaceView;
}) {
  const diff = view.stageDiff;
  if (!diff || (diff.rows.length === 0 && diff.summaryItems.length === 0)) return null;
  if (!diff.commercialChangedAfterShortlistApproval && !diff.hasRosterChange && !diff.rows.some((row) => row.deliverablesChanged)) {
    return null;
  }
  const currency = view.commercial.currency;

  return (
    <div className="card">
      <p className="ck">Shortlist vs quotation</p>
      <h2>What changed after shortlist approval</h2>
      {diff.commercialChangedAfterShortlistApproval ? (
        <p className="note">Commercial value changed after shortlist approval.</p>
      ) : (
        <p className="note">The quotation roster differs from the approved shortlist.</p>
      )}
      <div className="clist">
        {diff.rows.map((row) => (
          <div key={row.creatorId} className="cli">
            <div>
              <p className="nm" style={{ margin: 0 }}>
                {row.displayName}
              </p>
              <p className="rt" style={{ margin: "4px 0 0" }}>
                {kindLabel(row.kind)}
                {row.deliverablesChanged ? " · Deliverables changed" : ""}
              </p>
              {row.kind === "existing" && row.investmentChanged ? (
                <p className="rt" style={{ margin: "4px 0 0" }}>
                  Shortlist: {moneyLabel(row.shortlistInvestment, currency)} → Quotation:{" "}
                  {moneyLabel(row.quotationInvestment, currency)}
                  {row.investmentDelta != null
                    ? ` · Difference: ${row.investmentDelta > 0 ? "+" : ""}${moneyLabel(row.investmentDelta, currency)}`
                    : ""}
                </p>
              ) : null}
            </div>
            <span className={`cbadge ${row.kind === "existing" && !row.investmentChanged && !row.deliverablesChanged ? "done" : "pend"}`}>
              {row.kind === "added" ? "Added" : row.kind === "removed" ? "Removed" : row.investmentChanged ? "Investment changed" : "Existing"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
