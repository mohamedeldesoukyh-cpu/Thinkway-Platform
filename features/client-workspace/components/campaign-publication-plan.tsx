"use client";

import { useEffect, useMemo, useState } from "react";

import { DocumentationUnitScriptActions } from "@/features/campaigns/components/script/documentation-unit-script-actions";
import { DocumentationUnitScriptSheet } from "@/features/campaigns/components/script/documentation-unit-script-sheet";
import {
  clientPostDocumentationScriptUnit,
  documentationUnitSummaryForClientPost,
  type CampaignScriptUnitPresence,
  type DocumentationUnitScriptIntent,
} from "@/lib/campaign-script";

import { listClientCampaignScriptPresenceAction } from "../actions/campaign-script-actions";
import { TO_BE_CONFIRMED } from "../format";
import {
  formatClientScheduleDate,
  type ClientCampaignPostRow,
} from "../campaign-execution";
import {
  PUBLICATION_PLAN_FOOTNOTE,
  PUBLICATION_PLAN_NOTE,
  clientCampaignDashboardPerformance,
  clientCampaignDashboardPerformanceMetrics,
} from "../campaign-dashboard";
import { matchClientCreatorByName } from "../campaign-tab-aggregates";
import {
  CLIENT_CAMPAIGN_POST_STATUS_LABEL,
  filterPublicationPlanPosts,
  groupPublicationPlanByCreator,
  publicationPlanFilterCounts,
  publicationPlanFormatCounts,
  publicationPlanStatusTone,
  rankedPublicationRows,
  type PublicationPlanFilter,
  type PublicationPlanViewMode,
} from "../campaign-publication-plan";
import type { ClientCreatorCard } from "../types";
import { ReviewPlatformMark } from "./review-platform-mark";
import { ReviewAvatar } from "./review-avatar";
import { PublicationMetricGlyph } from "./review-icons";

const FILTER_CHIPS: Array<{ id: PublicationPlanFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Overdue" },
  { id: "live", label: "Live" },
  { id: "scheduled", label: "Scheduled" },
  { id: "scheduling", label: "To be confirmed" },
  { id: "completed", label: "Completed" },
];

function StatusPill({ status }: { status: ClientCampaignPostRow["status"] }) {
  return (
    <span className={`cx-st cx-st--${publicationPlanStatusTone(status)}`}>
      {CLIENT_CAMPAIGN_POST_STATUS_LABEL[status]}
    </span>
  );
}

function PlatformCell({ row }: { row: ClientCampaignPostRow }) {
  if (!row.platform) return <span className="cx-empty">—</span>;
  return (
    <span className="plat" title={row.platformLabel || row.platform}>
      <i className="ov-pav ov-pav-sm">
        <ReviewPlatformMark platform={row.platform || row.platformLabel} />
      </i>
      {row.platformLabel || row.platform}
    </span>
  );
}

function PublicationPlanAvatar({
  name,
  avatarUrl,
  index,
  token,
  creators,
}: {
  name: string;
  avatarUrl?: string | null;
  index: number;
  token: string;
  creators: Array<
    Pick<ClientCreatorCard, "displayName" | "handle" | "avatarUrl" | "profileUrl" | "platform" | "platformAccounts">
  >;
}) {
  const matched = matchClientCreatorByName(name, creators);
  return (
    <ReviewAvatar
      className="cx-av"
      url={avatarUrl || matched?.avatarUrl}
      profileUrl={matched?.profileUrl}
      handle={matched?.handle}
      platform={matched?.platform}
      platformAccounts={matched?.platformAccounts}
      name={name}
      index={index}
      token={token}
    />
  );
}

function dash(value: string | null | undefined) {
  return value ? value : <span className="cx-empty">—</span>;
}

function PublicationPlanMetrics({
  performance,
  empty = "dash",
  className,
}: {
  performance: ClientCampaignPostRow["performance"];
  empty?: "dash" | "none";
  className?: string;
}) {
  const metrics = clientCampaignDashboardPerformanceMetrics(performance);
  if (metrics.length === 0) {
    if (empty === "none") return null;
    return <span className="cx-empty">—</span>;
  }
  return (
    <span className={className ? `cx-metrics ${className}` : "cx-metrics"}>
      {metrics.map((metric) => (
        <span
          key={metric.key}
          className={`cx-metric cx-metric--${metric.key}`}
          title={`${metric.label}: ${metric.formatted}`}
          aria-label={`${metric.label} ${metric.formatted}`}
        >
          <span className="cx-metric__av" aria-hidden="true">
            <PublicationMetricGlyph kind={metric.key} />
          </span>
          <span className="cx-metric__n">{metric.formatted}</span>
        </span>
      ))}
    </span>
  );
}

