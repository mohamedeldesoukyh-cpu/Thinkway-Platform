"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addReviewCommentAction,
  bulkSelectCreatorsAction,
  selectCreatorAction,
} from "../actions/client-workspace-actions";
import type { ClientCreatorSelectionState } from "../constants";
import { countSelections } from "../status";
import type { ClientCreatorCard, ClientWorkspaceView } from "../types";
import { CampaignMediaPlanSummary } from "./campaign-media-plan-summary";
import { CreatorDetailSheet } from "./creator-detail-sheet";
import { CreatorMediaPlanCard } from "./creator-media-plan-card";

const STATUS_FILTERS: Array<{ id: "all" | "recommended" | ClientCreatorSelectionState; label: string }> = [
  { id: "all", label: "All" },
  { id: "recommended", label: "Recommended" },
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
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["id"]>("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const counts = countSelections(
    Object.fromEntries(view.creators.map((creator) => [creator.creatorId, creator.selection])),
    view.creators.map((creator) => creator.creatorId)
  );

  const platforms = unique(view.creators.map((creator) => creator.platform).filter(Boolean));
  const categories = unique(view.creators.map((creator) => creator.category || creator.niche).filter(Boolean));
  const tiers = unique(view.creators.map((creator) => creator.tier).filter(Boolean));
  const locations = unique(view.creators.map((creator) => creator.country).filter(Boolean));

  const filtered = view.creators.filter((creator) => {
    if (statusFilter === "recommended") {
      if (creator.selection === "rejected") return false;
    } else if (statusFilter !== "all" && creator.selection !== statusFilter) {
      return false;
    }
    if (platformFilter !== "all" && creator.platform !== platformFilter) return false;
    if (categoryFilter !== "all" && (creator.category || creator.niche) !== categoryFilter) return false;
    if (tierFilter !== "all" && creator.tier !== tierFilter) return false;
    if (locationFilter !== "all" && creator.country !== locationFilter) return false;
    return true;
  });

  const accepted = view.creators.filter((creator) => creator.selection === "accepted");
  const selectedInvestment = accepted.some((creator) => creator.investmentAmount != null)
    ? accepted.reduce((sum, creator) => sum + (creator.investmentAmount ?? 0), 0)
    : view.commercial.creatorInvestment;
  const active = view.creators.find((creator) => creator.creatorId === detailId) ?? null;

  const filterCounts = useMemo(
    () => ({
      all: view.creators.length,
      recommended: counts.accepted + counts.inReview,
      accepted: counts.accepted,
      in_review: counts.inReview,
      rejected: counts.rejected,
    }),
    [view.creators.length, counts]
  );

  function decide(creator: ClientCreatorCard, state: ClientCreatorSelectionState, reason?: string) {
    startTransition(async () => {
      await selectCreatorAction({
        token,
        creatorId: creator.creatorId,
        state,
        creatorName: creator.displayName,
        reason,
      });
      router.refresh();
    });
  }

  function bulk(state: ClientCreatorSelectionState, creatorIds?: string[]) {
    startTransition(async () => {
      await bulkSelectCreatorsAction({ token, state, creatorIds });
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <CampaignMediaPlanSummary
        summary={view.mediaPlanSummary}
        selectedCount={counts.accepted}
        selectedInvestment={
          accepted.length > 0
            ? selectedInvestment
            : view.commercial.creatorInvestment > 0
              ? view.commercial.creatorInvestment
              : undefined
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 rounded-full bg-zinc-200/60 p-1">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatusFilter(item.id)}
              className={
                statusFilter === item.id
                  ? "rounded-full bg-white px-3 py-1 text-sm font-semibold shadow-sm"
                  : "rounded-full px-3 py-1 text-sm text-zinc-600"
              }
            >
              {item.label} {filterCounts[item.id]}
            </button>
          ))}
        </div>
        {view.canDecide ? (
          <div className="flex flex-wrap gap-3 text-sm">
            <button
              type="button"
              className="text-zinc-500 hover:text-zinc-900"
              onClick={() => bulk("accepted")}
              disabled={pending}
            >
              Select all
            </button>
            <button
              type="button"
              className="text-zinc-500 hover:text-zinc-900"
              onClick={() => bulk("in_review")}
              disabled={pending}
            >
              Clear selection
            </button>
          </div>
        ) : null}
      </div>

      {(platforms.length > 1 || categories.length > 1 || tiers.length > 1 || locations.length > 1) && (
        <div className="flex flex-wrap gap-2">
          {platforms.length > 1 ? (
            <FilterSelect label="Platform" value={platformFilter} onChange={setPlatformFilter} options={platforms} />
          ) : null}
          {categories.length > 1 ? (
            <FilterSelect label="Category" value={categoryFilter} onChange={setCategoryFilter} options={categories} />
          ) : null}
          {tiers.length > 1 ? (
            <FilterSelect label="Tier" value={tierFilter} onChange={setTierFilter} options={tiers} />
          ) : null}
          {locations.length > 1 ? (
            <FilterSelect label="Location" value={locationFilter} onChange={setLocationFilter} options={locations} />
          ) : null}
        </div>
      )}

      <p className="text-sm text-zinc-500">
        Selected creators: {counts.accepted} / {counts.total}
      </p>

      <div className="space-y-3">
        {filtered.map((creator) => (
          <CreatorMediaPlanCard
            key={creator.creatorId}
            creator={creator}
            currency={view.commercial.currency}
            selected={creator.selection === "accepted"}
            canDecide={view.canDecide}
            pending={pending}
            onOpen={() => setDetailId(creator.creatorId)}
            onToggleSelect={() =>
              decide(creator, creator.selection === "accepted" ? "in_review" : "accepted")
            }
            onAccept={() => decide(creator, "accepted")}
            onReject={() => decide(creator, "rejected")}
          />
        ))}
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
            No creators match these filters.
          </p>
        ) : null}
      </div>

      <CreatorDetailSheet
        open={Boolean(active)}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        creator={active}
        token={token}
        currency={view.commercial.currency}
        canDecide={view.canDecide}
        pending={pending}
        comments={view.comments}
        onAccept={() => active && decide(active, "accepted")}
        onReject={(reason) => active && decide(active, "rejected", reason)}
        onRequestChanges={(message) => {
          if (!active) return;
          startTransition(async () => {
            await addReviewCommentAction({
              token,
              targetType: "creator",
              targetId: active.creatorId,
              message: `Change request: ${message}`,
            });
            router.refresh();
          });
        }}
      />
    </div>
  );
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-600">
      <span>{label}</span>
      <select
        className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
