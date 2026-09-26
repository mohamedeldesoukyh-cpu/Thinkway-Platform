"use client";
import { useEffect, useRef, useState } from "react";
import { DocumentationUnitScriptSheet } from "@/features/campaigns/components/script/documentation-unit-script-sheet";
import {
  clientPostDocumentationScriptUnit,
  documentationUnitSummaryForClientPost,
} from "@/lib/campaign-script/documentation-unit-ui";
import { listClientCampaignScriptPresenceAction } from "../actions/campaign-script-actions";
import type { ClientCampaignPostRow } from "../campaign-execution";
import type { ClientContentReviewItem } from "../content-approval";
import {
  scheduleAxis,
  scheduleDate,
  scheduleFinding,
  scheduleGroups,
  scheduleNeedsDecision,
  scheduleRows,
  SCHEDULE_STATES,
  type ScheduleRow,
  type ScheduleView,
} from "../review-schedule-model";
import "../styles/review-schedule.css";
import { ReviewScheduleGrids } from "./review-schedule-grids";
export function ContentReviewSchedule({
  posts,
  items,
  token,
  campaignName,
  startDate,
  endDate,
  onOpenContent,
}: {
  posts: ClientCampaignPostRow[];
  items: ClientContentReviewItem[];
  token: string;
  campaignName: string;
  startDate?: string | null;
  endDate?: string | null;
  onOpenContent: (item: ClientContentReviewItem) => void;
}) {
  const [scripts, setScripts] = useState<Set<string>>(new Set()),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  const [scriptPost, setScriptPost] = useState<ClientCampaignPostRow | null>(
      null,
    ),
    [view, setView] = useState<ScheduleView | null>(null);
  const [menu, setMenu] = useState(false),
    [downloadError, setDownloadError] = useState(""),
    [downloading, setDownloading] = useState(false);
  const [scriptTargetId, setScriptTargetId] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    void listClientCampaignScriptPresenceAction({ token })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setScripts(new Set(result.data.map((i) => i.unitKey)));
          setLoaded(true);
        } else setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, retry]);
  useEffect(() => {
    function outside(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(false);
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const rows = scheduleRows(posts, items, scripts),
    axis = scheduleAxis({
      rows,
      start_date: startDate ?? null,
      end_date: endDate ?? null,
    });
  const currentView = view ?? axis.defaultView,
    groups = scheduleGroups(rows);
  const mapped = scriptPost
    ? clientPostDocumentationScriptUnit(scriptPost)
    : null;
  const scriptUnit =
    scriptPost && mapped
      ? documentationUnitSummaryForClientPost({
          ...mapped,
          sequenceNumber: scriptPost.sequenceNumber,
          creatorName: scriptPost.creatorName,
          platform: scriptPost.platform,
          deliverableLabel: scriptPost.deliverable,
        })
      : null;
  function open(row: ScheduleRow) {
    if (row.content) onOpenContent(row.content);
    else if (row.has_script) setScriptPost(row.post);
  }
  async function download(format: "pdf" | "xlsx" | "html") {
    setMenu(false);
    setDownloading(true);
    setDownloadError("");
    try {
      const response = await fetch(
        `/api/campaigns/current/review-schedule.${format}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      );
      if (!response.ok)
        throw new Error("Schedule download failed. Please try again.");
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ??
        `${campaignName}-review-schedule.${format}`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setDownloadError(
        e instanceof Error ? e.message : "Download unavailable.",
      );
    } finally {
      setDownloading(false);
    }
  }
  function square(row: ScheduleRow) {
    const title = `${row.creator_name} · ${row.content_type} · ${row.ref} · ${row.content ? "Delivered · " : ""}${SCHEDULE_STATES[row.status].label} · Expected ${scheduleDate(row.expected_review_date)}${row.has_script ? " · Script on file" : ""}`;
    const className = `u ${SCHEDULE_STATES[row.status].css}${row.has_script ? " has-s" : ""}`;
    return row.content || row.has_script ? (
      <button
        key={row.id}
        type="button"
        className={className}
        title={title}
        aria-label={title}
        onClick={() => open(row)}
      />
    ) : (
      <span
        key={row.id}
        className={className}
        title={title}
        aria-label={title}
      />
    );
  }
  function list(title: string, listRows: ScheduleRow[], quiet = false) {
    return (
      <>
        <div className="wq__h">
          {title}
          <em>{listRows.length}</em>
          <span className="sp" />
          <span className="wq__n">
            {quiet
              ? "available to read · no approval required"
              : "ready regardless of schedule"}
          </span>
        </div>
        <div className="wq__l">
          {listRows.length ? (
            listRows.map((row) => (
              <button
                type="button"
                className={`wq${quiet ? " wq--q" : ""}`}
                key={row.id}
                onClick={() => quiet ? setScriptPost(row.post) : open(row)}
              >
                <span
                  className={`av a${(groups.findIndex((group) => group.name === row.handle) % 3) + 1}`}
                >
                  {row.creator_name.replace(/^@/, "").slice(0, 2).toUpperCase()}
                </span>
                <span className="wq__t">
                  <b>{row.creator_name}</b>
                  <u>
                    {row.content_type} · {row.ref}
                  </u>
                </span>
                <span className="wq__d">
                  {quiet ? (
                    <>Reference for this deliverable</>
                  ) : row.content && !row.expected_review_date ? (
                    <>Delivered <b>{scheduleDate(row.content.uploadedAt.slice(0, 10))}</b></>
                  ) : (
                    <>Expected <b>{scheduleDate(row.expected_review_date)}</b></>
                  )}
                </span>
                <span
                  className={`tag ${quiet ? "t-scr" : SCHEDULE_STATES[row.status].css}`}
                >
                  {quiet ? "Reference script" : row.status === "ready_for_approval" && row.content ? "Delivered · awaiting approval" : SCHEDULE_STATES[row.status].label}
                </span>
                <span className="wq__go">{quiet ? "Open script" : row.action_label} →</span>
              </button>
            ))
          ) : (
            <p className="fine">
              {quiet
                ? "No additional scripts to read."
                : "No decisions needed right now."}
            </p>
          )}
        </div>
      </>
    );
  }
  if (!rows.length && loaded) return null;
  return (
    <section className="card rvs" aria-label="Content review schedule">
      <div className="rvs__h">
        <div>
          <p className="ck">Campaign progress</p>
          <h2>Content review schedule</h2>
          <p className="sub">
            When each deliverable is expected with you for review.
          </p>
        </div>
        <span className="sp" />
        <div className="tools">
          <div className="zoom" aria-label="Schedule period">
            {(
              [
                ["d", "Days"],
                ["w", "Weeks"],
                ["m", "Months"],
                ["q", "Quarters"],
              ] as const
            ).map(([v, label]) => (
              <button
                type="button"
                data-v={v}
                key={v}
                aria-pressed={currentView === v}
                onClick={() => setView(v)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="dl" ref={menuRef}>
            <button
              type="button"
              className="dl__b"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
              disabled={!loaded || downloading}
            >
              {downloading ? "Preparing download…" : "Download schedule"}{" "}
              <em>▾</em>
            </button>
            <div className="dl__m" hidden={!menu}>
              {(
                [
                  ["pdf", "PDF", "Print-ready, all deliverables by creator"],
                  ["xlsx", "Excel", "Filterable, with a formula summary"],
                  ["html", "HTML", "Self-contained, opens in a browser"],
                ] as const
              ).map(([f, label, detail]) => (
                <button
                  type="button"
                  className="dl__i"
                  data-f={f}
                  key={f}
                  onClick={() => void download(f)}
                >
                  <b>{label}</b>
                  <u>{detail}</u>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {!loaded ? (
        <p className="error" role="status">
          {error ? (
            <>
              Script availability could not be checked.{" "}
              <button
                type="button"
                onClick={() => {
                  setError(false);
                  setRetry((r) => r + 1);
                }}
              >
                Retry
              </button>
            </>
          ) : (
            "Loading review schedule…"
          )}
        </p>
      ) : (
        <>
          <p className="rvs__m">
            {rows.length} deliverables · {groups.length} creators ·{" "}
            <b>
              {startDate && endDate
                ? `${scheduleDate(startDate)} → ${scheduleDate(endDate)}`
                : `Review calendar: ${scheduleDate(axis.start)} → ${scheduleDate(axis.end)}`}
            </b>{" "}
            · {axis.months} {axis.months === 1 ? "month" : "months"}
          </p>

          <ReviewScheduleGrids
            rows={rows}
            axis={axis}
            currentView={currentView}
            square={square}
          />
          <div className="flag">
            {scheduleFinding(rows)}
            <span className="flag__z">
              Switch to Days for exact dates, Weeks for detail or Quarters for longer campaigns.
            </span>
          </div>
          {list("Needs your decision", rows.filter(scheduleNeedsDecision))}
          <div className="script-upload">
            <label>
              Script for creator / deliverable
              <select value={scriptTargetId} onChange={event => setScriptTargetId(event.target.value)}>
                <option value="">Choose a creator and deliverable</option>
                {rows.map(row => <option key={row.id} value={row.id}>{row.creator_name} · {row.content_type} · {row.ref}{row.has_script ? " · Script on file" : ""}</option>)}
              </select>
            </label>
            <button type="button" className="dl__b" disabled={!rows.some(row => row.id === scriptTargetId)} onClick={() => {
              const target = rows.find(row => row.id === scriptTargetId);
              if (target) setScriptPost(target.post);
            }}>Add / upload script</button>
            <p>Save the script to share it with the assigned creator and Thinkway. No client approval is required for reference scripts.</p>
          </div>
          {list("Script references", rows.filter(row => row.has_script), true)}
          <div className="key">
            {Object.entries(SCHEDULE_STATES).map(([status, info]) => (
              <span key={status}>
                <i className={`u ${info.css}`} />
                {info.label}
              </span>
            ))}
            <span>
              <i className="u u-tb has-s" />
              Script on file
            </span>
          </div>
          <p className="fine">
            Expected dates are for client review, not publication. A blue corner
            indicates a readable script; it does not mean a decision is needed.
            {" "}Not scheduled means no expected review date was set; delivered content can still appear there.
          </p>
        </>
      )}
      {downloadError ? (
        <p className="error" role="alert">
          {downloadError}
        </p>
      ) : null}
      <DocumentationUnitScriptSheet
        open={Boolean(scriptUnit)}
        onOpenChange={(open) => {
          if (!open) setScriptPost(null);
        }}
        surface="client"
        token={token}
        unit={scriptUnit}
        intent="edit"
        onPresenceChange={(key, presence) =>
          setScripts((current) => {
            const next = new Set(current);
            if (presence.hasScript) next.add(key);
            else next.delete(key);
            return next;
          })
        }
      />
    </section>
  );
}
