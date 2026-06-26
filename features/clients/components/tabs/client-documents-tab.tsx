"use client";

import { format } from "date-fns";
import { useActionState, useEffect, useMemo, useTransition } from "react";
import { toast } from "sonner";

import { DocumentUploadForm } from "@/components/forms/document-upload-form";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Button } from "@/components/ui/button";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { OperationalFormSection } from "@/components/workspace/operational-workspace-ui";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import {
  deleteClientDocumentAction,
  getClientDocumentDownloadUrlAction,
} from "@/features/clients/actions";
import { uploadClientDocumentViaApi } from "@/features/clients/client-document-upload-api";
import {
  CLIENT_DOCUMENT_TYPE_OPTIONS,
  labelForOption,
} from "@/features/clients/constants";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import type { ClientDetail } from "@/types/database";
import { CLIENT_DOCUMENTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type DocumentRow = ClientDetail["documents"][number];

function buildClientDocumentsColumns(
  clientId: string
): OperationalConfigurableColumnDef<DocumentRow>[] {
  return [
    {
      id: "type",
      label: "Type",
      renderCell: (doc) =>
        labelForOption(CLIENT_DOCUMENT_TYPE_OPTIONS, doc.document_type),
    },
    {
      id: "file",
      label: "File",
      cellClassName: "max-w-[200px] truncate",
      renderCell: (doc) => doc.file_name,
    },
    {
      id: "uploaded",
      label: "Uploaded",
      cellClassName: "text-muted-foreground",
      renderCell: (doc) => format(new Date(doc.created_at), "MMM d, yyyy"),
    },
    {
      id: "expiry",
      label: "Expiry",
      cellClassName: "text-muted-foreground",
      renderCell: (doc) =>
        doc.expires_at ? format(new Date(doc.expires_at), "MMM d, yyyy") : "—",
    },
    {
      id: "actions",
      label: "Actions",
      locked: true,
      headerClassName: "text-right",
      cellClassName: "text-right",
      renderCell: (doc) => <DocumentActionsCell clientId={clientId} doc={doc} />,
    },
  ];
}

export function ClientDocumentsTab({ client }: { client: ClientDetail }) {
  const columns = useMemo(
    () => buildClientDocumentsColumns(client.id),
    [client.id]
  );
  const columnMetas = useMemo(() => getOperationalTableColumnMetas(columns), [columns]);

  return (
    <div className="space-y-4">
      <OperationalFormSection title="Upload document">
        <DocumentUploadForm
          entityId={client.id}
          documentTypeOptions={CLIENT_DOCUMENT_TYPE_OPTIONS}
          uploadDocument={uploadClientDocumentFromForm}
        />
      </OperationalFormSection>

      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.clientDocuments}
        columns={columns}
        rows={client.documents}
        filterAccessors={CLIENT_DOCUMENTS_FILTER_ACCESSORS}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Document library"
              actions={
                <OperationalTableControlsSlot contextLabel="Client documents" />
              }
            />
          }
        >
          {client.documents.length === 0 ? (
            <p className="px-4 py-8 text-[11px] text-muted-foreground">
              No documents uploaded yet.
            </p>
          ) : (
            <OperationalConfigurableTable
              columns={columns}
              rows={client.documents}
              rowKey={(doc) => doc.id}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>
    </div>
  );
}

async function uploadClientDocumentFromForm(
  entityId: string,
  formData: FormData
) {
  const mapped = new FormData();
  mapped.set("client_id", entityId);
  mapped.set("document_type", String(formData.get("document_type") ?? ""));
  mapped.set("expires_at", String(formData.get("expires_at") ?? ""));
  const file = formData.get("file");
  if (file) {
    mapped.set("file", file);
  }
  return uploadClientDocumentViaApi(entityId, mapped);
}

function DocumentActionsCell({
  clientId,
  doc,
}: {
  clientId: string;
  doc: DocumentRow;
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
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await getClientDocumentDownloadUrlAction(doc.id, clientId);
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
  );
}
