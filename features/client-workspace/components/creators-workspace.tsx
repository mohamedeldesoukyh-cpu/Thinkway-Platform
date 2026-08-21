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
import { deliverablesLabel } from "../deliverables";
import {
  clientCreatorIdentity,
  formatCompactCount,
  formatHandleLabel,
  formatLocation,
  formatMatchPercent,
  NOT_AVAILABLE,
  TO_BE_CONFIRMED,
} from "../format";
import {
  clientStatusDisplay,
  isPricedClientInvestment,
  thinkwayStatusLabel,
} from "../selection-flow";
import {
  flagFromCountry,
  MIX_BAR_COLORS,
  qualityBadge,
  qualityGaugePercent,
  rosterHeadline,
} from "../presentation";
import { contentCategoriesForDisplay, listCreatorCategoryStickers } from "../content-categories";
import { breakdownForCreator, creatorProfileLinks, engagementMetersForBreakdown } from "../platform-breakdown";
import { countSelections, nextAcceptState } from "../status";
import type { ClientAudienceSlice, ClientCreatorBrief, ClientCreatorCard, ClientWorkspaceView } from "../types";
import { AdvancedReportModal, ContentFeatureGrid } from "./advanced-report-modal";
import { ContentCategoryGrid } from "./content-category-grid";
import { useClientWorkspaceState } from "./client-workspace-state";
import { ProposalSummaryCard } from "./proposal-summary-card";
import { ReviewAvatar } from "./review-avatar";
import { ReviewCreatorProfileLinks } from "./review-creator-profile-links";
import { BrandMentionsCard, EstimatedReachCard } from "./review-insight-cards";
import { EngagementMeter, ReviewMeter } from "./review-meter";
import { ReviewPlatformBreakdown } from "./review-platform-breakdown";
import { IconBack, IconChart, IconCheck, IconClose } from "./review-icons";

const STATUS_FILTERS: Array<{ id: "all" | "recommended" | "selected" | "pending" | "rejected"; label: string }> = [
  { id: "all", label: "All" },
  { id: "recommended", label: "Thinkway" },
  { id: "selected", label: "Selected" },
  { id: "pending", label: "Pricing required" },
  { id: "rejected", label: "Not selected" },
];

