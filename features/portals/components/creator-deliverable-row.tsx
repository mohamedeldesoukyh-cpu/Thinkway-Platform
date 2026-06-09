import Link from "next/link";

import { DocumentNumber } from "@/components/ui/document-number";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { CreatorDeliverableUploadForm } from "@/features/portals/components/creator-deliverable-upload-form";
import { getPortalUploadsForDeliverable } from "@/features/portals/queries";
import type { CreatorDeliverableRow } from "@/features/portals/types";

export async function CreatorDeliverableRowPanel({
  deliverable,
}: {
  deliverable: CreatorDeliverableRow;
}) {
  const uploads = await getPortalUploadsForDeliverable(deliverable.id);

  return (
    <div className="rounded-2xl border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{deliverable.title}</p>
          <p className="text-xs text-muted-foreground">
            <DocumentNumber value={deliverable.document_number} />
          </p>
        </div>
        <PortalStatusBadge value={deliverable.status} />
      </div>
      <div className="grid gap-1 text-sm text-muted-foreground">
        <p>
          Due:{" "}
          {deliverable.due_date
            ? new Date(deliverable.due_date).toLocaleDateString()
            : "—"}
        </p>
        {deliverable.content_url ? (
          <p>
            Content:{" "}
            <Link
              href={deliverable.content_url}
              className="text-primary underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              View link
            </Link>
          </p>
        ) : null}
      </div>
      {uploads.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {uploads.map((upload) => (
            <li key={upload.id}>
              {upload.file_name ?? "Upload"}{" "}
              {upload.external_link ? (
                <Link href={upload.external_link} target="_blank" rel="noreferrer" className="text-primary">
                  (link)
                </Link>
              ) : null}
              <span className="ml-1">
                · {new Date(upload.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <CreatorDeliverableUploadForm deliverableId={deliverable.id} />
    </div>
  );
}

export async function CreatorDeliverablesPanels({
  rows,
}: {
  rows: CreatorDeliverableRow[];
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4">
      {rows.map((row) => (
        <CreatorDeliverableRowPanel key={row.id} deliverable={row} />
      ))}
    </div>
  );
}
