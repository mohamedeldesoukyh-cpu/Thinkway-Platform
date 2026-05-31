"use client";

import { format } from "date-fns";
import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";

import { DocumentUploadForm } from "@/components/forms/document-upload-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteClientDocumentAction,
  getClientDocumentDownloadUrlAction,
  uploadClientDocumentAction,
} from "@/features/clients/actions";
import {
  CLIENT_DOCUMENT_TYPE_OPTIONS,
  labelForOption,
} from "@/features/clients/constants";
import type { ClientDetail } from "@/types/database";

export function ClientDocumentsTab({ client }: { client: ClientDetail }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload document</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUploadForm
            entityId={client.id}
            documentTypeOptions={CLIENT_DOCUMENT_TYPE_OPTIONS}
            action={uploadClientDocumentWrapper}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document library</CardTitle>
        </CardHeader>
        <CardContent>
          {client.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents uploaded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.documents.map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      clientId={client.id}
                      doc={doc}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function uploadClientDocumentWrapper(
  prev: { ok: boolean; message?: string; fieldErrors?: Record<string, string[]> },
  formData: FormData
) {
  const mapped = new FormData();
  mapped.set("client_id", String(formData.get("entity_id") ?? ""));
  mapped.set("document_type", String(formData.get("document_type") ?? ""));
  mapped.set("expires_at", String(formData.get("expires_at") ?? ""));
  const file = formData.get("file");
  if (file) {
    mapped.set("file", file);
  }
  return uploadClientDocumentAction(prev, mapped);
}

function DocumentRow({
  clientId,
  doc,
}: {
  clientId: string;
  doc: ClientDetail["documents"][number];
}) {
  const [isPending, startTransition] = useTransition();
  const [deleteState, deleteAction] = useActionState(deleteClientDocumentAction, {
    ok: false,
  });

  useEffect(() => {
    if (!deleteState.message) {
      return;
    }
    if (deleteState.ok) {
      toast.success(deleteState.message);
      return;
    }
    toast.error(deleteState.message);
  }, [deleteState]);

  return (
    <TableRow>
      <TableCell>
        {labelForOption(CLIENT_DOCUMENT_TYPE_OPTIONS, doc.document_type)}
      </TableCell>
      <TableCell className="max-w-[200px] truncate">{doc.file_name}</TableCell>
      <TableCell className="text-muted-foreground">
        {format(new Date(doc.created_at), "MMM d, yyyy")}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {doc.expires_at
          ? format(new Date(doc.expires_at), "MMM d, yyyy")
          : "—"}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const result = await getClientDocumentDownloadUrlAction(
                  doc.id,
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
            Download
          </Button>
          <form action={deleteAction}>
            <input type="hidden" name="document_id" value={doc.id} />
            <input type="hidden" name="client_id" value={clientId} />
            <Button type="submit" variant="ghost" size="sm">
              Remove
            </Button>
          </form>
        </div>
      </TableCell>
    </TableRow>
  );
}
