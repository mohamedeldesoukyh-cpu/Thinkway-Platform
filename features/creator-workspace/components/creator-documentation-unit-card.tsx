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
import type { CreatorUnitView } from "@/features/creator-workspace/documentation-load";
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
}: {
  unit: CreatorUnitView;
  showCampaignLink?: boolean;
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

  return (
    <Card className={cn(unit.status === "changes_requested" && "border-primary/40")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-base font-semibold">{unit.label}</p>
            {showCampaignLink ? (
              <Link
                href={`/creator-portal/campaigns/${unit.campaignHeaderId}`}
                className="text-xs text-primary hover:underline"
              >
                {unit.campaignName}
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">{unit.campaignName}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {unit.dueDate
                ? `Due ${new Date(unit.dueDate).toLocaleDateString()}`
                : "No due date"}
              {unit.platform ? ` · ${unit.platform}` : ""}
            </p>
          </div>
          <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
            {unit.statusLabel}
          </span>
        </div>

        {unit.hasScript ? (
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
                        startTransition(async () => {
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
                        });
                      }}
                    >
                      Download original
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {unit.currentFileName ? (
          <p className="text-sm text-muted-foreground">Submitted: {unit.currentFileName}</p>
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
                {item.authorDisplayName ? `${item.authorDisplayName}: ` : ""}
                {item.body}
              </p>
            ))}
          </div>
        ) : null}

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
          {pending ? "Uploading…" : unit.uploadPrompt}
        </label>

        {unit.expectsPublicationUrl ? (
          <form
            className="space-y-2"
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
            <Input
              value={publicationUrl}
              onChange={(event) => setPublicationUrl(event.target.value)}
              placeholder="Paste the live post URL"
              className="min-h-11"
            />
            <Button type="submit" variant="outline" className="min-h-11 w-full" disabled={pending}>
              Submit publication link
            </Button>
          </form>
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
