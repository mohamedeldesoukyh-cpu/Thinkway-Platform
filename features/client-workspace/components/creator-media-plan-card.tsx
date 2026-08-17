"use client";

import { CheckIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMoneyKpi } from "@/lib/finance/currency-format";

import { CLIENT_CREATOR_STATUS_LABEL, type ClientCreatorSelectionState } from "../constants";
import { deliverablesLabel } from "../deliverables";
import {
  formatCompactCount,
  formatEngagementPct,
  formatLocation,
  formatMatchPercent,
  formatPlatformLabel,
  NOT_AVAILABLE,
} from "../format";
import type { ClientCreatorCard } from "../types";

export function CreatorMediaPlanCard({
  creator,
  currency,
  selected,
  canDecide,
  pending,
  onOpen,
  onToggleSelect,
  onAccept,
  onReject,
}: {
  creator: ClientCreatorCard;
  currency: string;
  selected: boolean;
  canDecide: boolean;
  pending: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const location = formatLocation(creator.city, creator.country);
  const match = formatMatchPercent(creator.matchPercent);
  const investment =
    creator.investmentAmount != null
      ? formatMoneyKpi(creator.investmentAmount, creator.investmentCurrency ?? currency)
      : NOT_AVAILABLE;

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative mx-auto size-28 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 sm:mx-0 sm:size-32">
          {creator.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={creator.avatarUrl} alt="" className="size-full object-cover" />
          ) : null}
          {formatPlatformLabel(creator.platform) ? (
            <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
              {formatPlatformLabel(creator.platform)}
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {canDecide ? (
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[#1D9E75]"
                    checked={selected}
                    onChange={onToggleSelect}
                    aria-label={`Select ${creator.displayName}`}
                  />
                ) : null}
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold tracking-tight">{creator.displayName}</h3>
                  <p className="truncate text-sm text-zinc-500">{creator.handle || NOT_AVAILABLE}</p>
                </div>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600">
              {CLIENT_CREATOR_STATUS_LABEL[creator.selection]}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-zinc-500">Location</dt>
              <dd className="font-medium">{location || NOT_AVAILABLE}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Followers</dt>
              <dd className="font-medium">{formatCompactCount(creator.followers)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">ER</dt>
              <dd className="font-medium">{formatEngagementPct(creator.engagementRate)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Category</dt>
              <dd className="truncate font-medium">{creator.category || creator.niche || NOT_AVAILABLE}</dd>
            </div>
          </dl>
          {creator.audienceHighlight ? (
            <p className="mt-3 text-sm text-zinc-600">{creator.audienceHighlight}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {match ? (
              <p>
                <span className="text-zinc-500">Campaign match</span>{" "}
                <span className="font-semibold text-[#178A65]">{match}</span>
              </p>
            ) : null}
            <p className="text-zinc-600">
              {deliverablesLabel(creator.deliverableItems, creator.deliverables)}
            </p>
            <p className="font-semibold">{investment}</p>
          </div>
          {creator.fitExplanation || creator.matchExplanation ? (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-600">
              {creator.matchExplanation || creator.fitExplanation}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onOpen}>
              View creator
            </Button>
            {canDecide ? (
              <>
                <Button
                  type="button"
                  className="bg-[#1D9E75] hover:bg-[#178A65]"
                  disabled={pending || creator.selection === "accepted"}
                  onClick={onAccept}
                >
                  <CheckIcon className="size-4" />
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || creator.selection === "rejected"}
                  onClick={onReject}
                >
                  <XIcon className="size-4 text-red-500" />
                  Reject
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export type CreatorCardDecision = ClientCreatorSelectionState;
