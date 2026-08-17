import Link from "next/link";

import { CLIENT_STATUS_LABEL, type ClientWorkspaceSectionId } from "../constants";
import { buildClientReviewPath } from "../security/review-token";
import type { ClientWorkspaceEntry } from "../types";

export function ClientReviewEntry({
  entry,
  reviewId,
  token,
  landingSection = "creators",
}: {
  entry: ClientWorkspaceEntry;
  reviewId: string;
  token: string;
  landingSection?: ClientWorkspaceSectionId;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5] px-4">
      <div className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Your campaign is ready for review
        </p>
        <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {entry.brandName}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{entry.campaignName}</h1>
        <p className="mt-4 text-sm text-zinc-500">
          {entry.clientLabel} · Proposal v{entry.reviewNumber}
        </p>
        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Status</dt>
            <dd className="font-medium">{entry.statusLabel || CLIENT_STATUS_LABEL[entry.status]}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Last updated</dt>
            <dd>{new Date(entry.lastUpdated).toLocaleString()}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Action required</dt>
            <dd className="text-right font-medium">{entry.actionRequired}</dd>
          </div>
        </dl>
        <Link
          href={buildClientReviewPath(reviewId, token, landingSection)}
          className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-[#1D9E75] px-5 py-3 text-sm font-semibold text-white hover:bg-[#178A65]"
        >
          Review campaign
        </Link>
      </div>
    </div>
  );
}
