"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatMoneyKpi } from "@/lib/finance/currency-format";

import {
  addReviewCommentAction,
  loadCreatorBriefAction,
} from "../actions/client-workspace-actions";
import { contentCategoriesForDisplay } from "../content-categories";
import { deliverablesLabel } from "../deliverables";
import { clientFacingCreatorCardAmount } from "../quotation-client-facing";
import {
  DATA_NOT_AVAILABLE,
  formatCompactCount,
  formatConfidencePercent,
  formatEngagementPct,
  formatExactCount,
  formatMatchPercent,
  formatPlatformLabel,
  NOT_AVAILABLE,
  TO_BE_CONFIRMED,
} from "../format";
import type { ClientComment, ClientCreatorBrief, ClientCreatorCard } from "../types";
import { CreatorContentFeed } from "./creator-content-feed";
import { Chip, MetricCard } from "./media-plan-ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-zinc-100 pt-6">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}

export function CreatorDetailSheet({
  open,
  onOpenChange,
  creator,
  token,
  currency,
  canDecide,
  pending,
  comments,
  onAccept,
  onReject,
  onRequestChanges,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: ClientCreatorCard | null;
  token: string;
  currency: string;
  canDecide: boolean;
  pending: boolean;
  comments: ClientComment[];
  onAccept: () => void;
  onReject: (reason?: string) => void;
  onRequestChanges: (message: string) => void;
}) {
  const [brief, setBrief] = useState<ClientCreatorBrief | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [comment, setComment] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [, startTransition] = useTransition();
  const creatorId = creator?.creatorId;

  useEffect(() => {
    if (!open || !creatorId) return;
    let cancelled = false;
    loadCreatorBriefAction({ token, creatorId }).then((result) => {
      if (!cancelled && result.ok) setBrief(result.brief);
    });
    return () => {
      cancelled = true;
    };
  }, [open, creatorId, token]);

  const view = brief?.creatorId === creatorId ? brief : null;
  const loading = Boolean(open && creator && !view);
  const creatorComments = comments.filter(
    (item) => item.targetType === "creator" && item.targetId === creator?.creatorId
  );
  const match = formatMatchPercent(view?.matchPercent ?? creator?.matchPercent);
  const categories = contentCategoriesForDisplay(
    view?.contentCategories ?? creator?.contentCategories,
    view?.categories.length
      ? view.categories
      : creator?.categories?.length
        ? creator.categories
        : [creator?.category, creator?.niche]
  ).map((item) => item.label);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl lg:max-w-3xl">
        {creator ? (
          <>
            <div className="relative h-56 bg-zinc-100 sm:h-72">
              {(creator.avatarUrl || view?.avatarUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={creator.avatarUrl || view?.avatarUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-5xl font-semibold text-zinc-300">
                  {creator.displayName.slice(0, 1)}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <SheetHeader className="absolute inset-x-0 bottom-0 space-y-1 p-6 text-left text-white">
                <SheetTitle className="text-2xl text-white">
                  {view?.displayName || creator.displayName}
                </SheetTitle>
                <SheetDescription className="text-white/80">
                  {[view?.handle || creator.handle, formatPlatformLabel(view?.platform || creator.platform)]
                    .filter(Boolean)
                    .join(" · ") || "Creator profile"}
                </SheetDescription>
              </SheetHeader>
            </div>
            <div className="space-y-6 px-6 py-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard label="Followers" value={formatCompactCount(view?.followers ?? creator.followers)} />
                <MetricCard
                  label="Engagement rate"
                  value={formatEngagementPct(view?.engagementRate ?? creator.engagementRate)}
                />
                <MetricCard label="Campaign Match" value={match ?? NOT_AVAILABLE} />
                <MetricCard label="Location" value={view?.location || DATA_NOT_AVAILABLE} />
              </div>

              <Section title="Profile">
                <p className="text-sm leading-relaxed text-zinc-700">
                  {view?.bio || creator.bio || DATA_NOT_AVAILABLE}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm text-zinc-600">
                  <span>{formatPlatformLabel(view?.platform || creator.platform) || NOT_AVAILABLE}</span>
                  <span>{categories[0] || NOT_AVAILABLE}</span>
                </div>
              </Section>

              <Section title="Audience">
                {loading && !view?.audience ? (
                  <p className="text-sm text-zinc-500">Loading audience…</p>
                ) : view?.audience ? (
                  <div className="space-y-3 text-sm">
                    {view.audience.summary ? <p>{view.audience.summary}</p> : null}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <AudienceList title="Age" slices={view.audience.ages} />
                      <AudienceList title="Gender" slices={view.audience.genders} />
                      <AudienceList title="Top locations" slices={view.audience.locations} />
                      <div>
                        <p className="text-xs text-zinc-500">Interests</p>
                        {view.audience.interests.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {view.audience.interests.map((interest) => (
                              <Chip key={interest}>{interest}</Chip>
                            ))}
                          </div>
                        ) : (
                          <p>{NOT_AVAILABLE}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">{DATA_NOT_AVAILABLE}</p>
                )}
              </Section>

              <Section title="Performance">
                {loading && !view?.performance ? (
                  <p className="text-sm text-zinc-500">Loading performance…</p>
                ) : view?.performance ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <MetricCard label="Average likes" value={formatExactCount(view.performance.avgLikes)} />
                    <MetricCard label="Average comments" value={formatExactCount(view.performance.avgComments)} />
                    <MetricCard label="Average views" value={formatExactCount(view.performance.avgViews)} />
                    <MetricCard
                      label="Engagement rate"
                      value={formatEngagementPct(view.performance.engagementRate)}
                    />
                    <MetricCard
                      label="Estimated reach"
                      value={formatCompactCount(view.performance.estimatedReach ?? creator.estimatedReach)}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">{DATA_NOT_AVAILABLE}</p>
                )}
              </Section>

              <Section title="Content performance">
                {loading && (view?.contentFeed.length ?? 0) === 0 && (creator.contentFeed?.length ?? 0) === 0 ? (
                  <p className="text-sm text-zinc-500">Loading content…</p>
                ) : (
                  <CreatorContentFeed
                    posts={view?.contentFeed?.length ? view.contentFeed : creator.contentFeed ?? []}
                  />
                )}
              </Section>

              <Section title="Campaign fit">
                <p className="text-sm leading-relaxed text-zinc-700">
                  {view?.campaignFit || creator.fitExplanation || DATA_NOT_AVAILABLE}
                </p>
              </Section>

              <Section title="Category / niche">
                {categories.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((category) => (
                      <Chip key={category}>{category}</Chip>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm">{NOT_AVAILABLE}</p>
                )}
              </Section>

              {(view?.brandMentions.length || creator.brandMentions?.length) ? (
                <Section title="Brand context">
                  <div className="flex flex-wrap gap-1.5">
                    {(view?.brandMentions.length ? view.brandMentions : creator.brandMentions ?? []).map((item) => (
                      <Chip key={item.name}>{item.name}</Chip>
                    ))}
                  </div>
                </Section>
              ) : null}

              <Section title="Why recommended">
                <p className="text-2xl font-semibold text-[#178A65]">{match ?? NOT_AVAILABLE}</p>
                {formatConfidencePercent(view?.matchConfidence ?? creator.matchConfidence) ? (
                  <p className="text-sm text-zinc-500">
                    {formatConfidencePercent(view?.matchConfidence ?? creator.matchConfidence)} confidence
                  </p>
                ) : null}
                <p className="mt-2 text-sm leading-relaxed text-zinc-700">
                  {view?.matchExplanation || creator.matchExplanation || creator.fitExplanation || DATA_NOT_AVAILABLE}
                </p>
                {(view?.matchEvidence.length ? view.matchEvidence : creator.matchEvidence)?.length ? (
                  <ul className="mt-3 list-disc pl-5 text-sm text-zinc-600">
                    {(view?.matchEvidence.length ? view.matchEvidence : creator.matchEvidence ?? []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </Section>

              <Section title="Commercial">
                <p className="text-sm font-semibold">
                  Creator investment{" "}
                  {(() => {
                    const amount = clientFacingCreatorCardAmount({
                      investmentAmount: view?.investmentAmount ?? creator.investmentAmount,
                      agencyFeeAmount: creator.agencyFeeAmount,
                      usageRightsAmount: creator.usageRightsAmount,
                    });
                    return amount != null
                      ? formatMoneyKpi(
                          amount,
                          view?.investmentCurrency ?? creator.investmentCurrency ?? currency
                        )
                      : TO_BE_CONFIRMED;
                  })()}
                </p>
              </Section>

              <Section title="Deliverables">
                <p className="text-sm">
                  {deliverablesLabel(
                    view?.deliverableItems.length ? view.deliverableItems : creator.deliverableItems,
                    view?.deliverables || creator.deliverables
                  )}
                </p>
              </Section>

              {canDecide ? (
                <Section title="Decision">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="bg-[#1D9E75] hover:bg-[#178A65]"
                      disabled={pending}
                      onClick={onAccept}
                    >
                      <CheckIcon className="size-4" />
                      Accept
                    </Button>
                    <Button type="button" variant="outline" disabled={pending} onClick={() => onReject(rejectReason)}>
                      <XIcon className="size-4 text-red-500" />
                      Reject
                    </Button>
                  </div>
                  <textarea
                    className="mt-3 min-h-20 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="Reject reason"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                  />
                  <textarea
                    className="mt-3 min-h-20 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="Request a change for this creator"
                    value={changeNote}
                    onChange={(event) => setChangeNote(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    disabled={pending || !changeNote.trim()}
                    onClick={() => {
                      onRequestChanges(changeNote.trim());
                      setChangeNote("");
                    }}
                  >
                    Request changes
                  </Button>
                  <textarea
                    className="mt-3 min-h-20 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="Add a comment"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    disabled={pending || !comment.trim()}
                    onClick={() =>
                      startTransition(async () => {
                        await addReviewCommentAction({
                          token,
                          targetType: "creator",
                          targetId: creator.creatorId,
                          message: comment.trim(),
                        });
                        setComment("");
                      })
                    }
                  >
                    Add comment
                  </Button>
                </Section>
              ) : null}

              {creatorComments.length > 0 ? (
                <Section title="Comments">
                  <ul className="space-y-2 text-sm">
                    {creatorComments.map((item) => (
                      <li key={item.id} className="rounded-xl bg-zinc-50 px-3 py-2">
                        <p className="font-medium">{item.authorKind === "client" ? "Client" : "Thinkway"}</p>
                        <p className="text-zinc-600">{item.message}</p>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function AudienceList({
  title,
  slices,
}: {
  title: string;
  slices: Array<{ label: string; percent?: number }>;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{title}</p>
      {slices.length > 0 ? (
        slices.map((slice) => (
          <p key={slice.label}>
            {slice.label}
            {slice.percent != null ? ` · ${Math.round(slice.percent)}%` : ""}
          </p>
        ))
      ) : (
        <p>{NOT_AVAILABLE}</p>
      )}
    </div>
  );
}
