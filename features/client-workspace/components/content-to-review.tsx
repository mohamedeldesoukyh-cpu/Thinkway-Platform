"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import "../styles/content-review.css";


import {
  APPROVED_CONTENT_HEADING,
  CLIENT_CONTENT_STATUS_LABEL,
  DOWNLOAD_ORIGINAL_LABEL,
  NO_CONTENT_TO_REVIEW_COPY,
  NO_CONTENT_TO_REVIEW_HINT,
  NOTHING_WAITING_ON_YOU_COPY,
  REQUEST_CONTENT_CHANGES_LABEL,
  VIEW_EXTERNAL_LINK_LABEL,
  clientContentAssetUrl,
  clientContentToReview,
  type ClientContentReviewItem,
} from "../content-approval";
import { decideContentAction } from "../actions/client-workspace-actions";
import {
  addClientUnitScriptMessageAction,
  deleteClientUnitScriptMessageAction,
  listClientUnitScriptConversationAction,
  loadClientCampaignScriptForUnitAction,
  updateClientUnitScriptMessageAction,
} from "../actions/campaign-script-actions";
import { groupClientContentByCreator, matchClientCreatorByName } from "../campaign-tab-aggregates";
import { googleDriveFilePreviewUrl } from "@/lib/services/deliverables/documentation-types";
import type { ClientCreatorCard } from "../types";
import { ClientContentFullSizeButton, ClientVideoPreview } from "./client-content-media";
import { ReviewAvatar } from "./review-avatar";
import type { CampaignScriptMasterView } from "@/lib/campaign-script";

type ScriptConversationMessage = {
  id: string;
  body: string;
  authorDisplayName: string | null;
  createdAt: string;
  editedAt?: string | null;
  clientSeenAt?: string | null;
  internalSeenAt?: string | null;
  canEdit?: boolean;
};

function reviewItemKey(item: ClientContentReviewItem) {
  return `${item.assetId}:${item.versionId}`;
}

