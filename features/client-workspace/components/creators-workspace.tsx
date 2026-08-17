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
import { deliverablesLabel } from "../deliverables";
import {
  DATA_NOT_AVAILABLE,
  formatCompactCount,
  formatEngagementPct,
  formatLocation,
  formatMatchPercent,
  formatPlatformLabel,
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
import { countSelections } from "../status";
import type { ClientCreatorBrief, ClientCreatorCard, ClientWorkspaceView } from "../types";
import { AdvancedReportModal, ContentFeatureGrid, isInstagram } from "./advanced-report-modal";
import { ReviewAvatar } from "./review-avatar";
import { IconBack, IconCat, IconChart, IconCheck, IconClose, IconIg } from "./review-icons";

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
  const counts = countSelections(
    Object.fromEntries(view.creators.map((creator) => [creator.creatorId, creator.selection])),
    view.creators.map((creator) => creator.creatorId)
  );

  const filtered = useMemo(
    () =>
      view.creators.filter((creator) => {
        if (statusFilter === "recommended") return creator.selection !== "rejected";
        if (statusFilter !== "all" && creator.selection !== statusFilter) return false;
        return true;
      }),
    [statusFilter, view.creators]
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

  function bulk(state: ClientCreatorSelectionState) {
    startTransition(async () => {
      await bulkSelectCreatorsAction({ token, state });
      router.refresh();
    });
  }

  return (
    <>
      <p className="note" style={{ marginBottom: 12 }}>
        {rosterHeadline(view.creators.length)}. {rosterSourceLine(view.review.source)}.
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
              <ReviewAvatar
                className="av"
                url={creator.avatarUrl}
                name={creator.displayName}
                index={view.creators.findIndex((item) => item.creatorId === creator.creatorId) || index}
              >
                {isInstagram(creator.platform) ? (
                  <span className="ig">
                    <IconIg />
                  </span>
                ) : null}
              </ReviewAvatar>
              <div className="info">
                <div className="nm">{creator.displayName}</div>
                <div className="mt">
                  {[
                    creator.handle,
                    formatCompactCount(creator.followers),
                    `${flagFromCountry(creator.country)} ${formatLocation(creator.city, creator.country) ?? ""}`.trim(),
                    formatEngagementPct(creator.engagementRate),
                  ]
                    .filter((part) => part && part !== NOT_AVAILABLE)
                    .join(" · ")}
                </div>
                <div className="dl">{deliverablesLabel(creator.deliverableItems, creator.deliverables)}</div>
              </div>
              <span className={statusClass(creator.selection)}>
                {CLIENT_CREATOR_STATUS_LABEL[creator.selection]}
              </span>
            </button>
          ))}
          {filtered.length === 0 ? <p className="unavailable">No creators match these filters.</p> : null}
        </div>

        {selected ? (
          <CreatorDetailPane
            creator={selected}
            brief={brief?.creatorId === selected.creatorId ? brief : null}
            index={Math.max(0, selectedIndex)}
            currency={view.commercial.currency}
            canDecide={view.canDecide}
            pending={pending}
            note={note}
            onNoteChange={setNote}
            show={showDetail}
            onBack={closeSheet}
            onAccept={() => decide(selected, "accepted")}
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
          creator={selected}
          brief={brief?.creatorId === selected.creatorId ? brief : null}
          currency={view.commercial.currency}
          index={Math.max(0, selectedIndex)}
        />
      ) : null}
    </>
  );
}