function PublicationPlanMobileMetrics({
  performance,
}: {
  performance: ClientCampaignPostRow["performance"];
}) {
  return (
    <PublicationPlanMetrics
      performance={performance}
      empty="none"
      className="cx-show-sm cx-pub-metrics"
    />
  );
}

function clientScriptUnitFromPost(post: ClientCampaignPostRow) {
  const mapped = clientPostDocumentationScriptUnit(post);
  if (!mapped) return null;
  return documentationUnitSummaryForClientPost({
    assignmentDeliverableId: mapped.assignmentDeliverableId,
    assignmentPostScheduleId: mapped.assignmentPostScheduleId,
    unitKey: mapped.unitKey,
    quantity: mapped.quantity,
    sequenceNumber: post.sequenceNumber,
    creatorName: post.creatorName,
    platform: post.platform,
    deliverableLabel: post.deliverable,
  });
}

function DeliverableScriptCell({
  post,
  count = 1,
  scriptPresence,
  token,
  onOpen,
}: {
  post: ClientCampaignPostRow;
  count?: number;
  scriptPresence: ReadonlyMap<string, CampaignScriptUnitPresence>;
  token: string;
  onOpen: (post: ClientCampaignPostRow, intent: DocumentationUnitScriptIntent) => void;
}) {
  const unit = clientScriptUnitFromPost(post);
  const presence = unit ? scriptPresence.get(unit.unitKey) : undefined;
  return (
    <div className="cx-dlv">
      <span className="cx-dlv__n">
        {post.deliverable || TO_BE_CONFIRMED}
        {count > 1 ? <span className="cx-xn">×{count}</span> : null}
      </span>
      {unit && count === 1 ? (
        <DocumentationUnitScriptActions
          variant="client"
          token={token}
          hasScript={Boolean(presence)}
          assignmentDeliverableId={unit.assignmentDeliverableId}
          assignmentPostScheduleId={unit.assignmentPostScheduleId}
          originalFileName={presence?.originalFileName}
          originalMimeType={presence?.originalMimeType}
          hasOriginalDocument={presence?.hasOriginalDocument}
          onAdd={() => onOpen(post, "edit")}
          onUpload={() => onOpen(post, "upload")}
          onOpen={() => onOpen(post, "edit")}
          onPreview={() => onOpen(post, "preview")}
        />
      ) : null}
    </div>
  );
}

