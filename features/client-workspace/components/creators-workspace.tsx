"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

import {
  addReviewCommentAction,
  bulkSelectCreatorsAction,
  loadCreatorBriefAction,
  selectCreatorAction,
} from "../actions/client-workspace-actions";
import type { ClientCreatorSelectionState } from "../constants";
import { CLIENT_CREATOR_STATUS_LABEL } from "../constants";
import {
  DATA_NOT_AVAILABLE,
  clientCreatorIdentity,
  formatCompactCount,
  formatHandleLabel,
  formatLocation,
  formatMatchPercent,
  NOT_AVAILABLE,
  TO_BE_CONFIRMED,
} from "../format";
import {
  flagFromCountry,
  qualityBadge,
  qualityGaugePercent,
  rosterHeadline,
  rosterSourceLine,
} from "../presentation";
import { contentCategoriesForDisplay } from "../content-categories";
import { breakdownForCreator } from "../platform-breakdown";
import { countSelections, nextAcceptState } from "../status";
import type { ClientAudienceSlice, ClientCreatorBrief, ClientCreatorCard, ClientWorkspaceView } from "../types";
import { AdvancedReportModal, ContentFeatureGrid } from "./advanced-report-modal";
import { ContentCategoryGrid } from "./content-category-grid";
import { ProposalSummaryCard } from "./proposal-summary-card";
import { ReviewAvatar } from "./review-avatar";
import { ReviewCreatorProfileLinks } from "./review-creator-profile-links";
import { ReviewDeliverableStrip } from "./review-deliverable-strip";
import { BrandMentionsCard, EstimatedReachCard } from "./review-insight-cards";
import { ReviewPlatformBreakdown } from "./review-platform-breakdown";
import { IconBack, IconChart, IconCheck, IconClose } from "./review-icons";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewport, setViewport] = useState<"unknown" | "mobile" | "desktop">("unknown");
  const [reportOpen, setReportOpen] = useState(false);
  const [brief, setBrief] = useState<ClientCreatorBrief | null>(null);
  const [note, setNote] = useState("");
  const [localSelection, setLocalSelection] = useState<Record<string, ClientCreatorSelectionState> | null>(
    null
  );
  const selection = localSelection ?? Object.fromEntries(view.creators.map((creator) => [creator.creatorId, creator.selection]));
  const counts = countSelections(
    selection,
    view.creators.map((creator) => creator.creatorId)
  );

  const filtered = useMemo(
    () =>
      view.creators.filter((creator) => {
        const state = selection[creator.creatorId] ?? creator.selection;
        if (statusFilter === "recommended") return state !== "rejected";
        if (statusFilter !== "all" && state !== statusFilter) return false;
        return true;
      }),
    [statusFilter, view.creators, selection]
  );

  const filterCounts = {
    all: view.creators.length,
    recommended: counts.accepted + counts.inReview,
    accepted: counts.accepted,
    in_review: counts.inReview,
    rejected: counts.rejected,
  };

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const sync = () => setViewport(media.matches ? "mobile" : "desktop");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const activeId =
    selectedId && filtered.some((creator) => creator.creatorId === selectedId)
      ? selectedId
      : viewport === "desktop"
        ? (filtered[0]?.creatorId ?? null)
        : selectedId;

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    loadCreatorBriefAction({ token, creatorId: activeId }).then((result) => {
      if (!cancelled && result.ok) setBrief(result.brief);
    });
    return () => {
      cancelled = true;
    };
  }, [activeId, token]);

  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sheetOpen]);

  const selected = view.creators.find((creator) => creator.creatorId === activeId) ?? null;
  const selectedIndex = selected
    ? view.creators.findIndex((creator) => creator.creatorId === selected.creatorId)
    : 0;
  const showDetail = Boolean(selected) && (sheetOpen || viewport === "desktop");

  function openCreator(creatorId: string) {
    setSelectedId(creatorId);
    setNote("");
    setReportOpen(false);
    if (viewport === "mobile") setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setReportOpen(false);
    if (viewport === "mobile") setSelectedId(null);
  }

  function decide(creator: ClientCreatorCard, state: ClientCreatorSelectionState, reason?: string) {
    setLocalSelection((current) => ({
      ...(current ?? selection),
      [creator.creatorId]: state,
    }));
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
    const ids = creatorIds?.length ? creatorIds : view.creators.map((creator) => creator.creatorId);
    setLocalSelection((current) => {
      const next = { ...(current ?? selection) };
      for (const id of ids) next[id] = state;
      return next;
    });
    startTransition(async () => {
      await bulkSelectCreatorsAction({ token, state, creatorIds });
      router.refresh();
    });
  }

  function toggleChecked(creator: ClientCreatorCard, checked: boolean) {
    decide(creator, checked ? "accepted" : "in_review");
  }

  return (
    <div className="creators-page">
      <ProposalSummaryCard view={view} token={token} selection={selection} variant="bar" />
      <p className="note" style={{ marginBottom: 12 }}>
        {rosterHeadline(view.creators.length)}. {rosterSourceLine(view.review.source)}. Select
        creators to calculate investment, then approve the selection.
      </p>
      <div className="filters">
        {STATUS_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={statusFilter === item.id ? "fbtn active" : "fbtn"}
            onClick={() => setStatusFilter(item.id)}
          >
            {item.label}
            <span className="n">{filterCounts[item.id]}</span>
          </button>
        ))}
        {view.canDecide ? (
          <>
            <button type="button" className="fbtn" disabled={pending} onClick={() => bulk("accepted")}>
              Select all
            </button>
            <button type="button" className="fbtn" disabled={pending} onClick={() => bulk("in_review")}>
              Clear
            </button>
          </>
        ) : null}
      </div>

      <div className="md">
        <div className="clist2">
          {filtered.map((creator, index) => (
            <button
              key={creator.creatorId}
              type="button"
              className={creator.creatorId === activeId ? "lc sel" : "lc"}
              onClick={() => openCreator(creator.creatorId)}
            >
              {view.canDecide ? (
                <input
                  type="checkbox"
                  className="pick"
                  checked={(selection[creator.creatorId] ?? creator.selection) === "accepted"}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => toggleChecked(creator, event.currentTarget.checked)}
                  aria-label={`Select ${creator.displayName}`}
                />
              ) : null}
              <ReviewAvatar
                className="av"
                url={creator.avatarUrl}
                profileUrl={creator.profileUrl}
                name={clientCreatorIdentity(creator.displayName, creator.handle).name}
                index={view.creators.findIndex((item) => item.creatorId === creator.creatorId) || index}
                token={token}
              />
              <div className="info">
                {(() => {
                  const identity = clientCreatorIdentity(creator.displayName, creator.handle);
                  return (
                    <>
                      <div className="nm">{identity.name}</div>
                      {identity.handle ? <div className="hd">{formatHandleLabel(identity.handle)}</div> : null}
                    </>
                  );
                })()}
                {formatLocation(creator.city, creator.country) ? (
                  <div className="mt loc">
                    {`${flagFromCountry(creator.country)} ${formatLocation(creator.city, creator.country)}`.trim()}
                  </div>
                ) : null}
                <ReviewPlatformBreakdown rows={breakdownForCreator(creator)} variant="list" />
                <ReviewDeliverableStrip
                  items={creator.deliverableItems}
                  fallback={creator.deliverables}
                  showPlatforms={false}
                />
              </div>
              <span className={statusClass(selection[creator.creatorId] ?? creator.selection)}>
                {CLIENT_CREATOR_STATUS_LABEL[selection[creator.creatorId] ?? creator.selection]}
              </span>
            </button>
          ))}
          {filtered.length === 0 ? <p className="unavailable">No creators match these filters.</p> : null}
        </div>

        {selected ? (
          <CreatorDetailPane
            creator={{
              ...selected,
              selection: selection[selected.creatorId] ?? selected.selection,
            }}
            brief={brief?.creatorId === selected.creatorId ? brief : null}
            index={Math.max(0, selectedIndex)}
            token={token}
            currency={view.commercial.currency}
            canDecide={view.canDecide}
            pending={pending}
            note={note}
            onNoteChange={setNote}
            show={showDetail}
            onBack={closeSheet}
            onAccept={() => decide(selected, nextAcceptState(selection[selected.creatorId] ?? selected.selection))}
            onReject={() => decide(selected, "rejected", note.trim() || undefined)}
            onRequestChanges={() => {
              if (!note.trim()) return;
              startTransition(async () => {
                await addReviewCommentAction({
                  token,
                  targetType: "creator",
                  targetId: selected.creatorId,
                  message: `Change request: ${note.trim()}`,
                });
                setNote("");
                router.refresh();
              });
            }}
            onOpenReport={() => setReportOpen(true)}
            cpm={view.mediaPlanSummary.creatorForecasts[selected.creatorId]?.cpm}
          />
        ) : (
          <div className="detail">
            <div className="dt-body">
              <p className="unavailable">Select a creator to review the profile.</p>
            </div>
          </div>
        )}
      </div>

      {selected ? (
        <AdvancedReportModal
          key={selected.creatorId}
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          creator={{
            ...selected,
            selection: selection[selected.creatorId] ?? selected.selection,
          }}
          brief={brief?.creatorId === selected.creatorId ? brief : null}
          currency={view.commercial.currency}
          index={Math.max(0, selectedIndex)}
          token={token}
        />
      ) : null}
    </div>
  );
}

