"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMoneyKpi } from "@/lib/finance/currency-format";

import {
  bulkSelectCreatorsAction,
  selectCreatorAction,
} from "../actions/client-workspace-actions";
import { CLIENT_CREATOR_STATUS_LABEL, type ClientCreatorSelectionState } from "../constants";
import { formatCompactCount, formatEngagementPct } from "../format";
import { countSelections } from "../status";
import type { ClientCreatorCard, ClientWorkspaceView } from "../types";

const FILTERS: Array<{ id: "all" | ClientCreatorSelectionState; label: string }> = [
  { id: "all", label: "All" },
  { id: "accepted", label: "Accepted" },
  { id: "in_review", label: "In Review" },
  { id: "rejected", label: "Rejected" },
];

export function CreatorsWorkspace({
  view,
  token,
}: {
  view: ClientWorkspaceView;
  token: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [activeId, setActiveId] = useState<string | null>(view.creators[0]?.creatorId ?? null);
  const counts = countSelections(
    Object.fromEntries(view.creators.map((c) => [c.creatorId, c.selection])),
    view.creators.map((c) => c.creatorId)
  );
  const filtered = view.creators.filter((c) => (filter === "all" ? true : c.selection === filter));
  const active = view.creators.find((c) => c.creatorId === activeId) ?? filtered[0];

  const filterCounts = useMemo(
    () => ({
      all: view.creators.length,
      accepted: counts.accepted,
      in_review: counts.inReview,
      rejected: counts.rejected,
    }),
    [view.creators.length, counts]
  );

  function decide(creator: ClientCreatorCard, state: ClientCreatorSelectionState) {
    startTransition(async () => {
      await selectCreatorAction({
        token,
        creatorId: creator.creatorId,
        state,
        creatorName: creator.displayName,
      });
      router.refresh();
    });
  }

  function bulk(state: ClientCreatorSelectionState) {
    startTransition(async () => {
      await bulkSelectCreatorsAction({ token, state });
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1 rounded-full bg-zinc-200/60 p-1">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={
                  filter === item.id
                    ? "rounded-full bg-white px-3 py-1 text-sm font-semibold shadow-sm"
                    : "rounded-full px-3 py-1 text-sm text-zinc-600"
                }
              >
                {item.label} {filterCounts[item.id]}
              </button>
            ))}
          </div>
          {view.canDecide ? (
            <div className="flex gap-2 text-xs">
              <button type="button" className="text-zinc-500 hover:text-zinc-900" onClick={() => bulk("accepted")} disabled={pending}>
                Select all
              </button>
              <button type="button" className="text-zinc-500 hover:text-zinc-900" onClick={() => bulk("in_review")} disabled={pending}>
                Clear
              </button>
            </div>
          ) : null}
        </div>
        <p className="mb-3 text-sm text-zinc-500">
          Selected creators: {counts.accepted} / {counts.total}
        </p>
        <div className="space-y-2">
          {filtered.map((creator) => (
            <button
              key={creator.creatorId}
              type="button"
              onClick={() => setActiveId(creator.creatorId)}
              className={`flex w-full items-start gap-3 rounded-2xl border bg-white p-3 text-left ${
                active?.creatorId === creator.creatorId ? "border-[#1D9E75]" : "border-zinc-200"
              }`}
            >
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                {creator.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={creator.avatarUrl} alt="" className="size-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{creator.displayName}</p>
                <p className="truncate text-xs text-zinc-500">
                  {[creator.handle, formatCompactCount(creator.followers), creator.country, `ER ${formatEngagementPct(creator.engagementRate)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {creator.deliverables ? (
                  <p className="mt-2 text-xs text-zinc-600">{creator.deliverables}</p>
                ) : null}
              </div>
              <span className="mt-auto rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600">
                {CLIENT_CREATOR_STATUS_LABEL[creator.selection]}
              </span>
            </button>
          ))}
        </div>
      </section>
      <aside className="rounded-2xl border border-zinc-200 bg-white p-5">
        {active ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-16 overflow-hidden rounded-full bg-zinc-100">
                {active.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={active.avatarUrl} alt="" className="size-full object-cover" />
                ) : null}
              </div>
              <div>
                <p className="font-semibold">{active.displayName}</p>
                <p className="text-sm text-zinc-500">
                  {active.handle} · {formatCompactCount(active.followers)}
                </p>
              </div>
            </div>
            {view.canDecide ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={pending} onClick={() => decide(active, "accepted")}>
                  <CheckIcon className="size-4 text-[#1D9E75]" />
                  Accept
                </Button>
                <Button type="button" variant="outline" disabled={pending} onClick={() => decide(active, "rejected")}>
                  <XIcon className="size-4 text-red-500" />
                  Reject
                </Button>
              </div>
            ) : null}
            {active.fitExplanation ? (
              <p className="text-sm leading-relaxed text-zinc-600">{active.fitExplanation}</p>
            ) : null}
            {active.bio ? <p className="text-sm text-zinc-500">{active.bio}</p> : null}
            {active.investmentAmount != null ? (
              <p className="text-sm font-medium">
                {formatMoneyKpi(active.investmentAmount, active.investmentCurrency ?? view.commercial.currency)}
              </p>
            ) : null}
            {active.contentExamples.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {active.contentExamples.map((example, index) => (
                  <div key={`${example.url ?? index}`} className="aspect-square overflow-hidden rounded-xl bg-zinc-100">
                    {example.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={example.thumbnail} alt="" className="size-full object-cover" />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div>
            <p className="font-semibold">{view.overview.campaignName}</p>
            <p className="text-sm text-zinc-500">{view.creators.length} creators</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Investment</dt>
                <dd>{formatMoneyKpi(view.commercial.totalInvestment, view.commercial.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Selected</dt>
                <dd>
                  {counts.accepted} / {counts.total}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </aside>
    </div>
  );
}
