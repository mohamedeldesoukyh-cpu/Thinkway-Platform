"use client";

import { CheckIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMoneyKpi } from "@/lib/finance/currency-format";

import { CLIENT_CREATOR_STATUS_LABEL } from "../constants";
import { deliverablesLabel } from "../deliverables";
import {
  clientSafeFitCopy,
  formatCompactCount,
  formatConfidencePercent,
  formatEngagementPct,
  formatLocation,
  formatMatchPercent,
  formatPlatformLabel,
  NOT_AVAILABLE,
  TO_BE_CONFIRMED,
} from "../format";
import type { ClientCreatorCard } from "../types";
import { Chip, StatusPill } from "./media-plan-ui";

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
  onRequestChanges,
  timing,
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
  onRequestChanges: () => void;
  timing?: string;
}) {
  const location = formatLocation(creator.city, creator.country);
  const match = formatMatchPercent(creator.matchPercent);
  const confidence = formatConfidencePercent(creator.matchConfidence);
  const why =
    clientSafeFitCopy(creator.matchExplanation) ||
    clientSafeFitCopy(creator.fitExplanation) ||
    creator.audienceHighlight;
  const investment =
    creator.investmentAmount != null
      ? formatMoneyKpi(creator.investmentAmount, creator.investmentCurrency ?? currency)
      : NOT_AVAILABLE;
  const categories = creator.categories?.length
    ? creator.categories
    : [creator.category, creator.niche].filter((value): value is string => Boolean(value));

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[180px_minmax(0,1fr)_240px]">
        <div className="min-w-0">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-[180px] overflow-hidden rounded-2xl bg-zinc-100 lg:mx-0">
            {creator.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={creator.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-2xl font-semibold text-zinc-400">
                {creator.displayName.slice(0, 1)}
              </div>
            )}
            {formatPlatformLabel(creator.platform) ? (
              <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                {formatPlatformLabel(creator.platform)}
              </span>
            ) : null}
          </div>
          <div className="mt-3">
            <div className="flex items-start gap-2">
              {canDecide ? (
                <input
                  type="checkbox"
                  className="mt-1.5 size-4 accent-[#1D9E75]"
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
            <p className="mt-2 text-sm text-zinc-600">{location || NOT_AVAILABLE}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-zinc-500">Followers</dt>
                <dd className="font-semibold">{formatCompactCount(creator.followers)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Engagement rate</dt>
                <dd className="font-semibold">{formatEngagementPct(creator.engagementRate)}</dd>
              </div>
            </dl>
            {categories.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {categories.slice(0, 3).map((category) => (
                  <Chip key={category}>{category}</Chip>
                ))}
              </div>
            ) : null}
            {creator.audienceHighlight ? (
              <p className="mt-3 line-clamp-2 text-sm text-zinc-600">{creator.audienceHighlight}</p>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 border-t border-zinc-100 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Campaign fit</p>
            <StatusPill
              tone={
                creator.selection === "accepted"
                  ? "positive"
                  : creator.selection === "rejected"
                    ? "danger"
                    : "neutral"
              }
            >
              {CLIENT_CREATOR_STATUS_LABEL[creator.selection]}
            </StatusPill>
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[#178A65]">{match ?? NOT_AVAILABLE}</p>
          <p className="text-xs text-zinc-500">{match ? "Campaign Match" : "Match to be confirmed"}</p>
          {confidence ? <p className="mt-1 text-xs text-zinc-500">{confidence} confidence</p> : null}
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Why recommended
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700">
            {why || "Recommendation rationale to be confirmed"}
          </p>
          {creator.matchEvidence?.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600">
              {creator.matchEvidence.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="min-w-0 rounded-2xl bg-zinc-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Proposed activation
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed">
            {deliverablesLabel(creator.deliverableItems, creator.deliverables)}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Timing</dt>
              <dd className="font-medium">{timing?.trim() || TO_BE_CONFIRMED}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Investment</dt>
              <dd className="font-semibold">{investment}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Estimated reach</dt>
              <dd className="font-medium">{formatCompactCount(creator.estimatedReach)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Estimated engagements</dt>
              <dd className="font-medium">{formatCompactCount(creator.estimatedEngagements)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">CPE</dt>
              <dd className="font-medium">
                {creator.cpe != null
                  ? formatMoneyKpi(creator.cpe, creator.investmentCurrency ?? currency)
                  : NOT_AVAILABLE}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-col gap-2">
            <Button type="button" variant="outline" onClick={onOpen}>
              View profile
            </Button>
            {canDecide ? (
              <div className="grid grid-cols-2 gap-2">
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
              </div>
            ) : null}
            {canDecide ? (
              <button
                type="button"
                className="text-sm text-zinc-500 hover:text-zinc-900"
                onClick={onRequestChanges}
              >
                Request changes
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
