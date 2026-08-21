import Link from "next/link";

import { CLIENT_STATUS_LABEL, type ClientWorkspaceSectionId } from "../constants";
import { buildClientReviewPath } from "../security/review-token";
import type { ClientWorkspaceEntry } from "../types";
import { LogoMark } from "./review-icons";

export function ClientReviewEntry({
  entry,
  reviewId,
  token,
  landingSection = "shortlist",
}: {
  entry: ClientWorkspaceEntry;
  reviewId: string;
  token: string;
  landingSection?: ClientWorkspaceSectionId;
}) {
  return (
    <div className="tw-review">
      <div className="entry-wrap">
        <div className="card entry-card">
          <div className="logo" style={{ marginBottom: 18 }}>
            <LogoMark />
            <span className="wm">
              THINK<b>WAY</b>
            </span>
          </div>
          <p className="ck">Your campaign is ready for review</p>
          <p className="note" style={{ marginTop: 8 }}>
            {entry.brandName}
          </p>
          <h2 style={{ marginTop: 0 }}>{entry.campaignName}</h2>
          <p className="note">
            {entry.clientLabel} · {entry.actionRequired}
          </p>
          <div className="glance" style={{ gridTemplateColumns: "1fr" }}>
            <div className="gi">
              <p className="l">Status</p>
              <p className="v">{entry.statusLabel || CLIENT_STATUS_LABEL[entry.status]}</p>
            </div>
            <div className="gi">
              <p className="l">Last updated</p>
              <p className="v">{new Date(entry.lastUpdated).toLocaleString()}</p>
            </div>
            <div className="gi">
              <p className="l">Action required</p>
              <p className="v">{entry.actionRequired}</p>
            </div>
          </div>
          <Link
            href={buildClientReviewPath(reviewId, token, landingSection)}
            className="btn primary"
            style={{ width: "100%", justifyContent: "center", marginTop: 22, minHeight: 44 }}
          >
            Review campaign
          </Link>
        </div>
      </div>
    </div>
  );
}

export function InvalidReviewLink({ message }: { message?: string }) {
  return (
    <div className="tw-review">
      <div className="entry-wrap">
        <div className="card entry-card" style={{ textAlign: "center" }}>
          <h2>This review link is not available</h2>
          <p className="note">{message ?? "The link may have been revoked or is for a different campaign."}</p>
        </div>
      </div>
    </div>
  );
}
