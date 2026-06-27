import { useCallback, useEffect, useTransition } from "react";
import { toast } from "sonner";

import type {
  DocumentDeleteAction,
  DocumentDownloadResult,
  EntityDocumentUploadResult,
} from "@/features/documents/document-types";

export function useFormActionToast(state: EntityDocumentUploadResult) {
  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      return;
    }
    toast.error(state.message);
  }, [state]);
}

export function useDocumentDownload(
  getDownloadUrl: (
    documentId: string,
    entityId: string
  ) => Promise<DocumentDownloadResult>
) {
  const [isPending, startTransition] = useTransition();

  const download = useCallback(
    (documentId: string, entityId: string) => {
      startTransition(async () => {
        const result = await getDownloadUrl(documentId, entityId);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.url) {
          window.open(result.url, "_blank", "noopener,noreferrer");
        }
      });
    },
    [getDownloadUrl]
  );

  return { download, isPending };
}

export function useDocumentPreview(
  getDownloadUrl: (
    documentId: string,
    entityId: string
  ) => Promise<DocumentDownloadResult>
) {
  const [isPending, startTransition] = useTransition();

  const preview = useCallback(
    (documentId: string, entityId: string, onUrl: (url: string) => void) => {
      startTransition(async () => {
        const result = await getDownloadUrl(documentId, entityId);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.url) {
          onUrl(result.url);
        }
      });
    },
    [getDownloadUrl]
  );

  return { preview, isPending };
}

export function useDocumentDelete(deleteAction: DocumentDeleteAction) {
  const [isPending, startTransition] = useTransition();

  const remove = useCallback(
    (formData: FormData, onSuccess?: () => void) => {
      startTransition(async () => {
        const result = await deleteAction({ ok: false }, formData);
        if (result.message) {
          if (result.ok) {
            toast.success(result.message);
            onSuccess?.();
          } else {
            toast.error(result.message);
          }
        }
      });
    },
    [deleteAction]
  );

  return { remove, isPending };
}
