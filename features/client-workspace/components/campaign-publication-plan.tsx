"use client";

import { useMemo, useState } from "react";

import { DATA_NOT_AVAILABLE, NOT_AVAILABLE, TO_BE_CONFIRMED } from "../format";
import {
  formatClientCampaignPerformance,
  formatClientScheduleDate,
  type ClientCampaignPostRow,
} from "../campaign-execution";
import {
  PUBLICATION_PLAN_FOOTNOTE,
  PUBLICATION_PLAN_NOTE,
} from "../campaign-dashboard";
import {
  CLIENT_CAMPAIGN_POST_STATUS_LABEL,
  defaultExpandedCreators,
  filterPublicationPlanPosts,
  groupPublicationPlanByCreator,
  publicationPlanFilterCounts,
  publicationPlanStatusTone,
  rankedPublicationRows,
  type PublicationPlanFilter,
  type PublicationPlanViewMode,
} from "../campaign-publication-plan";
import type { ClientCreatorCard } from "../types";
import { ReviewPlatformMark } from "./review-platform-mark";
import { ReviewAvatar } from "./review-avatar";

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

function matchPublicationCreator(
  name: string,
  creators: Array<
    Pick<ClientCreatorCard, "displayName" | "handle" | "avatarUrl" | "profileUrl" | "platform" | "platformAccounts">
  >
) {
  const key = name.trim().replace(/^@+/, "").toLowerCase();
  if (!key) return undefined;
  return creators.find((creator) => {
    const display = creator.displayName.trim().replace(/^@+/, "").toLowerCase();
    const handle = creator.handle?.trim().replace(/^@+/, "").toLowerCase();
    return display === key || handle === key;
  });
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
  const matched = matchPublicationCreator(name, creators);
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

export function CampaignPublicationPlan({
  posts,
  creators,
  token,
}: {
  posts: ClientCampaignPostRow[];
  creators: ClientCreatorCard[];
  token: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PublicationPlanFilter>("all");
  const [view, setView] = useState<PublicationPlanViewMode>("grouped");
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const counts = publicationPlanFilterCounts(posts);
  const visible = useMemo(
    () => filterPublicationPlanPosts(posts, filter, query),
    [posts, filter, query]
  );
  const groups = useMemo(() => groupPublicationPlanByCreator(visible), [visible]);
  const defaultOpen = useMemo(() => new Set(defaultExpandedCreators(groups)), [groups]);

  function isOpen(name: string) {
    if (closed.has(name)) return false;
    return opened.has(name) || defaultOpen.has(name);
  }

  function toggle(creatorName: string) {
    if (isOpen(creatorName)) {
      setOpened((current) => {
        const next = new Set(current);
        next.delete(creatorName);
        return next;
      });
      setClosed((current) => new Set(current).add(creatorName));
      return;
    }
    setClosed((current) => {
      const next = new Set(current);
      next.delete(creatorName);
      return next;
    });
    setOpened((current) => new Set(current).add(creatorName));
  }

  return (
    <section className="card" id="publication-plan">
      <p className="ck">Publication plan</p>
      <h2>Creators and go-live</h2>
      <p className="note">{PUBLICATION_PLAN_NOTE}</p>

      <div className="cx-bar">
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
          {(
            [
              ["all", "All"],
              ["live", "Live"],
              ["overdue", "Overdue"],
              ["scheduling", "To be confirmed"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="cx-chip"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label} <b>{counts[id]}</b>
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

      <div className="tbl-scroll">
        {visible.length === 0 ? (
          <p className="cx-none">No deliverables match this filter.</p>
        ) : view === "grouped" ? (
          <table className="tbl">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Platform</th>
                <th>Deliverables</th>
                <th>Status</th>
                <th className="r">Progress</th>
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
                <th>Platform</th>
                <th>Deliverable</th>
                <th>Scheduled</th>
                <th>Status</th>
                <th>Published</th>
                <th className="r">Performance</th>
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
                  <td>
                    <PlatformCell row={post} />
                  </td>
                  <td>{post.deliverable || TO_BE_CONFIRMED}</td>
                  <td>{dash(formatClientScheduleDate(post.scheduledDate))}</td>
                  <td>
                    <StatusPill status={post.status} />
                  </td>
                  <td>{dash(formatClientScheduleDate(post.publicationDate) ?? (post.contentUrl ? "Published" : null))}</td>
                  <td className="r">
                    {post.live || post.performance.views != null
                      ? formatClientCampaignPerformance(post.performance)
                      : dash(null)}
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
    </section>
  );
}

function GroupRows({
  group,
  open,
  index,
  token,
  creators,
  onToggle,
}: {
  group: ReturnType<typeof groupPublicationPlanByCreator>[number];
  open: boolean;
  index: number;
  token: string;
  creators: ClientCreatorCard[];
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
        <td>{first ? <PlatformCell row={first} /> : null}</td>
        <td>
          <span className="cx-mix">
            {group.kinds.map((kind) => (
              <span className="cx-tag" key={kind.label}>
                {kind.label} <b>{kind.count}</b>
              </span>
            ))}
          </span>
        </td>
        <td>
          {group.statuses.map((status) => (
            <StatusPill key={status} status={status} />
          ))}
        </td>
        <td className="r">
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
            const perf = formatClientCampaignPerformance(post.performance);
            return (
              <tr className="cx-kid" key={item.key}>
                <td>
                  {post.deliverable || TO_BE_CONFIRMED}
                  {item.count > 1 ? <span className="cx-xn">×{item.count}</span> : null}
                </td>
                <td>
                  <PlatformCell row={post} />
                </td>
                <td>{dash(formatClientScheduleDate(post.scheduledDate))}</td>
                <td>
                  <StatusPill status={post.status} />
                </td>
                <td className="r">
                  {perf !== DATA_NOT_AVAILABLE && perf !== NOT_AVAILABLE ? perf : dash(null)}
                </td>
              </tr>
            );
          })
        : null}
    </>
  );
}
