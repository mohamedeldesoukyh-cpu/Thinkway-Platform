"use client";

import { PaperclipIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [isDownloading, startDownload] = useTransition();
  const [uploadState, uploadAction, isUploading] = useActionState(
    uploadClientDocumentAction,
    { ok: false }
  );
  const [deleteState, deleteAction, isDeleting] = useActionState(
    deleteClientDocumentAction,
    { ok: false }
  );

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

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
      {document ? (
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1">
          <PaperclipIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="max-w-[9rem] truncate text-[11px] text-foreground">
            {document.file_name}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            disabled={isDownloading}
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
            View
          </Button>
          <form action={deleteAction}>
            <input type="hidden" name="document_id" value={document.id} />
            <input type="hidden" name="client_id" value={clientId} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
              disabled={isDeleting}
            >
              Remove
            </Button>
          </form>
        </div>
      ) : null}

      <form action={uploadAction} className="flex min-w-0 items-center gap-2">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="document_type" value={documentType} />
        <Input
          ref={fileInputRef}
          name="file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
          disabled={isUploading}
          className="h-8 max-w-[11rem] text-[11px] file:mr-2 file:text-[11px]"
        />
        <Button type="submit" variant="outline" size="sm" disabled={isUploading}>
          {isUploading ? "Uploading…" : document ? "Replace" : "Attach"}
        </Button>
      </form>
    </div>
  );
}
