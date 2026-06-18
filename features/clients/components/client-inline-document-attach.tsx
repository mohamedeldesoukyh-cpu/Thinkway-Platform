"use client";

import {
  EyeIcon,
  FileCheck2Icon,
  Loader2Icon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ChangeEvent } from "react";
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
type ClientDocument = ClientDetail["documents"][number];

type ClientInlineDocumentAttachProps = {
  clientId: string;
  documentType: ClientDocumentType;
  document?: ClientDocument | null;
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
  const [localDocument, setLocalDocument] = useState(document ?? null);
  const [previousDocument, setPreviousDocument] = useState(document);
  const [isDownloading, startDownload] = useTransition();
  const [isUploading, startUpload] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  if (document !== previousDocument) {
    setPreviousDocument(document);
    setLocalDocument(document ?? null);
  }

  const busy = isUploading || isDeleting || isDownloading;

  function refreshClientProfileSafely() {
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
    formData.set("client_id", clientId);
    formData.set("document_type", documentType);
    formData.set("file", file);

    startUpload(async () => {
      try {
        const result = await uploadClientDocumentAction({ ok: false }, formData);
        if (result.ok) {
          toast.success(result.message ?? "Document uploaded.");
          if (result.document) {
            setLocalDocument(result.document as ClientDocument);
          }
          refreshClientProfileSafely();
          return;
        }
        toast.error(result.message ?? "Upload failed.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Upload failed unexpectedly."
        );
      } finally {
        event.target.value = "";
      }
    });
  }

  function handleDelete() {
    if (!localDocument) {
      return;
    }

    const formData = new FormData();
    formData.set("document_id", localDocument.id);
    formData.set("client_id", clientId);

    startDelete(async () => {
      try {
        const result = await deleteClientDocumentAction({ ok: false }, formData);
        if (result.ok) {
          toast.success(result.message ?? "Document removed.");
          setLocalDocument(null);
          refreshClientProfileSafely();
          return;
        }
        toast.error(result.message ?? "Could not remove document.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not remove document."
        );
      }
    });
  }

  return (
    <div className={cn("shrink-0", className)}>
      {localDocument ? (
        <div
          className={cn(
            "flex h-9 items-center gap-0.5 rounded-3xl border border-primary/30 bg-primary/10 px-1",
            busy && "opacity-70"
          )}
          title={localDocument.file_name}
        >
          <span className="flex items-center gap-1 pl-1.5 pr-0.5">
            <FileCheck2Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="hidden max-w-[4.5rem] truncate text-[10px] font-medium text-primary sm:inline">
              {localDocument.file_name}
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
                try {
                  const result = await getClientDocumentDownloadUrlAction(
                    localDocument.id,
                    clientId
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
                    error instanceof Error
                      ? error.message
                      : "Could not open document."
                  );
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
            disabled={busy}
            title="Remove attachment"
            onClick={handleDelete}
          >
            {isDeleting ? (
              <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <XIcon className="h-3.5 w-3.5" />
            )}
          </Button>
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