function CreatorDetailPane({
  creator,
  brief,
  index,
  token,
  currency,
  canDecide,
  pending,
  note,
  onNoteChange,
  show,
  onBack,
  onAccept,
  onReject,
  onRequestChanges,
  onOpenReport,
  cpm,
}: {
  creator: ClientCreatorCard;
  brief: ClientCreatorBrief | null;
  index: number;
  token: string;
  currency: string;
  canDecide: boolean;
  pending: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  show: boolean;
  onBack: () => void;
  onAccept: () => void;
  onReject: () => void;
  onRequestChanges: () => void;
  onOpenReport: () => void;
  cpm?: number;
}) {
  const location = brief?.location || formatLocation(creator.city, creator.country);
  const investmentAmount = brief?.investmentAmount ?? creator.investmentAmount;
  const investmentCurrency = brief?.investmentCurrency ?? creator.investmentCurrency ?? currency;
  const audience = brief?.audience ?? creator.audience;
  const performance = brief?.performance ?? creator.performance;
  const categoryFallback = brief?.categories.length
    ? brief.categories
    : creator.categories?.length
      ? creator.categories
      : [creator.category, creator.niche];
  const contentCategories = brief?.contentCategories.length
    ? brief.contentCategories
    : creator.contentCategories;
  const posts = (brief?.contentFeed.length ? brief.contentFeed : creator.contentFeed ?? creator.contentExamples) ?? [];
  const platformRows = breakdownForCreator(creator, brief);
  const identity = clientCreatorIdentity(
    brief?.displayName || creator.displayName,
    brief?.handle || creator.handle
  );
  const name = identity.name;
  const handleLabel = formatHandleLabel(identity.handle);
  const profileLinks = creatorProfileLinks(platformRows, {
    platform: creator.platform,
    handle: identity.handle || creator.handle,
    profileUrl: brief?.profileUrl || creator.profileUrl,
  });
  const primaryProfileUrl = profileLinks[0]?.url;
  const multiPlatform =
    platformRows.filter((row) => row.platform && row.platform !== "_other").length > 1;
  const brands = brief?.brandMentions.length ? brief.brandMentions : creator.brandMentions ?? [];
  const match = formatMatchPercent(brief?.matchPercent ?? creator.matchPercent);
  const quality = qualityBadge(audience?.qualityLabel);
  const gauge = qualityGaugePercent(audience?.qualityLabel);
  const cpe = creator.cpe;
  const likes = multiPlatform ? undefined : performance?.avgLikes ?? creator.avgLikes;
  const comments = multiPlatform ? undefined : performance?.avgComments ?? creator.avgComments;
  const views = multiPlatform ? undefined : performance?.avgViews ?? creator.avgViews;
  const reach = performance?.estimatedReach ?? creator.estimatedReach;
  const audienceMatch =
    brief?.matchExplanation ||
    creator.matchExplanation ||
    audience?.summary ||
    (match ? `Campaign match ${match}` : TO_BE_CONFIRMED);

  return (
    <aside className={show ? "detail show" : "detail"}>
      <button type="button" className="dt-back" onClick={onBack}>
        <IconBack />
        Back to creators
      </button>
      <div className="dt-hero2">
        {primaryProfileUrl ? (
          <a className="portrait-link" href={primaryProfileUrl} target="_blank" rel="noopener noreferrer">
            <ReviewAvatar
              className="portrait"
              initialsClassName="ini"
              url={brief?.avatarUrl || creator.avatarUrl}
              profileUrl={brief?.profileUrl || creator.profileUrl}
              name={name}
              index={index}
              token={token}
            />
          </a>
        ) : (
          <ReviewAvatar
            className="portrait"
            initialsClassName="ini"
            url={brief?.avatarUrl || creator.avatarUrl}
            profileUrl={brief?.profileUrl || creator.profileUrl}
            name={name}
            index={index}
            token={token}
          />
        )}
        <div className="dt-meta">
          {primaryProfileUrl ? (
            <a className="nm" href={primaryProfileUrl} target="_blank" rel="noopener noreferrer">
              {name}
            </a>
          ) : (
            <p className="nm">{name}</p>
          )}
          {handleLabel ? (
            primaryProfileUrl ? (
              <a className="hd" href={primaryProfileUrl} target="_blank" rel="noopener noreferrer">
                {handleLabel}
              </a>
            ) : (
              <p className="hd">{handleLabel}</p>
            )
          ) : null}
          <div className="mchips">
            {location ? (
              <span className="mchip">
                {flagFromCountry(creator.country)} {location}
              </span>
            ) : null}
            {contentCategoriesForDisplay(contentCategories, categoryFallback)
              .slice(0, 2)
              .map((category) => (
              <span className="mchip" key={category.label}>
                {category.label}
              </span>
            ))}
            <span className={statusClass(creator.selection)}>{CLIENT_CREATOR_STATUS_LABEL[creator.selection]}</span>
          </div>
          <ReviewPlatformBreakdown rows={platformRows} variant="detail" />
          <div className="dt-quick invest-only">
            <div className="q">
              <p className="l">Investment</p>
              <p className="v">
                {investmentAmount != null ? formatMoneyKpi(investmentAmount, investmentCurrency) : TO_BE_CONFIRMED}
              </p>
            </div>
          </div>
          {canDecide ? (
            <div className="dt-acts">
              <button type="button" className={creator.selection === "accepted" ? "btn" : "btn ok"} disabled={pending} onClick={onAccept}>
                {creator.selection === "accepted" ? (
                  <>
                    <IconClose />
                    Remove accept
                  </>
                ) : (
                  <>
                    <IconCheck />
                    Accept
                  </>
                )}
              </button>
              <button type="button" className="btn rej" disabled={pending} onClick={onReject}>
                <IconClose />
                Reject
              </button>
              <button type="button" className="btn" disabled={pending || !note.trim()} onClick={onRequestChanges}>
                Request changes
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="dt-body">
        {canDecide ? (
          <div className="sec">
            <p className="st">Notes and status updates</p>
            <textarea
              className="noteinput"
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Create note…"
              disabled={!canDecide}
            />
          </div>
        ) : null}
        {profileLinks.length > 0 ? (
          <div className="sec">
            <p className="st">Creator profile URL</p>
            <ReviewCreatorProfileLinks links={profileLinks} />
          </div>
        ) : null}
        <div className="sec">
          <p className="st">Recent publications</p>
          {!brief && posts.length === 0 ? (
            <p className="unavailable">Loading content…</p>
          ) : (
            <ContentFeatureGrid posts={posts} token={token} deliverableItems={creator.deliverableItems} />
          )}
        </div>
        <div className="sec">
          <p className="st">Content categories</p>
          <ContentCategoryGrid items={contentCategories} fallback={categoryFallback} />
        </div>
        <div className="sec">
          <p className="st">Expected costs</p>
          <div className="duo">
            <div className="mc">
              <p className="l">Cost per engagement (CPE)</p>
              <p className="v">{cpe != null ? formatMoneyKpi(cpe, currency) : NOT_AVAILABLE}</p>
            </div>
            <div className="mc">
              <p className="l">Cost per mille (CPM)</p>
              <p className="v">{cpm != null ? formatMoneyKpi(cpm, currency) : NOT_AVAILABLE}</p>
            </div>
          </div>
        </div>
        <div className="sec">
          <p className="st">Audience match</p>
          <p className="desc" style={{ marginBottom: 12 }}>{audienceMatch}</p>
          <div className="split">
            <div className="matchbox">
              <p className="mh">Geo match</p>
              {audience?.locations.length ? (
                <AudienceBars items={audience.locations} />
              ) : (
                <p className="unavailable">{TO_BE_CONFIRMED}</p>
              )}
            </div>
            <div className="matchbox">
              <p className="mh">Age & gender match</p>
              {audience && (audience.ages.length > 0 || audience.genders.length > 0) ? (
                <>
                  {audience.ages.length > 0 ? <AudienceBars items={audience.ages} /> : null}
                  {audience.genders.length > 0 ? (
                    <div style={{ marginTop: 12 }}>
                      <AudienceBars items={audience.genders} />
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="unavailable">{TO_BE_CONFIRMED}</p>
              )}
            </div>
          </div>
        </div>
        <div className="sec">
          <p className="st">Audience quality</p>
          {quality && gauge != null ? (
            <>
              <div className="bench">
                <span className="n">{quality.text}</span>
                <span className={`badge ${quality.className}`}>{audience?.qualityLabel}</span>
              </div>
              <div className="gauge">
                <span className="mk" style={{ left: `calc(${gauge}% - 2px)` }} />
              </div>
              <div className="gauge-l">
                <span className="lo">Low</span>
                <span>Average</span>
                <span className="hi">Excellent</span>
              </div>
            </>
          ) : (
            <p className="unavailable">Audience quality unavailable</p>
          )}
        </div>
        {multiPlatform ? null : (
        <div className="sec">
          <p className="st">Average engagement</p>
          <div className="trio">
            <div className="mc">
              <p className="l">Avg. likes</p>
              <p className="v sm">{formatCompactCount(likes)}</p>
            </div>
            <div className="mc">
              <p className="l">Avg. views</p>
              <p className="v sm">{formatCompactCount(views)}</p>
            </div>
            <div className="mc">
              <p className="l">Avg. comments</p>
              <p className="v sm">{formatCompactCount(comments)}</p>
            </div>
          </div>
        </div>
        )}
        <EstimatedReachCard reach={reach} followers={creator.followers} />
        <BrandMentionsCard mentions={brands} token={token} />
        <div className="sec">
          <button type="button" className="btn primary" onClick={onOpenReport} style={{ width: "100%", justifyContent: "center" }}>
            <IconChart />
            View advanced report
          </button>
        </div>
      </div>
    </aside>
  );
}

function statusClass(state: ClientCreatorSelectionState): string {
  if (state === "accepted") return "sc ok";
  if (state === "rejected") return "sc rej";
  return "sc";
}

function AudienceBars({ items }: { items: ClientAudienceSlice[] }) {
  const max = Math.max(...items.map((item) => item.percent ?? 0), 1);
  return (
    <div className="barset">
      {items.map((item) => (
        <div className="bar" key={item.label}>
          <span className="bl">{item.label}</span>
          <span className="bt">
            <span className="bf" style={{ width: `${((item.percent ?? 0) / max) * 100}%` }} />
          </span>
          <span className="bn">{item.percent != null ? `${Math.round(item.percent)}%` : "—"}</span>
        </div>
      ))}
    </div>
  );
}
