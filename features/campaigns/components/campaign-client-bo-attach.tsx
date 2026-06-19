"use client";

import {
  EyeIcon,
  FileCheck2Icon,
  Loader2Icon,
  PaperclipIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition, type ChangeEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getCampaignDocumentDownloadUrlAction,
  uploadCampaignClientBoAction,
} from "@/features/campaigns/actions";
import type { CampaignDocumentRow } from "@/types/database";
import {
  friendlyServerActionError,
  isServerActionDecodeError,
} from "@/lib/clients/client-document-utils";
import { cn } from "@/lib/utils";

type CampaignClientBoAttachProps = {
  campaignHeaderId: string;
  document: CampaignDocumentRow | null;
  className?: string;
  /** Compact inline chip for overview rows */
  variant?: "inline" | "field";
};

export function CampaignClientBoAttach({
  campaignHeaderId,
  document,
  className,
  variant = "field",
}: CampaignClientBoAttachProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDownloading, startDownload] = useTransition();
  const [isUploading, startUpload] = useTransition();

  const busy = isUploading || isDownloading;

  function refreshSafely() {
    try {
      router.refresh();
    } catch {
      toast.error("Document saved, but the page could not refresh. Reload if needed.");
    }
  }

  function openFilePicker() {
    if (!busy) {
      fileInputRef.current?.click();
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.set("campaign_header_id", campaignHeaderId);
    formData.set("file", file);

    startUpload(async () => {
      try {
        const result = await uploadCampaignClientBoAction({ ok: false }, formData);
        if (result.ok) {
          toast.success(result.message ?? "Client BO uploaded.");
          refreshSafely();
          return;
        }
        toast.error(result.message ?? "Upload failed.");
      } catch (error) {
        if (isServerActionDecodeError(error)) {
          refreshSafely();
          toast.warning(friendlyServerActionError(error));
          return;
        }
        toast.error(friendlyServerActionError(error));
      } finally {
        event.target.value = "";
      }
    });
  }

  function handleView() {
    if (!document) {
      return;
    }

    startDownload(async () => {
      try {
        const result = await getCampaignDocumentDownloadUrlAction(
          document.id,
          campaignHeaderId
        );
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.url) {
          window.open(result.url, "_blank", "noopener,noreferrer");
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not open document."
        );
      }
    });
  }

  if (variant === "inline" && document) {
    return (
      <div className={cn("inline-flex items-center gap-1", className)}>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0 text-primary"
          disabled={busy}
          onClick={handleView}
        >
          {isDownloading ? (
            <Loader2Icon className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <EyeIcon className="mr-1 h-3.5 w-3.5" />
          )}
          {document.file_name}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {document ? (
        <div
          className={cn(
            "flex h-9 items-center gap-0.5 rounded-3xl border border-primary/30 bg-primary/10 px-1",
            busy && "opacity-70"
          )}
          title={document.file_name}
        >
          <span className="flex items-center gap-1 pl-1.5 pr-0.5">
            <FileCheck2Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="max-w-[12rem] truncate text-xs font-medium text-primary">
              {document.file_name}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-primary hover:bg-primary/15 hover:text-primary"
            disabled={busy}
            title="View Client BO"
            onClick={handleView}
          >
            {isDownloading ? (
              <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <EyeIcon className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-primary hover:bg-primary/15 hover:text-primary"
            disabled={busy}
            title="Replace Client BO"
            onClick={openFilePicker}
          >
            <PaperclipIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-3xl border-primary/30 bg-primary/10 text-primary shadow-none hover:border-primary/45 hover:bg-primary/15 hover:text-primary"
          disabled={busy}
          onClick={openFilePicker}
        >
          {isUploading ? (
            <Loader2Icon className="h-4 w-4 animate-spin" data-icon="inline-start" />
          ) : (
            <PaperclipIcon className="h-4 w-4" data-icon="inline-start" />
          )}
          Attach Client BO
        </Button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
        disabled={busy}
        tabIndex={-1}
        className="sr-only"
        aria-hidden
        onChange={handleFileChange}
      />
    </div>
  );
}
