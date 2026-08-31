"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  beginCreatorDocumentationUploadAction,
  completeCreatorDocumentationUploadAction,
  downloadCreatorUnitScriptOriginalAction,
  submitCreatorUnitPublicationAction,
  addCreatorUnitCommentAction,
} from "@/features/creator-workspace/actions";
import { CreatorUnitMediaPreview } from "@/features/creator-workspace/components/creator-unit-media-preview";
import type { CreatorUnitView } from "@/features/creator-workspace/documentation-load";
import { CREATOR_ON_BEHALF_ACTOR_LABEL } from "@/lib/services/deliverables/on-behalf";
import {
  alternateDeliverableVideoMime,
  isAllowedDeliverableUploadMime,
  resolveDeliverableUploadMime,
} from "@/lib/services/deliverables/documentation-types";
import { putDeliverableAssetToSignedUrl } from "@/features/campaigns/deliverable-asset-upload";
import { campaignScriptDownloadFileName, campaignScriptDownloadText } from "@/lib/campaign-script";
import { cn } from "@/lib/utils";

export function CreatorDocumentationUnitCard({
  unit,
  showCampaignLink = true,
  compactInsight = null,
  hideScript = false,
}: {
  unit: CreatorUnitView;
  showCampaignLink?: boolean;
  compactInsight?: string | null;
  hideScript?: boolean;
}) {
  const [pending, startTransition] = useTransition();
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

  const readyToPublish =
    unit.expectsPublicationUrl &&
    (unit.status === "approved" || unit.status === "scheduled") &&
    !unit.publicationUrl;
  const uploadLabel =
    unit.status === "changes_requested"
      ? "Upload revised version"
      : unit.received
        ? "Upload a new version"
        : unit.uploadPrompt;

  return (
    <Card className={cn(unit.status === "changes_requested" && "border-primary/40")}>
      <CardContent className="space-y-3 p-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold">{unit.label}</p>
            <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Campaign</dt>
                <dd>
                  {showCampaignLink ? (
                    <Link
                      href={`/creator-portal/campaigns/${unit.campaignHeaderId}?tab=deliverables`}
                      className="text-primary hover:underline"
                    >
                      {unit.campaignName}
                    </Link>
                  ) : (
                    unit.campaignName
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Platform</dt>
                <dd>{unit.platform ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Due date</dt>
                <dd>
                  {unit.dueDate
                    ? new Date(unit.dueDate).toLocaleDateString()
                    : "No due date"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Publication</dt>
                <dd>
                  {unit.publicationUrl
                    ? "Published"
                    : unit.expectsPublicationUrl
                      ? unit.status === "approved" || unit.status === "scheduled"
                        ? "URL required"
                        : "After approval"
                      : "Not required"}
                </dd>
              </div>
            </dl>
          </div>
          <span className="w-fit rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
            {unit.statusLabel}
          </span>
        </div>

        {compactInsight ? (
          <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm">
            <span className="font-medium">Thinkway Insight: </span>
            {compactInsight}
          </p>
        ) : null}

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
          />
        ) : (
          <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>
        )}

        {unit.versions.length > 1 ? (
          <div className="space-y-2 rounded-xl border border-border p-3">
            <p className="text-sm font-medium">Version history</p>
            <ul className="space-y-2">
              {unit.versions.map((version) => (
                <li key={version.id} className="text-sm">
                  <p className="font-medium">
                    Version {version.versionNumber}
                    {version.id === unit.currentVersionId ? " · Current" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(version.uploadedAt).toLocaleDateString()}
                    {version.decision === "approved"
                      ? " · Approved"
                      : version.decision === "changes_requested"
                        ? " · Changes requested"
                        : " · Submitted"}
                    {version.fileName ? ` · ${version.fileName}` : ""}
                  </p>
                  {version.decisionComment ? (
                    <p className="mt-1 text-muted-foreground">{version.decisionComment}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!hideScript && unit.hasScript ? (
          <div className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">Script available</p>
              <Button
                type="button"
                size="sm"
                className="min-h-11"
                variant="outline"
                onClick={() => setScriptOpen((open) => !open)}
              >
                {scriptOpen ? "Hide" : "Preview"}
              </Button>
            </div>
            {scriptOpen && unit.script ? (
              <CreatorScriptBody
                unit={unit}
                scriptLang={scriptLang}
                setScriptLang={setScriptLang}
                scriptBody={scriptBody}
                hasLang={hasLang}
                pending={pending}
                startTransition={startTransition}
              />
            ) : null}
          </div>
        ) : null}

        {unit.onBehalfLabel ? (
          <p className="text-sm text-muted-foreground">{unit.onBehalfLabel}</p>
        ) : null}

        {unit.clientFeedback ? (
          <div className="rounded-xl border border-border p-3 text-sm">
            <p className="font-medium">
              {unit.clientFeedback.decision === "changes_requested"
                ? "Changes requested"
                : "Approved"}
            </p>
            {unit.clientFeedback.comment ? (
              <p className="mt-1 text-muted-foreground">{unit.clientFeedback.comment}</p>
            ) : null}
          </div>
        ) : null}

        {unit.comments.length > 0 ? (
          <div className="space-y-2">
            {unit.comments.map((item) => (
              <p key={item.id} className="text-sm text-muted-foreground">
                {item.authorDisplayName === CREATOR_ON_BEHALF_ACTOR_LABEL
                  ? "Thinkway on your behalf: "
                  : item.authorDisplayName
                    ? `${item.authorDisplayName}: `
                    : ""}
                {item.body}
                <span className="mt-0.5 block text-xs">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </p>
            ))}
          </div>
        ) : null}

        {unit.status !== "published" ? (
          <label className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
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
            {pending ? "Uploading…" : uploadLabel}
          </label>
        ) : null}

        {unit.expectsPublicationUrl ? (
          readyToPublish || unit.publicationUrl ? (
            <form
              className="space-y-2 rounded-xl border border-border p-3"
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
              <p className="text-sm font-medium">
                {unit.publicationUrl ? "Publication link" : "Ready to publish"}
              </p>
              <p className="text-xs text-muted-foreground">
                {unit.platform ? `${unit.platform} · ` : ""}
                Content upload and publication are separate. Paste the live post URL after you publish.
              </p>
              {unit.publicationUrl ? (
                <a
                  href={unit.publicationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm text-primary underline-offset-4 hover:underline"
                >
                  {unit.publicationUrl}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This deliverable has not been published yet.
                </p>
              )}
              <Input
                value={publicationUrl}
                onChange={(event) => setPublicationUrl(event.target.value)}
                placeholder="Paste the live post URL"
                className="min-h-11"
              />
              <Button type="submit" variant="outline" className="min-h-11 w-full" disabled={pending}>
                {unit.publicationUrl ? "Update publication link" : "Submit publication link"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Publication is next after this content is approved.
            </p>
          )
        ) : null}

        <form
          className="space-y-2"
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
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Message Thinkway about this deliverable"
            className="min-h-20"
          />
          <Button type="submit" variant="ghost" className="min-h-11 w-full" disabled={pending}>
            Send message
          </Button>
        </form>
      </CardContent>
    </Card>
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
    <div className="space-y-2">
      <div className="flex gap-2">
        {unit.script.bodyEn.trim() ? (
          <Button
            type="button"
            size="sm"
            variant={scriptLang === "en" ? "default" : "outline"}
            onClick={() => setScriptLang("en")}
          >
            English
          </Button>
        ) : null}
        {unit.script.bodyAr.trim() ? (
          <Button
            type="button"
            size="sm"
            variant={scriptLang === "ar" ? "default" : "outline"}
            onClick={() => setScriptLang("ar")}
          >
            Arabic
          </Button>
        ) : null}
      </div>
      {hasLang ? (
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">
          {scriptBody}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground">No text in this language.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {hasLang ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
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
          </Button>
        ) : null}
        {unit.script.hasOriginalDocument ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
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
          </Button>
        ) : null}
      </div>
    </div>
  );
}
