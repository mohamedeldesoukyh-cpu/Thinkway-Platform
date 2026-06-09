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
import { labelForOption } from "@/features/clients/constants";
import {
  deleteGroupDocumentAction,
  getGroupDocumentDownloadUrlAction,
  uploadGroupDocumentAction,
  type FormActionState,
} from "@/features/groups/actions";
import {
  GROUP_DOCUMENT_TYPE_OPTIONS,
  type GroupDocumentRow,
  type GroupWorkspace,
} from "@/features/groups/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { GROUP_DOCUMENTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type GroupDocumentsTabProps = {
  workspace: GroupWorkspace;
};

function buildGroupDocumentsColumns(
  groupId: string
): OperationalConfigurableColumnDef<GroupDocumentRow>[] {
  return [
    {
      id: "type",
      label: "Type",
      renderCell: (doc) =>
        labelForOption(GROUP_DOCUMENT_TYPE_OPTIONS, doc.document_type),
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
      renderCell: (doc) => <DocumentActionsCell groupId={groupId} doc={doc} />,
    },
  ];
}

export function GroupDocumentsTab({ workspace }: GroupDocumentsTabProps) {
  const columns = useMemo(
    () => buildGroupDocumentsColumns(workspace.id),
    [workspace.id]
  );
  const columnMetas = useMemo(() => getOperationalTableColumnMetas(columns), [columns]);

  return (
    <div className="space-y-4">
      <OperationalFormSection
        title="Upload document"
        description="NDAs, agreements, tax documents, and group-level contracts."
      >
        <DocumentUploadForm
          entityId={workspace.id}
          documentTypeOptions={GROUP_DOCUMENT_TYPE_OPTIONS}
          action={uploadGroupDocumentWrapper}
        />
      </OperationalFormSection>

      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.groupDocuments}
        columns={columns}
        rows={workspace.documents}
        filterAccessors={GROUP_DOCUMENTS_FILTER_ACCESSORS as Partial<
          Record<string, (row: GroupWorkspace["documents"][number]) => import("@/lib/tables/operational-table-filter-sort").FilterableValue>
        >}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Document library"
              actions={
                <OperationalTableControlsSlot contextLabel="Group documents" />
              }
            />
          }
        >
          {workspace.documents.length === 0 ? (
            <p className="px-4 py-8 text-[11px] text-muted-foreground">
              No group documents uploaded yet.
            </p>
          ) : (
            <OperationalConfigurableTable
              columns={columns}
              rows={workspace.documents}
              rowKey={(doc) => doc.id}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>
    </div>
  );
}

async function uploadGroupDocumentWrapper(
  prev: FormActionState,
  formData: FormData
) {
  const mapped = new FormData();
  mapped.set("group_id", String(formData.get("entity_id") ?? ""));
  mapped.set("document_type", String(formData.get("document_type") ?? ""));
  mapped.set("expires_at", String(formData.get("expires_at") ?? ""));
  const file = formData.get("file");
  if (file) {
    mapped.set("file", file);
  }
  return uploadGroupDocumentAction(prev, mapped);
}

function DocumentActionsCell({
  groupId,
  doc,
}: {
  groupId: string;
  doc: GroupDocumentRow;
}) {
  const [isPending, startTransition] = useTransition();
  const [deleteState, deleteAction] = useActionState(deleteGroupDocumentAction, {
    ok: false,
  } satisfies FormActionState);

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
            const result = await getGroupDocumentDownloadUrlAction(doc.id, groupId);
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
        <input type="hidden" name="group_id" value={groupId} />
        <Button type="submit" variant="ghost" size="sm">
          Remove
        </Button>
      </form>
    </div>
  );
}
