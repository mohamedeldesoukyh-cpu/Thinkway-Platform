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
import { deliverablesLabel } from "../deliverables";
import {
  CONTENT_UNAVAILABLE,
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
import type { ClientComment, ClientContentPost, ClientCreatorBrief, ClientCreatorCard } from "../types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-zinc-100 pt-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-medium">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}

function ContentFeed({ posts }: { posts: ClientContentPost[] }) {
  if (posts.length === 0) {
    return <p className="text-sm text-zinc-500">{CONTENT_UNAVAILABLE}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {posts.map((post, index) => {
        const href = post.url ?? undefined;
        const inner = (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
            <div className="aspect-square bg-zinc-100">
              {post.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.thumbnail} alt="" className="size-full object-cover" />
              ) : null}
            </div>
            <div className="space-y-0.5 p-2 text-[11px] text-zinc-600">
              <p>{formatPlatformLabel(post.platform) || "Post"}</p>
              {post.postedAt ? <p>{new Date(post.postedAt).toLocaleDateString()}</p> : null}
              <p>
                {post.likes != null ? `${formatCompactCount(post.likes)} likes` : NOT_AVAILABLE} ·{" "}
                {post.comments != null ? `${formatCompactCount(post.comments)} comments` : NOT_AVAILABLE}
              </p>
              <p>
                {post.views != null ? `${formatCompactCount(post.views)} views` : NOT_AVAILABLE}
                {post.engagementRate != null ? ` · ER ${formatEngagementPct(post.engagementRate)}` : ""}
              </p>
            </div>
          </div>
        );
        return href ? (
          <a key={`${href}-${index}`} href={href} target="_blank" rel="noreferrer" className="block">
            {inner}
          </a>
        ) : (
          <div key={index}>{inner}</div>
        );
      })}
    </div>
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl lg:max-w-2xl">
        {creator ? (
          <>
            <SheetHeader className="pr-10">
              <SheetTitle>{view?.displayName || creator.displayName}</SheetTitle>
              <SheetDescription>
                {[view?.handle || creator.handle, formatPlatformLabel(view?.platform || creator.platform)]
                  .filter(Boolean)
                  .join(" · ") || "Creator profile"}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-6 pb-8">
              <div className="flex items-start gap-4">
                <div className="size-24 shrink-0 overflow-hidden rounded-2xl bg-zinc-100">
                  {(view?.avatarUrl || creator.avatarUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={view?.avatarUrl || creator.avatarUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm text-zinc-500">{view?.location || DATA_NOT_AVAILABLE}</p>
                  <p className="text-sm leading-relaxed text-zinc-700">
                    {view?.bio || creator.bio || DATA_NOT_AVAILABLE}
                  </p>
                </div>
              </div>

              <Section title="Profile">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Fact label="Followers" value={formatCompactCount(view?.followers ?? creator.followers)} />
                  <Fact
                    label="Engagement rate"
                    value={formatEngagementPct(view?.engagementRate ?? creator.engagementRate)}
                    hint="Based on recent available content."
                  />
                </div>
              </Section>

              <Section title="Audience">
                {loading && !view?.audience ? (
                  <p className="text-sm text-zinc-500">Loading audience…</p>
                ) : view?.audience ? (
                  <div className="space-y-3 text-sm">
                    {view.audience.summary ? <p>{view.audience.summary}</p> : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-zinc-500">Age</p>
                        {view.audience.ages.length > 0 ? (
                          view.audience.ages.map((slice) => (
                            <p key={slice.label}>
                              {slice.label}
                              {slice.percent != null ? ` · ${Math.round(slice.percent)}%` : ""}
                            </p>
                          ))
                        ) : (
                          <p>{NOT_AVAILABLE}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Gender</p>
                        {view.audience.genders.length > 0 ? (
                          view.audience.genders.map((slice) => (
                            <p key={slice.label}>
                              {slice.label}
                              {slice.percent != null ? ` · ${Math.round(slice.percent)}%` : ""}
                            </p>
                          ))
                        ) : (
                          <p>{NOT_AVAILABLE}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Location</p>
                        {view.audience.locations.length > 0 ? (
                          view.audience.locations.map((slice) => (
                            <p key={slice.label}>
                              {slice.label}
                              {slice.percent != null ? ` · ${Math.round(slice.percent)}%` : ""}
                            </p>
                          ))
                        ) : (
                          <p>{NOT_AVAILABLE}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Interests</p>
                        <p>
                          {view.audience.interests.length > 0
                            ? view.audience.interests.join(" · ")
                            : NOT_AVAILABLE}
                        </p>
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
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Fact
                      label="Average likes"
                      value={formatExactCount(view.performance.avgLikes)}
                      hint={view.performance.likesExplanation}
                    />
                    <Fact
                      label="Average comments"
                      value={formatExactCount(view.performance.avgComments)}
                      hint={view.performance.commentsExplanation}
                    />
                    <Fact
                      label="Average views"
                      value={formatExactCount(view.performance.avgViews)}
                      hint={view.performance.viewsExplanation}
                    />
                    <Fact
                      label="Engagement rate"
                      value={formatEngagementPct(view.performance.engagementRate)}
                      hint={view.performance.engagementExplanation}
                    />
                    <Fact
                      label="Estimated reach"
                      value={formatCompactCount(view.performance.estimatedReach)}
                      hint={view.performance.reachExplanation}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">{DATA_NOT_AVAILABLE}</p>
                )}
              </Section>

              <Section title="Content">
                {loading && (view?.contentFeed.length ?? 0) === 0 && (creator.contentFeed?.length ?? 0) === 0 ? (
                  <p className="text-sm text-zinc-500">Loading content…</p>
                ) : (
                  <ContentFeed posts={view?.contentFeed?.length ? view.contentFeed : creator.contentFeed ?? []} />
                )}
              </Section>

              <Section title="Campaign fit">
                <p className="text-sm leading-relaxed text-zinc-700">
                  {view?.campaignFit || creator.fitExplanation || DATA_NOT_AVAILABLE}
                </p>
              </Section>

              <Section title="Category">
                <p className="text-sm">
                  {(view?.categories.length ? view.categories : creator.categories)?.join(" · ") ||
                    creator.category ||
                    NOT_AVAILABLE}
                </p>
                {view?.niche || creator.niche ? (
                  <p className="text-sm text-zinc-600">Niche: {view?.niche || creator.niche}</p>
                ) : null}
                {view?.brandMentions.length ? (
                  <p className="text-sm text-zinc-600">Brand mentions: {view.brandMentions.join(" · ")}</p>
                ) : null}
              </Section>

              <Section title="Why recommended">
                <p className="text-sm">
                  {formatMatchPercent(view?.matchPercent ?? creator.matchPercent)
                    ? `${formatMatchPercent(view?.matchPercent ?? creator.matchPercent)} match`
                    : NOT_AVAILABLE}
                  {formatConfidencePercent(view?.matchConfidence ?? creator.matchConfidence)
                    ? ` · ${formatConfidencePercent(view?.matchConfidence ?? creator.matchConfidence)} confidence`
                    : ""}
                </p>
                <p className="text-sm leading-relaxed text-zinc-700">
                  {view?.matchExplanation || creator.matchExplanation || creator.fitExplanation || DATA_NOT_AVAILABLE}
                </p>
                {(view?.matchEvidence.length ? view.matchEvidence : creator.matchEvidence)?.length ? (
                  <ul className="list-disc pl-5 text-sm text-zinc-600">
                    {(view?.matchEvidence.length ? view.matchEvidence : creator.matchEvidence ?? []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </Section>

              <Section title="Deliverables">
                <p className="text-sm">
                  {deliverablesLabel(
                    view?.deliverableItems.length ? view.deliverableItems : creator.deliverableItems,
                    view?.deliverables || creator.deliverables
                  )}
                </p>
              </Section>

              <Section title="Commercial">
                <p className="text-sm font-semibold">
                  Creator investment{" "}
                  {(view?.investmentAmount ?? creator.investmentAmount) != null
                    ? formatMoneyKpi(
                        (view?.investmentAmount ?? creator.investmentAmount) as number,
                        view?.investmentCurrency ?? creator.investmentCurrency ?? currency
                      )
                    : TO_BE_CONFIRMED}
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
                      Accept creator
                    </Button>
                    <Button type="button" variant="outline" disabled={pending} onClick={() => onReject(rejectReason)}>
                      <XIcon className="size-4 text-red-500" />
                      Reject creator
                    </Button>
                  </div>
                  <textarea
                    className="mt-3 min-h-20 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="Optional reject reason"
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
                        <p className="font-medium">{item.authorLabel}</p>
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
