"use client";

import { useEffect, useState } from "react";
import { DocumentationUnitScriptSheet } from "@/features/campaigns/components/script/documentation-unit-script-sheet";
import { clientPostDocumentationScriptUnit, documentationUnitSummaryForClientPost } from "@/lib/campaign-script/documentation-unit-ui";
import { listClientCampaignScriptPresenceAction } from "../actions/campaign-script-actions";
import type { ClientCampaignPostRow } from "../campaign-execution";
import type { ClientContentReviewItem } from "../content-approval";
import { nextContentExpectation, projectContentReviewSchedule, REVIEW_SCHEDULE_LABELS, reviewScheduleToday, type ContentReviewScheduleRow } from "../content-review-schedule";

function dateLabel(value: string | null) {
  return value ? new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Cairo" }) : "To be confirmed";
}

export function ContentReviewSchedule({ posts, items, token, onOpenContent }: {
  posts: ClientCampaignPostRow[]; items: ClientContentReviewItem[]; token: string;
  onOpenContent: (item: ClientContentReviewItem) => void;
}) {
  const [scripts, setScripts] = useState<Set<string>>(new Set());
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [scriptPost, setScriptPost] = useState<ClientCampaignPostRow | null>(null);
  const [query, setQuery] = useState("");
  const [today, setToday] = useState(reviewScheduleToday);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(reviewScheduleToday()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let cancelled = false;
    setScriptsLoaded(false); setScriptError(false);
    void listClientCampaignScriptPresenceAction({ token }).then(result => {
      if (cancelled) return;
      if (result.ok) { setScripts(new Set(result.data.map(item => item.unitKey))); setScriptsLoaded(true); }
      else setScriptError(true);
    }).catch(() => { if (!cancelled) setScriptError(true); });
    return () => { cancelled = true; };
  }, [token, retry]);
  const all = projectContentReviewSchedule(posts, items, scripts, today);
  if (!all.length) return null;
  const next = nextContentExpectation(all, today);
  const filtered = all.filter(row => `${row.post.creatorName} ${row.post.deliverable} ${row.kind}`.toLowerCase().includes(query.trim().toLowerCase()));
  const active = filtered.filter(row => row.status !== "approved" && row.status !== "published");
  const completed = filtered.filter(row => row.status === "approved" || row.status === "published");
  const mapped = scriptPost ? clientPostDocumentationScriptUnit(scriptPost) : null;
  const scriptUnit = scriptPost && mapped ? documentationUnitSummaryForClientPost({ ...mapped, sequenceNumber: scriptPost.sequenceNumber,
    creatorName: scriptPost.creatorName, platform: scriptPost.platform, deliverableLabel: scriptPost.deliverable }) : null;
  function table(rows: ContentReviewScheduleRow[]) {
    return <div className="cx-review-schedule__scroll" tabIndex={0} role="region" aria-label="Content review dates"><table>
      <thead><tr><th scope="col">Creator / content</th><th scope="col">Expected for review</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>
        <td><strong>{row.post.creatorName}</strong><small>{row.kind === "script" ? "Script" : row.post.deliverable}{(row.post.quantity ?? 1) > 1 && row.post.sequenceNumber ? ` · #${row.post.sequenceNumber}` : ""}{row.kind === "draft" ? " · Content draft" : ""}</small></td>
        <td>{row.expectedDate ? <time dateTime={row.expectedDate}>{dateLabel(row.expectedDate)}</time> : <span className="cx-review-schedule__muted">To be confirmed</span>}</td>
        <td><span className={`cx-review-schedule__status cx-review-schedule__status--${row.status}`}>{row.kind === "script" && !scriptsLoaded ? scriptError ? "Status unavailable" : "Checking content…" : REVIEW_SCHEDULE_LABELS[row.status]}</span></td>
        <td>{row.content ? <button type="button" className="btn" onClick={() => onOpenContent(row.content!)}>Open content</button> : row.hasScript ? <button type="button" className="btn" onClick={() => setScriptPost(row.post)}>Open script</button> : <span className="cx-review-schedule__muted">{row.status === "published" ? "Published" : "Awaiting content"}</span>}</td>
      </tr>)}</tbody>
    </table></div>;
  }
  return <section className="card cx-review-schedule" aria-label="Content review schedule">
    <header><div><h2>Content review schedule</h2><p>{next.date ? <>Next content expected: <strong>{dateLabel(next.date)}</strong> · {next.count} {next.count === 1 ? "item" : "items"}</> : "No upcoming review dates confirmed."}</p></div>
      <input type="search" aria-label="Search content review schedule" placeholder="Find creator or content" value={query} onChange={event => setQuery(event.target.value)} />
    </header>
    {scriptError ? <p role="status" className="cx-review-schedule__note">Script availability could not be checked. <button type="button" className="btn" onClick={() => setRetry(value => value + 1)}>Retry</button></p> : null}
    {active.length ? table(active) : <p className="cx-review-schedule__note">{query ? "No pending content matches your search." : "All scheduled content has been completed."}</p>}
    {completed.length ? <details><summary>Approved / published · {completed.length}</summary>{table(completed)}</details> : null}
    <p className="cx-review-schedule__note">Expected dates are for client review, not publication. Dates without a confirmed schedule remain “To be confirmed.”</p>
    <DocumentationUnitScriptSheet open={Boolean(scriptUnit)} onOpenChange={open => { if (!open) setScriptPost(null); }} surface="client" token={token} unit={scriptUnit} intent="edit" onPresenceChange={(key, presence) => setScripts(current => {
      const next = new Set(current); if (presence.hasScript) next.add(key); else next.delete(key); return next;
    })} />
  </section>;
}
