"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatMoneyKpi } from "@/lib/finance/currency-format";

import {
  decideReviewAction,
  requestReviewChangesAction,
} from "../actions/client-workspace-actions";
import { CLIENT_CHANGE_AREAS, type ClientChangeArea } from "../constants";
import { TO_BE_CONFIRMED } from "../format";
import { rosterHeadline } from "../presentation";
import { countSelections } from "../status";
import type { ClientWorkspaceView } from "../types";
import { Panel, StatusPill } from "./media-plan-ui";

export function ApprovalWorkspace({
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
  const [areas, setAreas] = useState<ClientChangeArea[]>(["creator"]);
  const [error, setError] = useState<string | null>(null);
  const counts = countSelections(
    Object.fromEntries(view.creators.map((creator) => [creator.creatorId, creator.selection])),
    view.creators.map((creator) => creator.creatorId)
  );
  const deliverableCount = view.mediaPlanSummary.activityMix.reduce((sum, item) => sum + item.count, 0);

  function toggle(area: ClientChangeArea) {
    setAreas((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : [...current, area]
    );
  }

  if (view.review.status === "approved") {
    return (
      <Panel eyebrow="Proposal approved" title={view.overview.campaignName}>
        <p className="text-sm text-zinc-600">
          Approved {view.review.approvedAt ? new Date(view.review.approvedAt).toLocaleString() : ""} · Proposal v
          {view.review.reviewNumber}
        </p>
        {view.review.approvedByLabel ? (
          <p className="mt-1 text-sm text-zinc-500">Approved by {view.review.approvedByLabel}</p>
        ) : null}
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      <Panel eyebrow="Ready for approval" title="Review and lock this proposal">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Campaign</dt>
            <dd className="mt-1 font-medium">{view.overview.campaignName}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Creators</dt>
            <dd className="mt-1 font-medium">{rosterHeadline(view.creators.length)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Investment</dt>
            <dd className="mt-1 font-medium">
              {view.commercial.totalInvestment > 0
                ? formatMoneyKpi(view.commercial.totalInvestment, view.commercial.currency)
                : TO_BE_CONFIRMED}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Deliverables</dt>
            <dd className="mt-1 font-medium">
              {deliverableCount > 0 ? `${deliverableCount} items` : TO_BE_CONFIRMED}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-zinc-500">Proposal v{view.review.reviewNumber} · Current</p>
        <ul className="mt-5 space-y-2 text-sm">
          <CheckItem done label="Campaign reviewed" />
          <CheckItem done={counts.total > 0} label="Creator shortlist reviewed" />
          <CheckItem done={deliverableCount > 0 || view.content.length > 0} label="Deliverables reviewed" />
          <CheckItem done={view.commercial.totalInvestment > 0} label="Investment reviewed" />
        </ul>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {view.canDecide ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              className="bg-[#1D9E75] hover:bg-[#178A65]"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await decideReviewAction({ token, decision: "approved" });
                  if (!result.ok) setError(result.message);
                  router.refresh();
                })
              }
            >
              Approve proposal
            </Button>
            <Button
              variant="outline"
              disabled={pending || !summary.trim()}
              onClick={() =>
                startTransition(async () => {
                  await requestReviewChangesAction({ token, summary, areas });
                  router.refresh();
                })
              }
            >
              Request changes
            </Button>
          </div>
        ) : (
          <p className="mt-4 text-sm font-medium">This proposal is no longer open for decision.</p>
        )}
      </Panel>

      {view.canDecide ? (
        <Panel title="Request changes">
          <div className="mb-3 flex flex-wrap gap-2">
            {CLIENT_CHANGE_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => toggle(area)}
                className={
                  areas.includes(area)
                    ? "rounded-full bg-zinc-900 px-3 py-1 text-xs text-white"
                    : "rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600"
                }
              >
                {area}
              </button>
            ))}
          </div>
          <textarea
            className="min-h-24 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="What needs to change?"
          />
        </Panel>
      ) : null}

      {view.canDecide ? (
        <Panel title="Reject proposal">
          <p className="text-sm text-zinc-500">Reject is secondary and requires a reason.</p>
          <textarea
            className="mt-3 min-h-24 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Why is this proposal being rejected?"
          />
          <Button
            className="mt-3"
            variant="outline"
            disabled={pending || !rejectReason.trim()}
            onClick={() =>
              startTransition(async () => {
                const result = await decideReviewAction({
                  token,
                  decision: "rejected",
                  reason: rejectReason,
                });
                if (!result.ok) setError(result.message);
                router.refresh();
              })
            }
          >
            Reject proposal
          </Button>
        </Panel>
      ) : null}
    </div>
  );
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <StatusPill tone={done ? "positive" : "neutral"}>{done ? "Reviewed" : "Pending"}</StatusPill>
      <span>{label}</span>
    </li>
  );
}