export function CreatorsWorkspace({
  view,
  token,
}: {
  view: ClientWorkspaceView;
  token: string;
}) {
  const router = useRouter();
  const { selection: sharedSelection, setCreatorState, setCreatorStates } = useClientWorkspaceState();
  const [pending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["id"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewport, setViewport] = useState<"unknown" | "mobile" | "desktop">("unknown");
  const [reportOpen, setReportOpen] = useState(false);
  const [brief, setBrief] = useState<ClientCreatorBrief | null>(null);
  const [note, setNote] = useState("");
  const [detailClosed, setDetailClosed] = useState(false);
  const selection = sharedSelection;
  const counts = countSelections(
    selection,
    view.creators.map((creator) => creator.creatorId)
  );

  const filtered = useMemo(
    () =>
      view.creators.filter((creator) => {
        const state = selection[creator.creatorId] ?? creator.selection;
        if (statusFilter === "recommended") {
          return creator.thinkwayStatus === "recommended" || creator.thinkwayStatus === "approved" || creator.thinkwayStatus === "finalized";
        }
        if (statusFilter === "selected") return state === "accepted";
        if (statusFilter === "pending") return state === "accepted" && !isPricedClientInvestment(creator.investmentAmount);
        if (statusFilter === "rejected") return state !== "accepted";
        return true;
      }),
    [statusFilter, view.creators, selection]
  );

  const filterCounts = {
    all: view.creators.length,
    recommended: view.creators.filter(
      (creator) =>
        creator.thinkwayStatus === "recommended" ||
        creator.thinkwayStatus === "approved" ||
        creator.thinkwayStatus === "finalized"
    ).length,
    selected: counts.accepted,
    pending: view.creators.filter(
      (creator) =>
        (selection[creator.creatorId] ?? creator.selection) === "accepted" &&
        !isPricedClientInvestment(creator.investmentAmount)
    ).length,
    rejected: counts.inReview + counts.rejected,
  };

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const sync = () => setViewport(media.matches ? "mobile" : "desktop");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const activeId =
    detailClosed
      ? null
      : selectedId && filtered.some((creator) => creator.creatorId === selectedId)
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
    setDetailClosed(false);
    setSelectedId(creatorId);
    setNote("");
    setReportOpen(false);
    if (viewport === "mobile") setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setReportOpen(false);
    setDetailClosed(true);
    if (viewport === "mobile") setSelectedId(null);
  }

  function decide(creator: ClientCreatorCard, state: ClientCreatorSelectionState, reason?: string) {
    setCreatorState(creator.creatorId, state);
    startTransition(async () => {
      await selectCreatorAction({
        token,
        creatorId: creator.creatorId,
        state,
        creatorName: creator.displayName,
        reason,
      });
    });
  }

  function bulk(state: ClientCreatorSelectionState, creatorIds?: string[]) {
    const ids = creatorIds?.length ? creatorIds : view.creators.map((creator) => creator.creatorId);
    setCreatorStates(Object.fromEntries(ids.map((id) => [id, state])));
    startTransition(async () => {
      await bulkSelectCreatorsAction({ token, state, creatorIds });
    });
  }

  function toggleChecked(creator: ClientCreatorCard, checked: boolean) {
    decide(creator, checked ? "accepted" : "in_review");
  }

  return (
    <div className="creators-page">
      <div className="toolbar">
        <div className="segs">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={statusFilter === item.id ? "seg on" : "seg"}
              onClick={() => setStatusFilter(item.id)}
            >
              {item.label}
              <span className="n">{filterCounts[item.id]}</span>
            </button>
          ))}
        </div>
        <div className="sp" />
        {view.canDecide ? (
          <>
            <button type="button" className="link" disabled={pending} onClick={() => bulk("accepted")}>
              Select all
            </button>
            <button type="button" className="link" disabled={pending} onClick={() => bulk("in_review")}>
              Clear
            </button>
          </>
        ) : null}
      </div>
      <ProposalSummaryCard view={view} token={token} selection={selection} variant="bar" />
      <p className="note" style={{ marginBottom: 12 }}>
        {rosterHeadline(view.creators.length)}. Select the creators you want in your campaign.
        Investment is shown when Thinkway has confirmed a client-facing price.
      </p>

      <div className="layout">
        <div className="clist">
          {filtered.map((creator, index) => {
            const identity = clientCreatorIdentity(creator.displayName, creator.handle);
            const categories = listCreatorCategoryStickers(
              brief?.creatorId === creator.creatorId ? { ...creator, ...brief } : creator
            );
            const location = formatLocation(creator.city, creator.country);
            const sub = [formatHandleLabel(identity.handle), location].filter(Boolean).join(" · ");
            const state = selection[creator.creatorId] ?? creator.selection;
            return (
            <div
              key={creator.creatorId}
              className={creator.creatorId === activeId ? "cc sel" : "cc"}
            >
              {view.canDecide ? (
                <label className="pick-hit">
                  <input
                    type="checkbox"
                    className="pick"
                    checked={state === "accepted"}
                    onChange={(event) => toggleChecked(creator, event.currentTarget.checked)}
                    aria-label={`Select ${creator.displayName}`}
                  />
                </label>
              ) : null}
              <button
                type="button"
                className="cc-main"
                onClick={() => openCreator(creator.creatorId)}
              >
              <ReviewAvatar
                className="photo"
                initialsClassName="ini"
                url={creator.avatarUrl}
                profileUrl={creator.profileUrl}
                handle={creator.handle}
                platform={creator.platform}
                platformAccounts={creator.platformAccounts}
                name={identity.name}
                index={view.creators.findIndex((item) => item.creatorId === creator.creatorId) || index}
                token={token}
              />
              <div className="body">
                <div className="nmrow">
                  <div className="nm">{identity.name}</div>
                  {categories.length > 0 ? (
                    <div className="ctags">
                      {categories.map((label) => (
                        <span className="tag" key={label}>
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                {sub ? <div className="sub">{sub}</div> : null}
                <ReviewPlatformBreakdown
                  rows={breakdownForCreator(
                    creator,
                    brief?.creatorId === creator.creatorId ? brief : null
                  )}
                  variant="list"
                />
                <div className="ccfoot">
                  <span className="deliv">
                    {deliverablesLabel(creator.deliverableItems, creator.deliverables) || "Deliverables: To be confirmed"}
                  </span>
                  <span className={isPricedClientInvestment(creator.investmentAmount) ? "inv" : "inv tbc"}>
                    {isPricedClientInvestment(creator.investmentAmount)
                      ? formatMoneyKpi(creator.investmentAmount!, creator.investmentCurrency || view.commercial.currency)
                      : TO_BE_CONFIRMED}
                  </span>
                </div>
                <div className="ccfoot">
                  {thinkwayStatusLabel(creator.thinkwayStatus) ? (
                    <span className="sc ok">{thinkwayStatusLabel(creator.thinkwayStatus)}</span>
                  ) : null}
                  <span className={statusClass(state)}>
                    {clientStatusDisplay({
                      selection: state,
                      selectionConfirmed: Boolean(view.journey?.selectionConfirmed),
                      commerciallyApproved: view.journey?.quotationStage === "approved",
                    })}
                  </span>
                  {state === "accepted" && !isPricedClientInvestment(creator.investmentAmount) ? (
                    <span className="sc warn">Pricing required</span>
                  ) : null}
                </div>
              </div>
              </button>
            </div>
            );
          })}
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
            <div className="empty">
              <p style={{ marginTop: 12, fontWeight: 600, color: "var(--ink)" }}>Select a creator</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Choose a creator to see their full profile and metrics.</p>
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
      <div className="dhead">
        <button type="button" className="dt-back" onClick={onBack} aria-label="Back to creators">
          <IconBack />
          Back
        </button>
        <span className="t">Creator card</span>
        <button type="button" className="x" onClick={onBack} aria-label="Close creator card">
          <IconClose />
        </button>
      </div>
      <div className="dhero">
        {primaryProfileUrl ? (
          <a className="portrait-link" href={primaryProfileUrl} target="_blank" rel="noopener noreferrer">
            <ReviewAvatar
              className="ava"
              initialsClassName="ini"
              url={brief?.avatarUrl || creator.avatarUrl}
              profileUrl={brief?.profileUrl || creator.profileUrl}
              handle={brief?.handle || creator.handle}
              platform={brief?.platform || creator.platform}
              platformAccounts={brief?.platformAccounts ?? creator.platformAccounts}
              name={name}
              index={index}
              token={token}
            />
          </a>
        ) : (
          <ReviewAvatar
            className="ava"
            initialsClassName="ini"
            url={brief?.avatarUrl || creator.avatarUrl}
            profileUrl={brief?.profileUrl || creator.profileUrl}
            handle={brief?.handle || creator.handle}
            platform={brief?.platform || creator.platform}
            platformAccounts={brief?.platformAccounts ?? creator.platformAccounts}
            name={name}
            index={index}
            token={token}
          />
        )}
        {primaryProfileUrl ? (
          <a className="nm" href={primaryProfileUrl} target="_blank" rel="noopener noreferrer">
            {name}
          </a>
        ) : (
          <p className="nm">{name}</p>
        )}
        <p className="sub">
          {handleLabel && primaryProfileUrl ? (
            <a href={primaryProfileUrl} target="_blank" rel="noopener noreferrer">
              {handleLabel}
            </a>
          ) : handleLabel ? (
            handleLabel
          ) : null}
          {handleLabel && location ? " · " : null}
          {location}
        </p>
        <div className="dtags">
          {creator.country ? <span className="tag g">{flagFromCountry(creator.country)}</span> : null}
          {contentCategoriesForDisplay(contentCategories, categoryFallback)
            .slice(0, 2)
            .map((category) => (
              <span className="tag" key={category.label}>
                {category.label}
              </span>
            ))}
          <span className={`tag g ${statusClass(creator.selection)}`}>
            {clientStatusDisplay({
              selection: creator.selection,
              selectionConfirmed: false,
              commerciallyApproved: false,
            })}
          </span>
          {thinkwayStatusLabel(creator.thinkwayStatus) ? (
            <span className="tag g sc ok">{thinkwayStatusLabel(creator.thinkwayStatus)}</span>
          ) : null}
          {creator.selection === "accepted" && !isPricedClientInvestment(investmentAmount) ? (
            <span className="tag g sc warn">Pricing required</span>
          ) : null}
        </div>
        {canDecide ? (
          <div className="dacts">
            <button
              type="button"
              className={creator.selection === "accepted" ? "btn pri" : "btn ok"}
              disabled={pending}
              onClick={onAccept}
            >
              {creator.selection === "accepted" ? (
                <>
                  <IconCheck />
                  Selected
                </>
              ) : (
                <>
                  <IconCheck />
                  Select
                </>
              )}
            </button>
            <button type="button" className="btn no" disabled={pending} onClick={onReject}>
              <IconClose />
              Reject
            </button>
            <button type="button" className="btn sec" disabled={pending || !note.trim()} onClick={onRequestChanges}>
              Request changes
            </button>
          </div>
        ) : null}
      </div>
      <div className="dbody">
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
          <p className="st">Platform audience</p>
          <ReviewPlatformBreakdown rows={platformRows} variant="detail" />
        </div>
        <div className="sec">
          <p className="st">Expected costs</p>
          <div className="duo">
            <div className="mc">
              <p className="l">Cost per engagement</p>
              <p className={cpe != null ? "v sm" : "v sm tbc"}>
                {cpe != null ? formatMoneyKpi(cpe, currency) : NOT_AVAILABLE}
              </p>
            </div>
            <div className="mc">
              <p className="l">Cost per mille</p>
              <p className={cpm != null ? "v sm" : "v sm tbc"}>
                {cpm != null ? formatMoneyKpi(cpm, currency) : NOT_AVAILABLE}
              </p>
            </div>
            <div className="mc">
              <p className="l">Investment</p>
              <p className={isPricedClientInvestment(investmentAmount) ? "v sm" : "v sm tbc"}>
                {isPricedClientInvestment(investmentAmount)
                  ? formatMoneyKpi(investmentAmount!, investmentCurrency)
                  : TO_BE_CONFIRMED}
              </p>
            </div>
          </div>
          {creator.selection === "accepted" && !isPricedClientInvestment(investmentAmount) ? (
            <p className="note" style={{ marginTop: 10 }}>
              This creator has been selected but does not have a confirmed investment yet.
            </p>
          ) : null}
        </div>
        <div className="sec">
          <p className="st">Audience match</p>
          <p className="desc" style={{ marginBottom: 12 }}>{audienceMatch}</p>
          <div className="duo">
            <div className="mc">
              <p className="l">Geo match</p>
              {audience?.locations.length ? (
                <AudienceBars items={audience.locations} />
              ) : (
                <p className="v tbc">{TO_BE_CONFIRMED}</p>
              )}
            </div>
            <div className="mc">
              <p className="l">Age & gender</p>
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
                <p className="v tbc">{TO_BE_CONFIRMED}</p>
              )}
            </div>
          </div>
        </div>
        <div className="sec">
          <p className="st">Engagement rate by platform</p>
          {engagementMetersForBreakdown(platformRows, brief?.engagementRate ?? creator.engagementRate).map(
            (meter) => (
              <EngagementMeter
                key={meter.platform ?? "engagement"}
                platform={meter.platform}
                rate={meter.rate}
              />
            )
          )}
          {quality && gauge != null ? (
            <ReviewMeter
              label="Audience quality"
              value={quality.text}
              percent={gauge}
              badge={quality}
            />
          ) : null}
          {multiPlatform ? null : (
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
          )}
        </div>
        <EstimatedReachCard reach={reach} followers={creator.followers} />
        <BrandMentionsCard mentions={brands} token={token} />
        <button type="button" className="btn sec" onClick={onOpenReport} style={{ width: "100%", justifyContent: "center", marginTop: 14 }}>
          <IconChart />
          View advanced report
        </button>
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
      {items.map((item, index) => (
        <div className="bar" key={item.label}>
          <span className="bl">{item.label}</span>
          <span className="bt">
            <span
              className="bf"
              style={{
                width: `${((item.percent ?? 0) / max) * 100}%`,
                background: MIX_BAR_COLORS[index % MIX_BAR_COLORS.length],
              }}
            />
          </span>
          <span className="bn">{item.percent != null ? `${Math.round(item.percent)}%` : "—"}</span>
        </div>
      ))}
    </div>
  );
}
