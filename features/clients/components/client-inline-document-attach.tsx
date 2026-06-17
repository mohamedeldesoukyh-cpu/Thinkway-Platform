"use client";

import {
  EyeIcon,
  FileCheck2Icon,
  Loader2Icon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  deleteClientDocumentAction,
  getClientDocumentDownloadUrlAction,
  uploadClientDocumentAction,
} from "@/features/clients/actions";
import type { ClientDetail } from "@/types/database";
import { cn } from "@/lib/utils";

type ClientDocumentType = ClientDetail["documents"][number]["document_type"];

type ClientInlineDocumentAttachProps = {
  clientId: string;
  documentType: ClientDocumentType;
  document?: ClientDetail["documents"][number] | null;
  className?: string;
};

export function findClientDocumentByType(
  documents: ClientDetail["documents"],
  documentType: ClientDocumentType
) {
  return documents.find((doc) => doc.document_type === documentType) ?? null;
}

export function ClientInlineDocumentAttach({
  clientId,
  documentType,
  document,
  className,
}: ClientInlineDocumentAttachProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFormRef = useRef<HTMLFormElement>(null);
  const [isDownloading, startDownload] = useTransition();
  const [uploadState, uploadAction, isUploading] = useActionState(
    uploadClientDocumentAction,
    { ok: false }
  );
  const [deleteState, deleteAction, isDeleting] = useActionState(
    deleteClientDocumentAction,
    { ok: false }
  );

  const busy = isUploading || isDeleting || isDownloading;

  useEffect(() => {
    if (!uploadState.message) {
      return;
    }
    if (uploadState.ok) {
      toast.success(uploadState.message);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      router.refresh();
      return;
    }
    toast.error(uploadState.message);
  }, [uploadState, router]);

  useEffect(() => {
    if (!deleteState.message) {
      return;
    }
    if (deleteState.ok) {
      toast.success(deleteState.message);
      router.refresh();
      return;
    }
    toast.error(deleteState.message);
  }, [deleteState, router]);

  function openFilePicker() {
    if (!busy) {
      fileInputRef.current?.click();
    }
  }

  function handleFileChange() {
    const file = fileInputRef.current?.files?.[0];
    if (file) {
      uploadFormRef.current?.requestSubmit();
    }
  }

  return (
    <div className={cn("shrink-0", className)}>
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
            <span className="hidden max-w-[4.5rem] truncate text-[10px] font-medium text-primary sm:inline">
              {document.file_name}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-primary hover:bg-primary/15 hover:text-primary"
            disabled={busy}
            title="View attachment"
            onClick={() => {
              startDownload(async () => {
                const result = await getClientDocumentDownloadUrlAction(
                  document.id,
                  clientId
                );
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                if (result.url) {
                  window.open(result.url, "_blank", "noopener,noreferrer");
                }
              });
            }}
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
            title="Replace attachment"
            onClick={openFilePicker}
          >
            <PaperclipIcon className="h-3.5 w-3.5" />
          </Button>
          <form action={deleteAction} className="flex shrink-0">
            <input type="hidden" name="document_id" value={document.id} />
            <input type="hidden" name="client_id" value={clientId} />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
              disabled={busy}
              title="Remove attachment"
            >
              {isDeleting ? (
                <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XIcon className="h-3.5 w-3.5" />
              )}
            </Button>
          </form>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "h-9 w-9 shrink-0 rounded-3xl border-primary/30 bg-primary/10 text-primary shadow-none",
            "hover:border-primary/45 hover:bg-primary/15 hover:text-primary"
          )}
          disabled={busy}
          title="Attach certificate"
          onClick={openFilePicker}
        >
          {isUploading ? (
            <Loader2Icon className="h-4 w-4 animate-spin" />
          ) : (
            <PaperclipIcon className="h-4 w-4" />
          )}
        </Button>
      )}

      <form
        ref={uploadFormRef}
        action={uploadAction}
        className="sr-only"
        aria-hidden
      >
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="document_type" value={documentType} />
        <input
          ref={fileInputRef}
          name="file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
          disabled={busy}
          tabIndex={-1}
          onChange={handleFileChange}
        />
      </form>
    </div>
  );
}
