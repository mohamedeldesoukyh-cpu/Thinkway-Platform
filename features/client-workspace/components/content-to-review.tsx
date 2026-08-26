"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  APPROVED_CONTENT_HEADING,
  APPROVE_CONTENT_LABEL,
  CLIENT_CONTENT_STATUS_LABEL,
  DOWNLOAD_ORIGINAL_LABEL,
  NO_CONTENT_TO_REVIEW_COPY,
  NO_CONTENT_TO_REVIEW_HINT,
  REQUEST_CONTENT_CHANGES_LABEL,
  VIEW_EXTERNAL_LINK_LABEL,
  clientContentAssetUrl,
  clientContentToReview,
  type ClientContentReviewItem,
} from "../content-approval";
import { decideContentAction } from "../actions/client-workspace-actions";
import { creatorInitials } from "../campaign-publication-plan";
import { googleDriveFilePreviewUrl } from "@/lib/services/deliverables/documentation-types";

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
    <article className="cx-rev">
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
        <div className="cx-rev__head">
          <div className="cx-rev__who">
            <span className="cx-av">{creatorInitials(item.creatorName)}</span>
            <span>
              <span className="cx-rev__name">{item.creatorName}</span>
              <span className="cx-rev__file">{item.fileName || item.deliverable}</span>
            </span>
          </div>
          <span className={`cx-badge${item.status === "approved" ? " cx-badge--ok" : ""}`}>
            {CLIENT_CONTENT_STATUS_LABEL[item.status]}
          </span>
        </div>

        <div className="cx-rev__meta">
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
            <b>
              {item.uploadedAt
                ? new Date(item.uploadedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </b>
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
            <a
              className="btn"
              href={clientContentAssetUrl({ token, versionId: item.versionId, mode: "preview" })}
              target="_blank"
              rel="noopener noreferrer"
            >
              Full size
            </a>
          ) : null}
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
      </div>
    </article>
  );
}

export function ContentToReview({
  items,
  token,
  note,
}: {
  items: ClientContentReviewItem[];
  token: string;
  note?: string;
}) {
  const pending = clientContentToReview(items);
  const approved = items.filter((item) => item.status === "approved");
  return (
    <div className="card" id="review">
      <p className="ck">Content to review</p>
      <h2>Creator content</h2>
      {note ? <p className="note">{note}</p> : null}
      {pending.length > 0 ? (
        <div className="camp-content-list">
          {pending.map((item) => (
            <ContentReviewCard key={`${item.assetId}:${item.versionId}`} item={item} token={token} />
          ))}
        </div>
      ) : approved.length === 0 ? (
        <>
          <p className="note">{NO_CONTENT_TO_REVIEW_COPY}</p>
          <p className="note">{NO_CONTENT_TO_REVIEW_HINT}</p>
        </>
      ) : null}
      {approved.length > 0 ? (
        <div className="camp-content-list" style={{ marginTop: pending.length > 0 ? 22 : 16 }}>
          <p className="ck">{APPROVED_CONTENT_HEADING}</p>
          {approved.map((item) => (
            <ContentReviewCard key={`approved:${item.assetId}:${item.versionId}`} item={item} token={token} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
