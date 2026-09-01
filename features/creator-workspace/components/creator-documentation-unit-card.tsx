"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  beginCreatorDocumentationUploadAction,
  completeCreatorDocumentationUploadAction,
  downloadCreatorUnitScriptOriginalAction,
  submitCreatorUnitPublicationAction,
  addCreatorUnitCommentAction,
} from "@/features/creator-workspace/actions";
import { unitNeedsCreatorAction, unitStatusPill } from "@/features/creator-workspace/chrome";
import { CreatorPlatformMark, creatorPlatformMeta } from "@/features/creator-workspace/components/creator-platform-mark";
import { CreatorPostPerformancePanel } from "@/features/creator-workspace/components/creator-post-performance";
import { CreatorUnitMediaPreview } from "@/features/creator-workspace/components/creator-unit-media-preview";
import type { CreatorUnitView } from "@/features/creator-workspace/documentation-load";
import type { PostPerformanceAnalysis } from "@/lib/creator-insights/post-performance";
import { CREATOR_ON_BEHALF_ACTOR_LABEL } from "@/lib/services/deliverables/on-behalf";
import {
  alternateDeliverableVideoMime,
  isAllowedDeliverableUploadMime,
  resolveDeliverableUploadMime,
} from "@/lib/services/deliverables/documentation-types";
import { putDeliverableAssetToSignedUrl } from "@/features/campaigns/deliverable-asset-upload";
import { campaignScriptDownloadFileName, campaignScriptDownloadText } from "@/lib/campaign-script";

