"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  APPROVED_CONTENT_HEADING,
  APPROVE_CONTENT_LABEL,
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
import { groupClientContentByCreator, matchClientCreatorByName } from "../campaign-tab-aggregates";
import { googleDriveFilePreviewUrl } from "@/lib/services/deliverables/documentation-types";
import type { ClientCreatorCard } from "../types";
import { ClientContentFullSizeButton, ClientVideoPreview } from "./client-content-media";
import { ReviewAvatar } from "./review-avatar";

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
  creators,
  creatorIndex,
}: {
  item: ClientContentReviewItem;
  siblings: ClientContentReviewItem[];
  token: string;
  creators: ClientCreatorCard[];
  creatorIndex: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
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
      const result = await decideOne(item.versionId, decision);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setComment("");
      router.refresh();
    });
  }

  function approveAllFromCreator() {
    setError(null);
    startTransition(async () => {
      for (const sibling of siblings) {
        const result = await decideOne(sibling.versionId, "approved");
        if (!result.ok) {
          setError(result.message);
          return;
        }
      }
      setComment("");
      router.refresh();
    });
  }

  return (
    <div className="cx-pane">
      <div className="cx-rev__head">
        <div className="cx-rev__who">
          <CreatorAvatar
            name={item.creatorName}
            index={creatorIndex}
            token={token}
            creators={creators}
            className="cx-av"
          />
          <span>
            <span className="cx-rev__name">{item.creatorName}</span>
            <span className="cx-rev__file">{item.fileName || item.deliverable}</span>
          </span>
        </div>
        <span className={`cx-badge${item.status === "approved" ? " cx-badge--ok" : ""}`}>
          {CLIENT_CONTENT_STATUS_LABEL[item.status]}
        </span>
      </div>

      <div className="cx-rev">
        <div className="cx-rev__media">
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
        <div>
          <div className="cx-rev__meta" style={{ marginTop: 0, borderTop: "none", paddingTop: 0 }}>
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

          {item.comment ? <p className="camp-content-comment">{item.comment}</p> : null}

          <textarea
            className="cx-rev__notes"
            rows={3}
            placeholder="Notes for Thinkway (optional) — tell us what to change and we'll pass it to the creator."
            value={comment}
            disabled={pending}
            onChange={(event) => setComment(event.target.value)}
          />
          {error ? <p className="note">{error}</p> : null}
          <div className="cx-rev__acts">
            <button type="button" className="btn pri" disabled={pending} onClick={() => decide("approved")}>
              {APPROVE_CONTENT_LABEL}
            </button>
            <button
              type="button"
              className="btn"
              disabled={pending}
              onClick={() => decide("changes_requested")}
            >
              {REQUEST_CONTENT_CHANGES_LABEL}
            </button>
            <span className="cx-spacer" />
            {item.canDownloadOriginal ? (
              <a
                className="btn"
                href={clientContentAssetUrl({ token, versionId: item.versionId, mode: "download" })}
              >
                {DOWNLOAD_ORIGINAL_LABEL}
              </a>
            ) : null}
            {item.externalUrl ? (
              <a className="btn" href={item.externalUrl} target="_blank" rel="noopener noreferrer">
                {VIEW_EXTERNAL_LINK_LABEL}
              </a>
            ) : null}
            {item.previewKind !== "none" && item.canDownloadOriginal ? (
              <ClientContentFullSizeButton
                token={token}
                versionId={item.versionId}
                kind={item.previewKind}
                title={item.fileName || item.deliverable}
              />
            ) : null}
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

          {prior.length > 0 ? (
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
  );
}

export function ContentToReview({
  items,
  token,
  note,
  creators = [],
}: {
  items: ClientContentReviewItem[];
  token: string;
  note?: string;
  creators?: ClientCreatorCard[];
}) {
  const pending = clientContentToReview(items);
  const approved = items.filter((item) => item.status === "approved");
  const groups = groupClientContentByCreator(pending);
  const [selectedKey, setSelectedKey] = useState(() =>
    pending[0] ? reviewItemKey(pending[0]) : ""
  );
  const selected = useMemo(() => {
    return pending.find((item) => reviewItemKey(item) === selectedKey) ?? pending[0] ?? null;
  }, [pending, selectedKey]);
  const selectedGroupIndex = selected
    ? Math.max(
        0,
        groups.findIndex((group) => group.creatorName === (selected.creatorName.trim() || "Creator"))
      )
    : 0;
  const siblings = selected
    ? pending.filter((item) => item.creatorName.trim() === selected.creatorName.trim())
    : [];

  return (
    <div className="card" id="review">
      <p className="ck">Content to review</p>
      <h2>Creator content</h2>
      {note ? <p className="note">{note}</p> : null}

      {pending.length > 0 && selected ? (
        <div className="cx-review">
          <aside className="cx-rail">
            <div className="cx-rail__hd">
              <span className="cx-rail__t">Pending approval</span>
              <span className="cx-rail__n num">{pending.length}</span>
            </div>
            {groups.map((group, index) => (
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
                      <span className="cx-ritem__f">{item.fileName || item.deliverable}</span>
                      <span className="cx-ritem__m">
                        {item.assetTypeLabel} · v{item.versionNumber} · {submittedLabel(item.uploadedAt)}
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
            creators={creators}
            creatorIndex={selectedGroupIndex}
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

      {approved.length > 0 ? (
        <div className="cx-approved">
          <p className="ck">{APPROVED_CONTENT_HEADING}</p>
          <ul>
            {approved.map((item) => (
              <li key={`approved:${reviewItemKey(item)}`}>
                {item.creatorName} · {item.fileName || item.deliverable} ·{" "}
                {CLIENT_CONTENT_STATUS_LABEL.approved}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