export function CampaignPublicationPlan({
  posts,
  creators,
  token,
  focusOverdue = 0,
}: {
  posts: ClientCampaignPostRow[];
  creators: ClientCreatorCard[];
  token: string;
  focusOverdue?: number;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PublicationPlanFilter>("all");
  const [format, setFormat] = useState("all");
  const [view, setView] = useState<PublicationPlanViewMode>("grouped");
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [scriptPresence, setScriptPresence] = useState<Map<string, CampaignScriptUnitPresence>>(
    () => new Map()
  );
  const [scriptSheet, setScriptSheet] = useState<{
    post: ClientCampaignPostRow;
    intent: DocumentationUnitScriptIntent;
  } | null>(null);
  const counts = publicationPlanFilterCounts(posts);
  const statusScoped = useMemo(
    () => filterPublicationPlanPosts(posts, filter, "", "all"),
    [posts, filter]
  );
  const formatCounts = publicationPlanFormatCounts(statusScoped);
  const visible = useMemo(
    () => filterPublicationPlanPosts(posts, filter, query, format),
    [posts, filter, query, format]
  );
  const groups = useMemo(() => groupPublicationPlanByCreator(visible), [visible]);
  const scriptSheetUnit = scriptSheet ? clientScriptUnitFromPost(scriptSheet.post) : null;

  function isOpen(name: string) {
    return opened.has(name);
  }

  useEffect(() => {
    if (filter !== "all" && counts[filter] === 0) {
      setFilter("all");
      setFormat("all");
    }
  }, [filter, counts.all, counts.overdue, counts.live, counts.scheduled, counts.scheduling, counts.completed]);

  useEffect(() => {
    if (focusOverdue <= 0) return;
    const names = [
      ...new Set(
        posts
          .filter((post) => post.status === "overdue")
          .map((post) => post.creatorName.trim() || "Creator")
      ),
    ];
    setFilter("overdue");
    setFormat("all");
    setQuery("");
    setOpened((current) => {
      const next = new Set(current);
      for (const name of names) next.add(name);
      return next;
    });
    document.getElementById("publication-plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Only re-run when the client asks to view overdue — not on every posts refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOverdue]);

  useEffect(() => {
    let cancelled = false;
    void listClientCampaignScriptPresenceAction({ token }).then((result) => {
      if (cancelled || !result.ok) return;
      setScriptPresence(
        new Map(
          result.data.map((row) => [
            row.unitKey,
            {
              scriptId: row.scriptId,
              originalFileName: row.originalFileName,
              originalMimeType: row.originalMimeType,
              hasOriginalDocument: row.hasOriginalDocument,
            },
          ])
        )
      );
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function openScript(post: ClientCampaignPostRow, intent: DocumentationUnitScriptIntent) {
    setScriptSheet({ post, intent });
  }

  function setStatusFilter(next: PublicationPlanFilter) {
    setFilter(next);
    setFormat("all");
  }

  function toggle(creatorName: string) {
    setOpened((current) => {
      const next = new Set(current);
      if (next.has(creatorName)) next.delete(creatorName);
      else next.add(creatorName);
      return next;
    });
  }

  return (
    <section className="card" id="publication-plan">
      <p className="ck">Publication plan</p>
      <h2>Creators and go-live</h2>
      <p className="note">{PUBLICATION_PLAN_NOTE}</p>

      <div className="cx-toolbar">
        <label className="cx-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            type="search"
            value={query}
            placeholder="Search creator or deliverable"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="cx-chips">
          {FILTER_CHIPS.filter((chip) => chip.id === "all" || counts[chip.id] > 0).map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="cx-chip"
              aria-pressed={filter === chip.id}
              onClick={() => setStatusFilter(chip.id)}
            >
              {chip.label} <b>{counts[chip.id]}</b>
            </button>
          ))}
        </div>

        <div className="cx-seg">
          <button
            type="button"
            aria-pressed={view === "grouped"}
            onClick={() => setView("grouped")}
          >
            By creator
          </button>
          <button type="button" aria-pressed={view === "rows"} onClick={() => setView("rows")}>
            All rows
          </button>
        </div>
      </div>
      {formatCounts.length >= 2 ? (
        <div className="cx-chips cx-chips--fmt">
          <span className="cx-fmtlabel">Format</span>
          <button
            type="button"
            className="cx-chip cx-chip--sm"
            aria-pressed={format === "all"}
            onClick={() => setFormat("all")}
          >
            All formats <b>{statusScoped.length}</b>
          </button>
          {formatCounts.map((entry) => (
            <button
              key={entry.format}
              type="button"
              className="cx-chip cx-chip--sm"
              aria-pressed={format === entry.format}
              onClick={() => setFormat(entry.format)}
            >
              {entry.format} <b>{entry.count}</b>
            </button>
          ))}
        </div>
      ) : null}

      <div className="tbl-scroll">
        {visible.length === 0 ? (
          <p className="cx-none">No deliverables match this filter.</p>
        ) : view === "grouped" ? (
          <table className="tbl">
            <thead>
              <tr>
                <th>Creator</th>
                <th className="cx-hide-sm">Platform</th>
                <th>Deliverables</th>
                <th>Status</th>
                <th className="r cx-hide-sm">Progress</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, index) => {
                const openRow = isOpen(group.creatorName);
                return (
                  <GroupRows
                    key={group.creatorName}
                    group={group}
                    open={openRow}
                    index={index}
                    token={token}
                    creators={creators}
                    scriptPresence={scriptPresence}
                    onOpenScript={openScript}
                    onToggle={() => toggle(group.creatorName)}
                  />
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Creator</th>
                <th className="cx-hide-sm">Platform</th>
                <th>Deliverable</th>
                <th className="cx-hide-sm">Scheduled</th>
                <th>Status</th>
                <th className="cx-hide-sm">Published</th>
                <th className="r cx-hide-sm">Performance</th>
              </tr>
            </thead>
            <tbody>
              {rankedPublicationRows(visible).map((post, index) => (
                <tr key={post.id}>
                  <td>
                    <span className="cx-who">
                      <PublicationPlanAvatar
                        name={post.creatorName}
                        avatarUrl={post.avatarUrl}
                        index={index}
                        token={token}
                        creators={creators}
                      />
                      <span className="cx-who__n">{post.creatorName}</span>
                    </span>
                  </td>
                  <td className="cx-hide-sm">
                    <PlatformCell row={post} />
                  </td>
                  <td>
                    <div className="cx-pub-cell">
                      <DeliverableScriptCell
                        post={post}
                        scriptPresence={scriptPresence}
                        token={token}
                        onOpen={openScript}
                      />
                      <PublicationPlanMobileMetrics performance={post.performance} />
                    </div>
                  </td>
                  <td className="cx-hide-sm">{dash(formatClientScheduleDate(post.scheduledDate))}</td>
                  <td>
                    <StatusPill status={post.status} />
                  </td>
                  <td className="cx-hide-sm">{dash(formatClientScheduleDate(post.publicationDate) ?? (post.contentUrl ? "Published" : null))}</td>
                  <td className="r cx-hide-sm">
                    <PublicationPlanMetrics performance={post.performance} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="cx-foot">
        <span>
          {view === "grouped"
            ? `${groups.length} creator${groups.length === 1 ? "" : "s"} · ${visible.length} of ${posts.length} deliverables`
            : `${visible.length} of ${posts.length} deliverables`}
        </span>
        <span>{PUBLICATION_PLAN_FOOTNOTE}</span>
      </div>
      <DocumentationUnitScriptSheet
        open={Boolean(scriptSheet && scriptSheetUnit)}
        onOpenChange={(open) => {
          if (!open) setScriptSheet(null);
        }}
        surface="client"
        token={token}
        unit={scriptSheetUnit}
        intent={scriptSheet?.intent ?? "edit"}
        headerAvatar={
          scriptSheet ? (
            <PublicationPlanAvatar
              name={scriptSheet.post.creatorName}
              avatarUrl={scriptSheet.post.avatarUrl}
              index={0}
              token={token}
              creators={creators}
            />
          ) : null
        }
        onPresenceChange={(unitKey, presence) => {
          setScriptPresence((current) => {
            const next = new Map(current);
            if (!presence.hasScript) {
              next.delete(unitKey);
              return next;
            }
            next.set(unitKey, {
              scriptId: presence.scriptId ?? current.get(unitKey)?.scriptId ?? "",
              originalFileName: presence.originalFileName ?? null,
              originalMimeType: presence.originalMimeType ?? null,
              hasOriginalDocument: Boolean(presence.hasOriginalDocument),
            });
            return next;
          });
        }}
      />
    </section>
  );
}

function GroupRows({
  group,
  open,
  index,
  token,
  creators,
  scriptPresence,
  onOpenScript,
  onToggle,
}: {
  group: ReturnType<typeof groupPublicationPlanByCreator>[number];
  open: boolean;
  index: number;
  token: string;
  creators: ClientCreatorCard[];
  scriptPresence: ReadonlyMap<string, CampaignScriptUnitPresence>;
  onOpenScript: (post: ClientCampaignPostRow, intent: DocumentationUnitScriptIntent) => void;
  onToggle: () => void;
}) {
  const first = group.posts[0];
  const avatarUrl =
    group.posts.find((post) => post.avatarUrl?.trim())?.avatarUrl ?? first?.avatarUrl;
  return (
    <>
      <tr className="cx-grow" aria-expanded={open} onClick={onToggle}>
        <td>
          <span className="cx-who">
            <svg className="cx-caret" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6l6 6-6 6z" />
            </svg>
            <PublicationPlanAvatar
              name={group.creatorName}
              avatarUrl={avatarUrl}
              index={index}
              token={token}
              creators={creators}
            />
            <span className="cx-who__n">{group.creatorName}</span>
          </span>
        </td>
        <td className="cx-hide-sm">{first ? <PlatformCell row={first} /> : null}</td>
        <td>
          <div className="cx-pub-cell">
            <span className="cx-mix">
              {group.kinds.map((kind) => (
                <span className="cx-tag" key={kind.label}>
                  {kind.label} <b>{kind.count}</b>
                </span>
              ))}
            </span>
            <PublicationPlanMobileMetrics
              performance={clientCampaignDashboardPerformance(group.posts)}
            />
          </div>
        </td>
        <td>
          {group.statuses.map((status) => (
            <StatusPill key={status} status={status} />
          ))}
        </td>
        <td className="r cx-hide-sm">
          <span className="cx-mini">
            <span className="cx-mini__t">
              <span
                className="cx-mini__f"
                style={{
                  width: `${group.percent}%`,
                  background: group.percent ? "var(--ok, #10b981)" : "#dfe4ee",
                }}
              />
            </span>
            <span className="cx-mini__v">
              {group.doneCount}/{group.total}
            </span>
          </span>
        </td>
      </tr>
      {open
        ? group.folded.map((item) => {
            const post = item.sample;
            return (
              <tr className="cx-kid" key={item.key}>
                <td>
                  <div className="cx-pub-cell">
                    <DeliverableScriptCell
                      post={post}
                      count={item.count}
                      scriptPresence={scriptPresence}
                      token={token}
                      onOpen={onOpenScript}
                    />
                    <PublicationPlanMobileMetrics performance={post.performance} />
                  </div>
                </td>
                <td className="cx-hide-sm">
                  <PlatformCell row={post} />
                </td>
                <td>{dash(formatClientScheduleDate(post.scheduledDate))}</td>
                <td>
                  <StatusPill status={post.status} />
                </td>
                <td className="r cx-hide-sm">
                  <PublicationPlanMetrics performance={post.performance} />
                </td>
              </tr>
            );
          })
        : null}
    </>
  );
}