function formatBytes(size: number | null | undefined): string | null {
  if (size == null || !Number.isFinite(size) || size <= 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function CreatorDocumentationUnitCard({
  unit,
  showCampaignLink = true,
  compactInsight = null,
  analysis = null,
  hideScript = false,
}: {
  unit: CreatorUnitView;
  showCampaignLink?: boolean;
  compactInsight?: string | null;
  analysis?: PostPerformanceAnalysis | null;
  hideScript?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [hot, setHot] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scriptLang, setScriptLang] = useState<"en" | "ar">(
    unit.script?.sourceLanguage === "ar" ? "ar" : "en"
  );
  const [publicationUrl, setPublicationUrl] = useState(unit.publicationUrl ?? "");
  const [comment, setComment] = useState("");

  function runUpload(file: File) {
    startTransition(async () => {
      try {
        const header = await file.slice(0, 32).arrayBuffer();
        let mimeType = resolveDeliverableUploadMime({
          browserType: file.type,
          fileName: file.name,
          header,
        });
        if (!isAllowedDeliverableUploadMime(mimeType)) {
          toast.error("This file type is not supported. Use MP4, MOV, or an image under 150 MB.");
          return;
        }
        const begunInput = {
          campaignHeaderId: unit.campaignHeaderId,
          assignmentDeliverableId: unit.assignmentDeliverableId,
          assignmentPostScheduleId: unit.assignmentPostScheduleId,
          assetType: unit.uploadAssetType,
          fileName: file.name,
          fileSize: file.size,
        };
        let begun = await beginCreatorDocumentationUploadAction({
          ...begunInput,
          mimeType,
        });
        if (!begun.ok) {
          toast.error(begun.message);
          return;
        }
        let uploaded = await putDeliverableAssetToSignedUrl({
          signedUrl: begun.data.signedUrl,
          token: begun.data.token,
          file,
          mimeType,
          bucket: begun.data.bucket,
          storagePath: begun.data.storagePath,
        });
        if (!uploaded.ok && uploaded.mimeRejected) {
          const alternate = alternateDeliverableVideoMime(mimeType);
          if (alternate) {
            mimeType = alternate;
            begun = await beginCreatorDocumentationUploadAction({
              ...begunInput,
              assetId: begun.data.assetId,
              mimeType,
            });
            if (!begun.ok) {
              toast.error(begun.message);
              return;
            }
            uploaded = await putDeliverableAssetToSignedUrl({
              signedUrl: begun.data.signedUrl,
              token: begun.data.token,
              file,
              mimeType,
              bucket: begun.data.bucket,
              storagePath: begun.data.storagePath,
            });
          }
        }
        if (!uploaded.ok) {
          toast.error(uploaded.message);
          return;
        }
        const completed = await completeCreatorDocumentationUploadAction({
          ...begunInput,
          mimeType: uploaded.mimeType,
          assetId: begun.data.assetId,
          versionId: begun.data.versionId,
          versionNumber: begun.data.versionNumber,
          storagePath: begun.data.storagePath,
        });
        if (!completed.ok) {
          toast.error(completed.message);
          return;
        }
        toast.success("Uploaded. Thinkway can see it now.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Upload failed.");
      }
    });
  }

  const scriptBody =
    scriptLang === "ar" ? unit.script?.bodyAr ?? "" : unit.script?.bodyEn ?? "";
  const hasLang =
    scriptLang === "ar"
      ? Boolean(unit.script?.bodyAr?.trim())
      : Boolean(unit.script?.bodyEn?.trim());

  const needs = unitNeedsCreatorAction(unit);
  const pill = unitStatusPill(unit.statusLabel, unit.status);
  const platformName = creatorPlatformMeta(unit.platform).name;
  const dueLine = unit.dueDate
    ? `due ${new Date(unit.dueDate).toLocaleDateString()}`
    : "no due date";
  const changeNote =
    unit.status === "changes_requested"
      ? unit.clientFeedback?.comment ??
        [...unit.versions].reverse().find((version) => version.decisionComment)?.decisionComment
      : null;
  const canUpload = unit.status !== "published";
  const readyToPublish =
    unit.expectsPublicationUrl &&
    (unit.status === "approved" || unit.status === "scheduled") &&
    !unit.publicationUrl;

  return (
    <article className="wk" data-needs={needs}>
      <div className="wk__hd">
        <CreatorPlatformMark platform={unit.platform} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="wk__t">{unit.label}</div>
          <div className="wk__m">
            {showCampaignLink ? (
              <Link href={`/creator-portal/campaigns/${unit.campaignHeaderId}?tab=deliverables`} className="cw-link">
                {unit.campaignName}
              </Link>
            ) : (
              unit.campaignName
            )}{" "}
            · {platformName} · {dueLine}
          </div>
        </div>
        <span className={pill.className}>{pill.label}</span>
      </div>

      {changeNote ? (
        <div className="wk__alert">
          <b>Changes requested</b>
          <span>{changeNote}</span>
        </div>
      ) : null}

      <div className="wk__body">
        <div>
          {unit.currentVersionId ? (
            <CreatorUnitMediaPreview
              campaignHeaderId={unit.campaignHeaderId}
              assignmentDeliverableId={unit.assignmentDeliverableId}
              assignmentPostScheduleId={unit.assignmentPostScheduleId}
              versionId={unit.currentVersionId}
              fileName={unit.currentFileName}
              mimeType={unit.currentMimeType}
              fileSize={unit.currentFileSize}
              versionNumber={unit.currentVersionNumber}
              uploadedAt={unit.currentUploadedAt}
              variant="workspace"
            />
          ) : (
            <div className="wk__media">
              <div className="wk__ph">
                <svg viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M17 8l-5-5-5 5" />
                  <path d="M12 3v12" />
                </svg>
                <span>Nothing uploaded yet</span>
              </div>
            </div>
          )}
        </div>

        <div className="wk__side">
          {canUpload ? (
            <label
              className="drop"
              data-hot={hot || unit.status === "to_do" || unit.status === "changes_requested"}
              onDragOver={(event) => {
                event.preventDefault();
                setHot(true);
              }}
              onDragLeave={() => setHot(false)}
              onDrop={(event) => {
                event.preventDefault();
                setHot(false);
                const file = event.dataTransfer.files[0];
                if (file && !pending) runUpload(file);
              }}
            >
              <input
                type="file"
                className="sr-only"
                disabled={pending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) runUpload(file);
                }}
              />
              <span className="drop__ic">
                <svg viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M17 8l-5-5-5 5" />
                  <path d="M12 3v12" />
                </svg>
              </span>
              <span className="drop__t">{pending ? "Uploading…" : unit.currentVersionId ? "Upload a new version" : unit.uploadPrompt}</span>
              <span className="drop__s">Drag a file here, or click to browse</span>
            </label>
          ) : null}

          {unit.versions.length > 0 ? (
            <div className="blk">
              <span className="blk__l">
                Versions <b className="num">{unit.versions.length}</b>
              </span>
              <div className="vers">
                {[...unit.versions]
                  .sort((a, b) => b.versionNumber - a.versionNumber)
                  .map((version) => (
                    <div
                      key={version.id}
                      className="ver"
                      data-cur={version.id === unit.currentVersionId}
                    >
                      <span className="ver__v num">v{version.versionNumber}</span>
                      <span className="ver__b">
                        <span className="ver__f">{version.fileName ?? `Version ${version.versionNumber}`}</span>
                        <span className="ver__m">
                          {[
                            formatBytes(version.fileSize),
                            new Date(version.uploadedAt).toLocaleString(),
                            version.decision === "approved"
                              ? "Approved"
                              : version.decision === "changes_requested"
                                ? "Changes requested"
                                : "Submitted",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {version.id === unit.currentVersionId ? (
                        <span className="pill pill--blue">Current</span>
                      ) : null}
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          {!hideScript && unit.hasScript ? (
            <div className="blk">
              <span className="blk__l">Script</span>
              <button type="button" className="btn btn-sm" onClick={() => setScriptOpen((open) => !open)}>
                {scriptOpen ? "Hide script" : "Preview script"}
              </button>
              {scriptOpen && unit.script ? (
                <div style={{ marginTop: 10 }}>
                  <CreatorScriptBody
                    unit={unit}
                    scriptLang={scriptLang}
                    setScriptLang={setScriptLang}
                    scriptBody={scriptBody}
                    hasLang={hasLang}
                    pending={pending}
                    startTransition={startTransition}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {analysis ? (
            <CreatorPostPerformancePanel analysis={analysis} />
          ) : compactInsight ? (
            <div className="blk">
              <span className="blk__l">Thinkway Insight</span>
              <p className="blk__none">{compactInsight}</p>
            </div>
          ) : null}

          {unit.onBehalfLabel ? <p className="blk__none">{unit.onBehalfLabel}</p> : null}

          <div className="blk">
            <span className="blk__l">
              Client feedback
              {unit.comments.length ? (
                <>
                  {" "}
                  <b className="num">{unit.comments.length}</b>
                </>
              ) : null}
            </span>
            {unit.comments.length > 0 ? (
              <div className="thread">
                {unit.comments.map((item) => {
                  const agency =
                    item.authorDisplayName === CREATOR_ON_BEHALF_ACTOR_LABEL ||
                    (item.authorDisplayName ?? "").toLowerCase().includes("thinkway");
                  return (
                    <div key={item.id} className="msg" data-me={!agency}>
                      <span className="msg__a">{agency ? "TW" : "You"}</span>
                      <span className="msg__b">
                        <span className="msg__h">
                          {agency ? "Thinkway" : item.authorDisplayName ?? "You"}
                          <i>{new Date(item.createdAt).toLocaleString()}</i>
                        </span>
                        <span className="msg__x">{item.body}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="blk__none">
                No comments yet. Thinkway will leave feedback here after reviewing.
              </p>
            )}
            <form
              className="reply"
              onSubmit={(event) => {
                event.preventDefault();
                const body = comment.trim();
                if (!body) return;
                startTransition(async () => {
                  const result = await addCreatorUnitCommentAction({
                    campaignHeaderId: unit.campaignHeaderId,
                    assignmentDeliverableId: unit.assignmentDeliverableId,
                    assignmentPostScheduleId: unit.assignmentPostScheduleId,
                    body,
                  });
                  if (!result.ok) {
                    toast.error(result.message);
                    return;
                  }
                  setComment("");
                  toast.success("Message sent.");
                });
              }}
            >
              <input
                className="inp"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Reply to Thinkway…"
                disabled={pending}
              />
              <button type="submit" className="btn btn-sm" disabled={pending}>
                Send
              </button>
            </form>
          </div>

          {unit.expectsPublicationUrl ? (
            <div className="blk">
              <span className="blk__l">Publication link</span>
              <form
                className="reply"
                onSubmit={(event) => {
                  event.preventDefault();
                  startTransition(async () => {
                    const result = await submitCreatorUnitPublicationAction({
                      campaignHeaderId: unit.campaignHeaderId,
                      campaignLineId: unit.campaignLineId,
                      assignmentDeliverableId: unit.assignmentDeliverableId,
                      assignmentPostScheduleId: unit.assignmentPostScheduleId,
                      platform: unit.platform,
                      deliverableType: unit.deliverableType,
                      contentUrl: publicationUrl,
                    });
                    if (!result.ok) {
                      toast.error(result.message);
                      return;
                    }
                    toast.success("Publication saved.");
                  });
                }}
              >
                <input
                  className="inp"
                  value={publicationUrl}
                  onChange={(event) => setPublicationUrl(event.target.value)}
                  placeholder="Paste the live post URL once published"
                  disabled={pending || (!readyToPublish && !unit.publicationUrl)}
                />
                <button
                  type="submit"
                  className="btn btn-sm"
                  disabled={pending || !publicationUrl.trim() || (!readyToPublish && !unit.publicationUrl)}
                >
                  Save
                </button>
              </form>
              {unit.publicationUrl ? (
                <a className="blk__link" href={unit.publicationUrl} target="_blank" rel="noopener noreferrer">
                  Open the live post →
                </a>
              ) : readyToPublish ? null : (
                <p className="blk__none">Publication is next after this content is approved.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CreatorScriptBody({
  unit,
  scriptLang,
  setScriptLang,
  scriptBody,
  hasLang,
  pending,
  startTransition,
}: {
  unit: CreatorUnitView;
  scriptLang: "en" | "ar";
  setScriptLang: (value: "en" | "ar") => void;
  scriptBody: string;
  hasLang: boolean;
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  if (!unit.script) return null;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {unit.script.bodyEn.trim() ? (
          <button
            type="button"
            className={`btn btn-sm${scriptLang === "en" ? " btn-primary" : ""}`}
            onClick={() => setScriptLang("en")}
          >
            English
          </button>
        ) : null}
        {unit.script.bodyAr.trim() ? (
          <button
            type="button"
            className={`btn btn-sm${scriptLang === "ar" ? " btn-primary" : ""}`}
            onClick={() => setScriptLang("ar")}
          >
            Arabic
          </button>
        ) : null}
      </div>
      {hasLang ? (
        <pre className="note" style={{ whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto" }}>
          {scriptBody}
        </pre>
      ) : (
        <p className="blk__none">No text in this language.</p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        {hasLang ? (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const downloaded = campaignScriptDownloadText({
                language: scriptLang,
                bodyEn: unit.script!.bodyEn,
                bodyAr: unit.script!.bodyAr,
              });
              if (!downloaded.ok) {
                toast.error(downloaded.message);
                return;
              }
              const blob = new Blob([downloaded.text], {
                type: "text/plain;charset=utf-8",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = campaignScriptDownloadFileName(unit.label, scriptLang);
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download text
          </button>
        ) : null}
        {unit.script.hasOriginalDocument ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={pending}
            onClick={() => {
              startTransition(() => {
                void (async () => {
                  const result = await downloadCreatorUnitScriptOriginalAction({
                    campaignHeaderId: unit.campaignHeaderId,
                    assignmentDeliverableId: unit.assignmentDeliverableId,
                    assignmentPostScheduleId: unit.assignmentPostScheduleId,
                  });
                  if (!result.ok) {
                    toast.error(result.message);
                    return;
                  }
                  window.open(result.data.url, "_blank", "noopener,noreferrer");
                })();
              });
            }}
          >
            Download original
          </button>
        ) : null}
      </div>
    </div>
  );
}
