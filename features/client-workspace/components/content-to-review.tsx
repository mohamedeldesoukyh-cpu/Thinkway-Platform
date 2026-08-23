"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  APPROVE_CONTENT_LABEL,
  CLIENT_CONTENT_STATUS_LABEL,
  DOWNLOAD_ORIGINAL_LABEL,
  NO_CONTENT_TO_REVIEW_COPY,
  REQUEST_CONTENT_CHANGES_LABEL,
  VIEW_EXTERNAL_LINK_LABEL,
  clientContentAssetUrl,
  clientContentToReview,
  type ClientContentReviewItem,
} from "../content-approval";
import { decideContentAction } from "../actions/client-workspace-actions";
import { ReviewPlatformMark } from "./review-platform-mark";

function statusClass(status: ClientContentReviewItem["status"]): string {
  if (status === "approved") return "sc ok";
  if (status === "changes_requested") return "sc rej";
  return "sc";
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
      <video
        className="camp-content-preview"
        controls
        preload="metadata"
        src={clientContentAssetUrl({ token, versionId: item.versionId, mode: "preview" })}
      />
    );
  }
  return null;
}

function ContentReviewCard({
  item,
  token,
}: {
  item: ClientContentReviewItem;
  token: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const prior = item.history.filter((version) => version.versionId !== item.versionId);

  function decide(decision: "approved" | "changes_requested") {
    setError(null);
    startTransition(async () => {
      const result = await decideContentAction({
        token,
        versionId: item.versionId,
        decision,
        comment: comment.trim() || null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setComment("");
      router.refresh();
    });
  }

  return (
    <article className="camp-content-card">
      <div className="camp-content-head">
        <div>
          <p className="name">{item.creatorName}</p>
          <p className="mt">
            {item.deliverable}
            {item.platformLabel ? ` · ${item.platformLabel}` : ""}
            {` · v${item.versionNumber}`}
          </p>
        </div>
        <span className={statusClass(item.status)}>{CLIENT_CONTENT_STATUS_LABEL[item.status]}</span>
      </div>
      {item.platform ? (
        <p className="ov-plat-row" title={item.platformLabel || item.platform}>
          <span className="ov-pav ov-pav-sm">
            <ReviewPlatformMark platform={item.platform || item.platformLabel} />
          </span>
          {item.assetTypeLabel}
        </p>
      ) : (
        <p className="camp-content-meta">{item.assetTypeLabel}</p>
      )}

      <ContentPreview item={item} token={token} />

      {item.comment ? <p className="camp-content-comment">{item.comment}</p> : null}

      <div className="dacts" style={{ justifyContent: "flex-start", marginTop: 12, flexWrap: "wrap" }}>
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
          <a
            className="btn"
            href={clientContentAssetUrl({ token, versionId: item.versionId, mode: "preview" })}
            target="_blank"
            rel="noopener noreferrer"
          >
            View full size
          </a>
        ) : null}
      </div>

      <textarea
        className="noteinput"
        rows={3}
        placeholder="Notes for Thinkway (optional)"
        value={comment}
        disabled={pending}
        onChange={(event) => setComment(event.target.value)}
      />
      {error ? <p className="note">{error}</p> : null}
      <div className="dacts" style={{ justifyContent: "flex-start", marginTop: 10 }}>
        <button type="button" className="btn pri" disabled={pending} onClick={() => decide("approved")}>
          {APPROVE_CONTENT_LABEL}
        </button>
        <button type="button" className="btn" disabled={pending} onClick={() => decide("changes_requested")}>
          {REQUEST_CONTENT_CHANGES_LABEL}
        </button>
      </div>

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
    </article>
  );
}

export function ContentToReview({
  items,
  token,
}: {
  items: ClientContentReviewItem[];
  token: string;
}) {
  const pending = clientContentToReview(items);
  return (
    <div className="card">
      <p className="ck">Content to Review</p>
      <h2>Creator content</h2>
      {pending.length > 0 ? (
        <div className="camp-content-list">
          {pending.map((item) => (
            <ContentReviewCard key={`${item.assetId}:${item.versionId}`} item={item} token={token} />
          ))}
        </div>
      ) : (
        <p className="note">{NO_CONTENT_TO_REVIEW_COPY}</p>
      )}
    </div>
  );
}
