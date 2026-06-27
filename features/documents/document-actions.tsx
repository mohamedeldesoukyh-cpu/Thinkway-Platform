"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { DocumentActionsProps } from "@/features/documents/document-types";
import { useDocumentDownload, useFormActionToast } from "@/features/documents/document-hooks";

export function DocumentRowActions({
  entityId,
  document,
  config,
}: DocumentActionsProps) {
  const { download, isPending: isDownloading } = useDocumentDownload(
    config.getDownloadUrl
  );
  const [deleteState, deleteAction] = useActionState(config.deleteAction, {
    ok: false,
  });

  useFormActionToast(deleteState);

  const busy = isDownloading;

  return (
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => download(document.id, entityId)}
      >
        Download
      </Button>
      <form action={deleteAction}>
        <input type="hidden" name="document_id" value={document.id} />
        <input type="hidden" name={config.entityIdField} value={entityId} />
        <Button type="submit" variant="ghost" size="sm">
          Remove
        </Button>
      </form>
    </div>
  );
}

/** Standalone download button for inline / bank-letter flows. */
export function DocumentDownloadButton({
  entityId,
  documentId,
  getDownloadUrl,
  label = "Download",
  size = "sm",
}: {
  entityId: string;
  documentId: string;
  getDownloadUrl: DocumentActionsProps["config"]["getDownloadUrl"];
  label?: string;
  size?: "sm" | "default";
}) {
  const { download, isPending } = useDocumentDownload(getDownloadUrl);

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled={isPending}
      onClick={() => download(documentId, entityId)}
    >
      {label}
    </Button>
  );
}

/** View / preview trigger — opens signed URL in a new tab (existing UX). */
export function DocumentViewButton({
  entityId,
  documentId,
  getDownloadUrl,
  title = "View attachment",
}: {
  entityId: string;
  documentId: string;
  getDownloadUrl: DocumentActionsProps["config"]["getDownloadUrl"];
  title?: string;
}) {
  const { download, isPending } = useDocumentDownload(getDownloadUrl);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      disabled={isPending}
      title={title}
      onClick={() => download(documentId, entityId)}
    >
      {isPending ? "…" : "View"}
    </Button>
  );
}
