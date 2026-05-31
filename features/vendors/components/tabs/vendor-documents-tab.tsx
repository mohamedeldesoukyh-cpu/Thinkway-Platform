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
  deleteInfluencerDocumentAction,
  getInfluencerDocumentDownloadUrlAction,
  uploadInfluencerDocumentAction,
} from "@/features/vendors/actions";
import {
  INFLUENCER_DOCUMENT_TYPE_OPTIONS,
  labelForOption,
} from "@/features/vendors/constants";
import type { VendorDetail } from "@/types/database";

export function VendorDocumentsTab({ vendor }: { vendor: VendorDetail }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload document</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUploadForm
            entityId={vendor.id}
            documentTypeOptions={INFLUENCER_DOCUMENT_TYPE_OPTIONS}
            action={uploadInfluencerDocumentWrapper}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document library</CardTitle>
        </CardHeader>
        <CardContent>
          {vendor.documents.length === 0 ? (
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
                  {vendor.documents.map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      influencerId={vendor.id}
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

async function uploadInfluencerDocumentWrapper(
  prev: { ok: boolean; message?: string; fieldErrors?: Record<string, string[]> },
  formData: FormData
) {
  const mapped = new FormData();
  mapped.set("influencer_id", String(formData.get("entity_id") ?? ""));
  mapped.set("document_type", String(formData.get("document_type") ?? ""));
  mapped.set("expires_at", String(formData.get("expires_at") ?? ""));
  const file = formData.get("file");
  if (file) {
    mapped.set("file", file);
  }
  return uploadInfluencerDocumentAction(prev, mapped);
}

function DocumentRow({
  influencerId,
  doc,
}: {
  influencerId: string;
  doc: VendorDetail["documents"][number];
}) {
  const [isPending, startTransition] = useTransition();
  const [deleteState, deleteAction] = useActionState(
    deleteInfluencerDocumentAction,
    { ok: false }
  );

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
        {labelForOption(INFLUENCER_DOCUMENT_TYPE_OPTIONS, doc.document_type)}
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
                const result = await getInfluencerDocumentDownloadUrlAction(
                  doc.id,
                  influencerId
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
            <input type="hidden" name="influencer_id" value={influencerId} />
            <Button type="submit" variant="ghost" size="sm">
              Remove
            </Button>
          </form>
        </div>
      </TableCell>
    </TableRow>
  );
}