function CreatorDetailPane({
  creator,
  brief,
  index,
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
}: {
  creator: ClientCreatorCard;
  brief: ClientCreatorBrief | null;
  index: number;
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
}) {
  const name = brief?.displayName || creator.displayName;
  const handle = brief?.handle || creator.handle;
  const platform = formatPlatformLabel(brief?.platform || creator.platform);
  const location = brief?.location || formatLocation(creator.city, creator.country);
  const followers = brief?.followers ?? creator.followers;
  const er = brief?.engagementRate ?? creator.engagementRate;
  const investmentAmount = brief?.investmentAmount ?? creator.investmentAmount;
  const investmentCurrency = brief?.investmentCurrency ?? creator.investmentCurrency ?? currency;
  const audience = brief?.audience ?? creator.audience;
  const performance = brief?.performance ?? creator.performance;
  const categories = brief?.categories.length
    ? brief.categories
    : creator.categories?.length
      ? creator.categories
      : [creator.category, creator.niche].filter((value): value is string => Boolean(value));
  const posts = (brief?.contentFeed.length ? brief.contentFeed : creator.contentFeed ?? creator.contentExamples) ?? [];
  const brands = brief?.brandMentions.length ? brief.brandMentions : creator.brandMentions ?? [];
  const match = formatMatchPercent(brief?.matchPercent ?? creator.matchPercent);
  const quality = qualityBadge(audience?.qualityLabel);
  const gauge = qualityGaugePercent(audience?.qualityLabel);
  const cpe = creator.cpe;
  const likes = performance?.avgLikes ?? creator.avgLikes;
  const comments = performance?.avgComments ?? creator.avgComments;
  const views = performance?.avgViews ?? creator.avgViews;
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
        <ReviewAvatar
          className="portrait"
          initialsClassName="ini"
          url={brief?.avatarUrl || creator.avatarUrl}
          name={name}
          index={index}
        >
          {isInstagram(brief?.platform || creator.platform) ? (
            <span className="ig">
              <IconIg />
            </span>
          ) : null}
        </ReviewAvatar>
        <div className="dt-meta">
          <p className="nm">{name}</p>
          <p className="hd">{[handle, platform].filter(Boolean).join(" · ")}</p>
          <div className="mchips">
            {location ? (
              <span className="mchip">
                {flagFromCountry(creator.country)} {location}
              </span>
            ) : null}
            {categories.slice(0, 2).map((category) => (
              <span className="mchip" key={category}>
                {category}
              </span>
            ))}
            <span className={statusClass(creator.selection)}>{CLIENT_CREATOR_STATUS_LABEL[creator.selection]}</span>
          </div>
          <div className="dt-quick">
            <div className="q">
              <p className="l">Followers</p>
              <p className="v">{formatCompactCount(followers)}</p>
            </div>
            <div className="q">
              <p className="l">ER</p>
              <p className="v">{formatEngagementPct(er)}</p>
            </div>
            <div className="q">
              <p className="l">Investment</p>
              <p className="v">
                {investmentAmount != null ? formatMoneyKpi(investmentAmount, investmentCurrency) : TO_BE_CONFIRMED}
              </p>
            </div>
          </div>
          {canDecide ? (
            <div className="dt-acts">
              <button type="button" className="btn ok" disabled={pending} onClick={onAccept}>
                <IconCheck />
                Accept
              </button>
              <button type="button" className="btn" disabled={pending} onClick={onReject}>
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
        <div className="sec">
          <p className="st">Notes</p>
          <textarea
            className="noteinput"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Add a note, reject reason, or change request"
            disabled={!canDecide}
          />
        </div>
        <div className="sec">
          <p className="st">Recent content</p>
          <ContentFeatureGrid posts={posts} />
        </div>
        <div className="sec">
          <p className="st">Categories</p>
          {categories.length > 0 ? (
            <div className="cats">
              {categories.slice(0, 6).map((category) => (
                <div className="catc" key={category}>
                  <div className="ic">
                    <IconCat />
                  </div>
                  <p className="l">{category}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="unavailable">Category unavailable</p>
          )}
        </div>
        <div className="sec">
          <p className="st">Efficiency</p>
          <div className="duo">
            <div className="mc">
              <p className="l">CPE</p>
              <p className="v">{cpe != null ? formatMoneyKpi(cpe, currency) : NOT_AVAILABLE}</p>
            </div>
            <div className="mc">
              <p className="l">Campaign match</p>
              <p className="v">{match ?? NOT_AVAILABLE}</p>
            </div>
          </div>
        </div>
        <div className="sec">
          <p className="st">Audience match</p>
          <p className="desc">{audienceMatch}</p>
        </div>
        {quality && gauge != null ? (
          <div className="sec">
            <p className="st">Audience quality</p>
            <div className="bench">
              <span className="n">{quality.text}</span>
              <span className={`badge ${quality.className}`}>{audience?.qualityLabel}</span>
            </div>
            <div className="gauge">
              <span className="mk" style={{ left: `calc(${gauge}% - 2px)` }} />
            </div>
            <div className="gauge-l">
              <span>Monitor</span>
              <span>Good</span>
              <span>High</span>
            </div>
          </div>
        ) : null}
        <div className="sec">
          <p className="st">Performance</p>
          <div className="trio">
            <div className="mc">
              <p className="l">Avg likes</p>
              <p className="v sm">{formatCompactCount(likes)}</p>
            </div>
            <div className="mc">
              <p className="l">Avg comments</p>
              <p className="v sm">{formatCompactCount(comments)}</p>
            </div>
            <div className="mc">
              <p className="l">Avg views</p>
              <p className="v sm">{formatCompactCount(views)}</p>
            </div>
          </div>
          <div className="mc" style={{ marginTop: 12 }}>
            <p className="l">Est. reach</p>
            <p className="v">{formatCompactCount(reach)}</p>
          </div>
        </div>
        <div className="sec">
          <p className="st">Brand mentions</p>
          {brands.length > 0 ? (
            <div className="brands">
              {brands.slice(0, 8).map((brand, brandIndex) => (
                <span
                  key={brand}
                  className="brand"
                  title={brand}
                  style={{ background: ["#0057FF", "#7F77DD", "#1D9E75", "#D85A30", "#378ADD"][brandIndex % 5] }}
                >
                  {brand.slice(0, 1).toUpperCase()}
                </span>
              ))}
            </div>
          ) : (
            <p className="unavailable">{DATA_NOT_AVAILABLE}</p>
          )}
        </div>
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