function submittedLabel(uploadedAt: string | null | undefined) {
  if (!uploadedAt) return "—";
  return new Date(uploadedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ContentPreview({ item, token }: { item: ClientContentReviewItem; token: string }) {
  if (item.previewKind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="camp-content-preview"
        src={clientContentAssetUrl({ token, versionId: item.versionId, mode: "preview" })}
        alt={item.fileName || item.deliverable}
      />
    );
  }
  if (item.previewKind === "video") {
    return (
      <ClientVideoPreview
        token={token}
        versionId={item.versionId}
        title={item.fileName || item.deliverable}
      />
    );
  }
  const drivePreview = googleDriveFilePreviewUrl(item.externalUrl);
  if (drivePreview) {
    return (
      <iframe
        className="camp-content-preview"
        title={item.fileName || item.deliverable}
        src={drivePreview}
        allow="autoplay"
      />
    );
  }
  return null;
}

/** Only load approved media near the viewport, keeping long archives light. */
function ApprovedContentPreview({ item, token }: { item: ClientContentReviewItem; token: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "120px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={container} className="cx-approved-card__preview cx-rev__media">
    {visible ? <ContentPreview item={item} token={token} /> : <span className="cx-rev__ph">Preview</span>}
  </div>;
}

function CreatorAvatar({
  name,
  index,
  token,
  creators,
  className,
}: {
  name: string;
  index: number;
  token: string;
  creators: ClientCreatorCard[];
  className: string;
}) {
  const matched = matchClientCreatorByName(name, creators);
  return (
    <ReviewAvatar
      className={className}
      url={matched?.avatarUrl}
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

function ContentReviewPane({
  item,
  siblings,
  token,
  onDecided,
  onNavigate,
  position,
  total,
}: {
  item: ClientContentReviewItem;
  siblings: ClientContentReviewItem[];
  token: string;
  onNavigate: (offset: number) => void;
  position: number;
  total: number;
  onDecided: (ids: string[], decision: "approved" | "changes_requested", comment: string | null, decidedAt?: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conversationOpen] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(true);
  const [script, setScript] = useState<CampaignScriptMasterView | null>(null);
  const [messages, setMessages] = useState<ScriptConversationMessage[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [scriptExpanded, setScriptExpanded] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageBody, setEditingMessageBody] = useState("");
  const [showEarlier, setShowEarlier] = useState(false);
  const latestMessageIdRef = useRef<string | null>(null);
  const prior = item.history.filter((version) => version.versionId !== item.versionId);
  const bulkCount = siblings.length;

  function decideOne(versionId: string, decision: "approved" | "changes_requested") {
    return decideContentAction({
      token,
      versionId,
      decision,
      comment: comment.trim() || null,
    });
  }

  function decide(decision: "approved" | "changes_requested") {
    setError(null);
    startTransition(async () => {
      try {
      const result = await decideOne(item.versionId, decision);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setComment("");
      onDecided([item.versionId], decision, comment.trim() || null, result.decidedAt);
      } catch { setError("Could not save the decision. Please try again."); }
    });
  }

  function approveAllFromCreator() {
    setError(null);
    startTransition(async () => {
      try {
      const ids = siblings.map(sibling => sibling.versionId);
      const result = await decideContentAction({ token, versionIds: ids, decision: "approved", comment: comment.trim() || null });
      if (!result.ok) { setError(result.message); return; }
      setComment("");
      onDecided(ids, "approved", comment.trim() || null, result.decidedAt);
      } catch { setError("Could not save the decision. Please try again."); }
    });
  }

  const loadConversation = useCallback(async (showNewMessageToast: boolean) => {
    const unit = {
      token,
      assignmentDeliverableId: item.assignmentDeliverableId,
      assignmentPostScheduleId: item.assignmentPostScheduleId,
    };
    const scriptResult = await loadClientCampaignScriptForUnitAction(unit);
    const messagesResult = await listClientUnitScriptConversationAction(unit);
    if (!scriptResult.ok) throw new Error(scriptResult.message);
    if (!messagesResult.ok) throw new Error(messagesResult.message);
    const latestMessageId = messagesResult.data.at(-1)?.id ?? null;
    if (
      showNewMessageToast &&
      latestMessageIdRef.current &&
      latestMessageId &&
      latestMessageId !== latestMessageIdRef.current
    ) {
      toast("New script comment", {
        description: "The conversation was updated.",
      });
    }
    latestMessageIdRef.current = latestMessageId;
    setScript(scriptResult.data);
    setMessages(messagesResult.data);
  }, [item.assignmentDeliverableId, item.assignmentPostScheduleId, token]);

  useEffect(() => {
    void Promise.resolve().then(() => loadConversation(false))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load the conversation."))
      .finally(() => setConversationLoading(false));
  }, [loadConversation]);

  function sendConversationMessage() {
    const body = messageBody.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const result = await addClientUnitScriptMessageAction({
        token,
        assignmentDeliverableId: item.assignmentDeliverableId,
        assignmentPostScheduleId: item.assignmentPostScheduleId,
        body,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setMessageBody("");
      await loadConversation(false);
      toast.success("Comment sent to Thinkway and the creator.");
    });
  }

  function editConversationMessage(messageId: string) {
    const body = editingMessageBody.trim();
    if (!body) return;
    startTransition(async () => {
      const result = await updateClientUnitScriptMessageAction({ token, assignmentDeliverableId: item.assignmentDeliverableId, assignmentPostScheduleId: item.assignmentPostScheduleId, commentId: messageId, body });
      if (!result.ok) { toast.error(result.message); return; }
      setEditingMessageId(null);
      await loadConversation(false);
      toast.success("Message updated.");
    });
  }

  function deleteConversationMessage(messageId: string) {
    startTransition(async () => {
      const result = await deleteClientUnitScriptMessageAction({ token, assignmentDeliverableId: item.assignmentDeliverableId, assignmentPostScheduleId: item.assignmentPostScheduleId, commentId: messageId });
      if (!result.ok) { toast.error(result.message); return; }
      await loadConversation(false);
      toast.success("Message deleted.");
    });
  }

  useEffect(() => {
    if (!conversationOpen) return;
    const timer = window.setInterval(() => {
      void loadConversation(true).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [conversationOpen, loadConversation]);

  return (
    <>
      <section className="cx-review__stage" aria-label="Content preview">

        <div className="cx-rev__media">
          <span className="cx-stage-badge">{CLIENT_CONTENT_STATUS_LABEL[item.status]}</span>
          {item.previewKind !== "none" || googleDriveFilePreviewUrl(item.externalUrl) ? (
            <ContentPreview item={item} token={token} />
          ) : (
            <div className="cx-rev__ph">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="#5b6478" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>
                {item.assetTypeLabel} · v{item.versionNumber}
              </span>
            </div>
          )}
        </div>
        <p className="cx-review__stage-file">{item.fileName || item.deliverable}</p>
        <nav className="cx-stage-nav" aria-label="Review navigation"><button type="button" className="btn" onClick={() => onNavigate(-1)} disabled={pending || total < 2} aria-label="Previous submission">‹</button><span>{position + 1} of {total}</span><button type="button" className="btn" onClick={() => onNavigate(1)} disabled={pending || total < 2} aria-label="Next submission">›</button></nav>
        <div className="cx-review__stage-actions">{item.externalUrl ? <a className="btn" href={item.externalUrl} target="_blank" rel="noopener noreferrer">{VIEW_EXTERNAL_LINK_LABEL}</a> : null}
          {item.canDownloadOriginal ? <a className="btn" href={clientContentAssetUrl({ token, versionId: item.versionId, mode: "download" })}>{DOWNLOAD_ORIGINAL_LABEL}</a> : null}
          {item.previewKind !== "none" && item.canDownloadOriginal ? <ClientContentFullSizeButton token={token} versionId={item.versionId} kind={item.previewKind} title={item.fileName || item.deliverable} /> : null}
        </div>
      </section>
      <div className="cx-pane cx-review__detail">
      <p className="cx-detail-block">The submission</p>
      <div className="cx-rev">
        <div>
          <div className="cx-rev__meta"><div><span>Creator</span><b>{item.creatorName}</b></div>
            <div>
              <span>Platform</span>
              <b>{item.platformLabel || item.platform || "—"}</b>
            </div>
            <div>
              <span>Deliverable</span>
              <b>{item.assetTypeLabel}</b>
            </div>
            <div>
              <span>Version</span>
              <b>v{item.versionNumber}</b>
            </div>
            <div>
              <span>Submitted</span>
              <b>{submittedLabel(item.uploadedAt)}</b>
            </div>
          </div>

          {item.comment ? <section className="cx-caption" aria-label="Caption and on-screen text"><p className="cx-detail-block">Caption &amp; on-screen text</p><p className="camp-content-comment">{item.comment}</p></section> : null}

          <section className="cx-conversation" aria-label="Script and conversation">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Conversation <small>{messages.length} messages</small></h3>
                <p className="text-xs text-muted-foreground">Shared with Thinkway and the creator.</p>
              </div>
              {messages.length > 4 ? <button type="button" className="btn btn-sm" onClick={() => setShowEarlier(value => !value)}>{showEarlier ? "Show recent" : "Show earlier"}</button> : null}

            </div>
            {conversationOpen ? (
              <div className="mt-3 space-y-3">
                {conversationLoading ? <p className="text-sm text-muted-foreground">Loading script conversation…</p> : null}
                {!conversationLoading && script ? (
                  <div className="cx-script-block">
                    <div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Script</p><button type="button" className="btn btn-sm" onClick={() => setScriptExpanded((open) => !open)}>{scriptExpanded ? "Collapse script" : "Show script"}</button></div>
                    {scriptExpanded ? <div className="max-h-52 overflow-auto whitespace-pre-wrap" dir={script.sourceLanguage === "ar" ? "rtl" : "ltr"}>{script.sourceLanguage === "ar" ? script.bodyAr : script.bodyEn}</div> : null}
                  </div>
                ) : null}
                {!conversationLoading && !script ? (
                  <p className="text-sm text-muted-foreground">No script has been shared for this deliverable yet.</p>
                ) : null}
                {messages.length ? (
                  <div className="space-y-2">
                    {(showEarlier ? messages : messages.slice(-4)).map((message) => (
                      <div key={message.id} data-initials={(message.authorDisplayName || "Creator").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()} className={`cx-thread-message${message.canEdit ? " cx-thread-message--client" : ""}`}>
                        <div className="mb-1 flex justify-between gap-2 text-xs text-muted-foreground">
                          <span>{message.authorDisplayName || "Creator"}{message.editedAt ? " · Edited" : ""}</span>
                          <time>{new Date(message.createdAt).toLocaleString()} {(message.canEdit ? message.internalSeenAt : message.clientSeenAt) ? "· Seen" : "· Sent"}</time>
                        </div>
                        {editingMessageId === message.id ? <div className="space-y-2"><textarea className="cx-rev__notes" rows={2} value={editingMessageBody} onChange={(event) => setEditingMessageBody(event.target.value)} disabled={pending} /><div className="flex gap-2"><button type="button" className="btn pri btn-sm" onClick={() => editConversationMessage(message.id)} disabled={pending || !editingMessageBody.trim()}>Save</button><button type="button" className="btn btn-sm" onClick={() => setEditingMessageId(null)}>Cancel</button></div></div> : <p className="whitespace-pre-wrap">{message.body}</p>}
                        {message.canEdit ? <div className="mt-2 flex gap-2"><button type="button" className="btn btn-sm" onClick={() => { setEditingMessageId(message.id); setEditingMessageBody(message.body); }} disabled={pending}>Edit</button><button type="button" className="btn btn-sm" onClick={() => deleteConversationMessage(message.id)} disabled={pending}>Delete</button></div> : null}
                      </div>
                    ))}
                  </div>
                ) : !conversationLoading ? (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                ) : null}
                <div className="flex gap-2">
                  <textarea
                    className="cx-rev__notes flex-1"
                    rows={2}
                    value={messageBody}
                    onChange={(event) => setMessageBody(event.target.value)}
                    placeholder="Reply about this script or video…"
                    disabled={pending || conversationLoading}
                  />
                  <button
                    type="button"
                    className="btn pri self-end"
                    onClick={sendConversationMessage}
                    disabled={pending || conversationLoading || !messageBody.trim()}
                  >
                    Send reply
                  </button>
                </div>
              </div>
            ) : null}
          </section>

<div className="cx-compose"><label>Add a note <span>optional — included with your decision</span></label>          <textarea
            className="cx-rev__notes"
            rows={3}
            placeholder="Notes for Thinkway (optional) — tell us what to change and we'll pass it to the creator."
            value={comment}
            disabled={pending}
            onChange={(event) => setComment(event.target.value)}
          />
          {error ? <p className="note" role="alert">{error}</p> : null}
</div>    {prior.length > 0 ? (
            <div className="camp-content-history">
              <p className="ck">Previous versions</p>
              <ul>
                {prior.map((version) => (
                  <li key={version.versionId}>
                    v{version.versionNumber}
                    {version.status === "uploaded"
                      ? " · Uploaded"
                      : ` · ${CLIENT_CONTENT_STATUS_LABEL[version.status]}`}
                    {version.comment ? ` · ${version.comment}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
      </div>
          <section className="cx-decision" aria-label="Your decision">
          <div className="cx-decision__heading"><strong>Your decision</strong><span>Approve to release for publishing, or request changes with a note to Thinkway.</span></div>
          <div className="cx-rev__acts"><button type="button" className="btn" onClick={() => onNavigate(1)} disabled={pending || total < 2}>Skip for now</button>
            <button type="button" className="btn pri" disabled={pending} onClick={() => decide("approved")}>
              {pending ? "Saving…" : "✓ Approve & next"}
            </button>
            <button
              type="button"
              className="btn"
              disabled={pending}
              onClick={() => decide("changes_requested")}
            >
              {REQUEST_CONTENT_CHANGES_LABEL}
            </button>
          </div>

          {bulkCount > 1 ? (
            <div className="cx-rev__acts">
              <button
                type="button"
                className="cx-bulk"
                disabled={pending}
                onClick={approveAllFromCreator}
              >
                Approve all {bulkCount} from {item.creatorName}
              </button>
            </div>
          ) : null}
          </section>


    </>
  );
}

export function ContentToReview({
  items,
  token,
  note,
  creators = [],
  onDecisionSaved,
}: {
  items: ClientContentReviewItem[];
  token: string;
  note?: string;
  creators?: ClientCreatorCard[];
  onDecisionSaved: (ids: string[], status: "approved" | "changes_requested", comment: string | null, decidedAt?: string) => void;
}) {
  const pending = clientContentToReview(items);
  const approved = items.filter((item) => item.status === "approved");
  const groups = groupClientContentByCreator(pending);
  const [queueCreator, setQueueCreator] = useState("");
  const [approvedCreator, setApprovedCreator] = useState("");
  const [approvedType, setApprovedType] = useState("All");
  const [galleryView, setGalleryView] = useState("Grid");
  const [downloading, setDownloading] = useState(false);
  const approvedCreators = [...new Set(approved.map(item => item.creatorName))];
  const filteredApproved = approved.filter(item => (!approvedCreator || item.creatorName === approvedCreator) && (approvedType === "All" || item.assetTypeLabel.toLowerCase().includes(approvedType.toLowerCase())));
  const dateGroups = [...new Set(filteredApproved.map(item => item.approvedAt ? new Date(item.approvedAt).toLocaleDateString("en-CA", {timeZone: "Africa/Cairo"}) : "undated"))].sort((a, b) => a === "undated" ? 1 : b === "undated" ? -1 : b.localeCompare(a));
  async function downloadItems(entries: ClientContentReviewItem[]) {
    setDownloading(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const downloadable = entries.filter(item => item.canDownloadOriginal);
      for (const [index, item] of downloadable.entries()) {
        const response = await fetch(clientContentAssetUrl({ token, versionId: item.versionId, mode: "download" }));
        if (!response.ok) throw new Error("Could not download " + (item.fileName || item.deliverable));
        zip.file(String(index + 1).padStart(2, "0") + "-" + (item.fileName || item.deliverable).replace(/[\\/]/g, "-"), await response.blob());
      }
      if (!downloadable.length) throw new Error("These items have external links only. Open each link to download.");
      const url = URL.createObjectURL(await zip.generateAsync({type: "blob"}));
      const anchor = document.createElement("a"); anchor.href=url; anchor.download="approved-content.zip"; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch(error) { toast.error(error instanceof Error ? error.message : "Download failed."); }
    finally { setDownloading(false); }
  }
  const [selectedKey, setSelectedKey] = useState(() =>
    pending[0] ? reviewItemKey(pending[0]) : ""
  );
  const selected = pending.find((item) => reviewItemKey(item) === selectedKey) ?? pending[0] ?? null;
  const siblings = selected
    ? pending.filter((item) => item.creatorName.trim() === selected.creatorName.trim())
    : [];

  return (
    <div className="card cx-content-review" id="review">
      <p className="ck cx-content-review__eyebrow">Content to review</p>
      <section className="cx-review-panel">
        <header className="cx-content-review__head">
          <div>
            <h2>Creator content</h2>
            <p>{note || "Approve to release for publishing, or request changes with a note back to Thinkway."}</p>
          </div>
          {pending.length ? <span className="cx-content-review__count">{pending.length} waiting · {groups.length} creators</span> : null}
        </header>

      {pending.length > 0 && selected ? (
        <div className="cx-review">
          <aside className="cx-rail">
            <div className="cx-rail__hd">
              <span className="cx-rail__t">Pending approval</span>
              <span className="cx-rail__n num">{pending.length}</span>
            </div>
            <div className="cx-filter-row cx-queue-filters"><button className="cx-filter" aria-pressed={!queueCreator} onClick={() => setQueueCreator("")}>All {pending.length}</button>{groups.map(group => <button key={group.creatorName} className="cx-filter" aria-pressed={queueCreator === group.creatorName} onClick={() => { setQueueCreator(group.creatorName); setSelectedKey(reviewItemKey(group.items[0])); }} title={group.creatorName}><span className="cx-filter-avatar" aria-hidden="true">{group.creatorName.replace(/^@/, "").slice(0,2).toUpperCase()}</span>{group.items.length}</button>)}</div>
            {groups.filter(group => !queueCreator || group.creatorName === queueCreator).map((group, index) => (
              <div className="cx-rgroup" key={group.creatorName}>
                <div className="cx-rgroup__hd">
                  <CreatorAvatar
                    name={group.creatorName}
                    index={index}
                    token={token}
                    creators={creators}
                    className="cx-av"
                  />
                  <span className="cx-rgroup__nm">{group.creatorName}</span>
                  <span className="cx-rgroup__c num">{group.items.length}</span>
                </div>
                {group.items.map((item) => {
                  const key = reviewItemKey(item);
                  const current = selected ? reviewItemKey(selected) === key : false;
                  return (
                    <button
                      key={key}
                      type="button"
                      className="cx-ritem"
                      aria-current={current}
                      onClick={() => setSelectedKey(key)}
                    >
                      <span className="cx-ritem__thumb" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></span>
                      <span className="cx-ritem__copy">
                        <span className="cx-ritem__f">{item.fileName || item.deliverable}</span>
                        <span className="cx-ritem__m">
                          {item.assetTypeLabel} · v{item.versionNumber} · {submittedLabel(item.uploadedAt)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>
          <ContentReviewPane
            key={reviewItemKey(selected)}
            item={selected}
            siblings={siblings}
            token={token}
            onDecided={onDecisionSaved}
            onNavigate={(offset) => setSelectedKey(reviewItemKey(pending[(pending.indexOf(selected) + offset + pending.length) % pending.length]))}
            position={pending.indexOf(selected)}
            total={pending.length}
          />
        </div>
      ) : approved.length > 0 ? (
        <div className="cx-done">{NOTHING_WAITING_ON_YOU_COPY}</div>
      ) : (
        <>
          <p className="note">{NO_CONTENT_TO_REVIEW_COPY}</p>
          <p className="note">{NO_CONTENT_TO_REVIEW_HINT}</p>
        </>
      )}
      </section>

      {approved.length > 0 ? (
        <section className="cx-approved cx-approved-panel" aria-live="polite">
          <header className="cx-content-review__head">
            <div>
              <h2>{APPROVED_CONTENT_HEADING}</h2>
              <p>{approved.length} items you have signed off. Published pieces are marked.</p>
            </div><div className="cx-gallery-tools"><div className="cx-gallery-segment">{["Grid", "List"].map(view => <button key={view} aria-pressed={galleryView === view} onClick={() => setGalleryView(view)}>{view}</button>)}</div><button className="btn" disabled={downloading} onClick={() => void downloadItems(filteredApproved)}>{downloading ? "Downloading…" : "Download all"}</button></div>
          </header>
          <div className="cx-filter-row"><span>Creator</span><button className="cx-filter" aria-pressed={!approvedCreator} onClick={() => setApprovedCreator("")}>All {approved.length}</button>{approvedCreators.map(name => <button key={name} className="cx-filter" aria-pressed={approvedCreator === name} onClick={() => setApprovedCreator(name)}><span className="cx-filter-avatar" aria-hidden="true">{name.replace(/^@/, "").slice(0, 2).toUpperCase()}</span>{name} <small>{approved.filter(item => item.creatorName === name).length}</small></button>)}<span className="cx-filter-spacer"/><span>Type</span>{["All", "Draft", "Final"].map(type => <button key={type} className="cx-filter" aria-pressed={approvedType === type} onClick={() => setApprovedType(type)}>{type}</button>)}</div>
          {!filteredApproved.length ? <p className="cx-done">No approved content matches these filters.</p> : null}
          {dateGroups.map(date => <div className="cx-approved-group" key={date}><header><strong>{date === "undated" ? "Published · date not recorded" : new Date(date + "T12:00:00").toLocaleDateString("en-GB", {day:"numeric", month:"long", year:"numeric"})}</strong><span>{filteredApproved.filter(item => (item.approvedAt ? new Date(item.approvedAt).toLocaleDateString("en-CA", {timeZone:"Africa/Cairo"}) : "undated") === date).length} items</span><button className="btn" disabled={downloading} onClick={() => void downloadItems(filteredApproved.filter(item => (item.approvedAt ? new Date(item.approvedAt).toLocaleDateString("en-CA", {timeZone:"Africa/Cairo"}) : "undated") === date))}>Download {filteredApproved.filter(item => (item.approvedAt ? new Date(item.approvedAt).toLocaleDateString("en-CA", {timeZone:"Africa/Cairo"}) : "undated") === date).length}</button></header>
          <div className={"cx-approved__list" + (galleryView === "List" ? " cx-approved__list--rows" : "")}>
            {filteredApproved.filter(item => (item.approvedAt ? new Date(item.approvedAt).toLocaleDateString("en-CA", {timeZone:"Africa/Cairo"}) : "undated") === date).map((item, index) => (
              <article key={reviewItemKey(item)} className="cx-approved-card">
                <div className="cx-approved-card__body">
                  <div className="cx-approved-identity">
                    <CreatorAvatar name={item.creatorName} index={index} token={token} creators={creators} className="cx-av" />
                    <div><b title={item.creatorName}>{item.creatorName}</b><small>{item.assetTypeLabel} · v{item.versionNumber}</small></div>
                    <span className="cx-badge cx-badge--ok">✓ Approved</span>
                  </div>
                  <p className="cx-approved-filename" title={item.fileName || item.deliverable}>{item.fileName || item.deliverable}</p>
                  <div className="cx-approved-dateline"><span>{item.platformLabel || item.platform}</span><time dateTime={item.approvedAt || undefined}>{item.approvedAt ? new Date(item.approvedAt).toLocaleTimeString("en-GB", {timeZone:"Africa/Cairo", timeZoneName:"short"}) : "Date not recorded"}</time><span className="cx-badge cx-badge--ok">{item.approvedAt ? item.approvedBy === "internal" ? "Thinkway" : "Client" : "Published"}</span></div>
                  <p className="cx-approved-footnote">{item.approvedAt ? (item.approvedBy === "internal" ? "Approved by Thinkway · " : "Approved by you · ") + new Date(item.approvedAt).toLocaleDateString("en-GB", {timeZone:"Africa/Cairo"}) : "Published content · date not recorded"}</p>
                  <div className="cx-rev__acts">
                    {item.canDownloadOriginal ? <a className="btn" href={clientContentAssetUrl({ token, versionId: item.versionId, mode: "download" })}>{DOWNLOAD_ORIGINAL_LABEL}</a> : null}
                    {item.previewKind !== "none" && item.canDownloadOriginal ? <ClientContentFullSizeButton token={token} versionId={item.versionId} kind={item.previewKind} title={item.fileName || item.deliverable} /> : null}
                    {item.externalUrl ? <a className="btn" href={item.externalUrl} target="_blank" rel="noopener noreferrer">{VIEW_EXTERNAL_LINK_LABEL}</a> : null}
                  </div>
                </div>
                {item.previewKind !== "none" || googleDriveFilePreviewUrl(item.externalUrl) ? (
                  <div className="cx-approved-card__media">
                    <ApprovedContentPreview item={item} token={token} /><span className="cx-film-filename">{item.fileName || item.deliverable}</span>
                    <div className="cx-approved-card__hover-actions" aria-label="Content actions">
                      {item.previewKind === "video" ? <button type="button" className="btn" onClick={event => { const media = event.currentTarget.closest(".cx-approved-card__media"); const play = media?.querySelector<HTMLButtonElement>(".cx-vid__play"); if (play) play.click(); else media?.querySelector<HTMLVideoElement>("video")?.focus(); }}>Preview</button> : null}
                      {item.canDownloadOriginal ? <a className="btn" href={clientContentAssetUrl({ token, versionId: item.versionId, mode: "download" })}>{DOWNLOAD_ORIGINAL_LABEL}</a> : null}
                      {item.previewKind !== "none" && item.canDownloadOriginal ? <ClientContentFullSizeButton token={token} versionId={item.versionId} kind={item.previewKind} title={item.fileName || item.deliverable} /> : null}
                      {item.externalUrl ? <a className="btn" href={item.externalUrl} target="_blank" rel="noopener noreferrer">{VIEW_EXTERNAL_LINK_LABEL}</a> : null}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div></div>)}
        </section>
      ) : null}
    </div>
  );
}
