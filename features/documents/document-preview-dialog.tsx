"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DocumentPreviewDialogProps } from "@/features/documents/document-types";
import { isPreviewableMimeType } from "@/features/documents/document-utils";

/**
 * Optional in-app preview shell. Entity workspaces today open signed URLs in a
 * new tab; this dialog supports future preview flows without changing storage APIs.
 */
export function DocumentPreviewDialog({
  open,
  onOpenChange,
  fileName,
  mimeType,
  previewUrl,
  isLoading = false,
}: DocumentPreviewDialogProps) {
  const canEmbed = previewUrl && isPreviewableMimeType(mimeType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{fileName}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading preview…
          </p>
        ) : !previewUrl ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Preview unavailable.
          </p>
        ) : canEmbed ? (
          mimeType?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={fileName}
              className="max-h-[70vh] w-full object-contain"
            />
          ) : (
            <iframe
              src={previewUrl}
              title={fileName}
              className="h-[70vh] w-full rounded-md border border-border"
            />
          )
        ) : (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              This file type cannot be previewed inline.
            </p>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary underline"
            >
              Open in new tab
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
