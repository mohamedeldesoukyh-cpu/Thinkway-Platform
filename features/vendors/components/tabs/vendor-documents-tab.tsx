"use client";

import { format } from "date-fns";
import { useActionState, useEffect, useMemo, useTransition } from "react";
import { toast } from "sonner";

import { DocumentUploadForm } from "@/components/forms/document-upload-form";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Button } from "@/components/ui/button";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { VendorFormSection, VendorProfileTabShell } from "@/features/vendors/components/vendor-form-ui";
import { FileStackIcon } from "lucide-react";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import {
  deleteInfluencerDocumentAction,
  getInfluencerDocumentDownloadUrlAction,
  uploadInfluencerDocumentAction,
} from "@/features/vendors/actions";
import {
  INFLUENCER_DOCUMENT_TYPE_OPTIONS,
  labelForOption,
} from "@/features/vendors/constants";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import type { VendorDetail } from "@/types/database";
import { VENDOR_DOCUMENTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type DocumentRow = VendorDetail["documents"][number];

function buildVendorDocumentsColumns(
  influencerId: string
): OperationalConfigurableColumnDef<DocumentRow>[] {
  return [
    {
      id: "type",
      label: "Type",
      renderCell: (doc) =>
        labelForOption(INFLUENCER_DOCUMENT_TYPE_OPTIONS, doc.document_type),
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
      renderCell: (doc) => (
        <DocumentActionsCell influencerId={influencerId} doc={doc} />
      ),
    },
  ];
}

export function VendorDocumentsTab({
  vendor,
  onCancel,
}: {
  vendor: VendorDetail;
  onCancel?: () => void;
}) {
  const columns = useMemo(
    () => buildVendorDocumentsColumns(vendor.id),
    [vendor.id]
  );

  return (
    <VendorProfileTabShell
      title="Documents"
      description="Upload and manage compliance documents for this creator."
      onCancel={onCancel}
    >
      <div className="grid gap-[18px]">
        <VendorFormSection
          icon={FileStackIcon}
          title="Upload document"
          description="Attach trade licenses, IDs, and other vendor files."
        >
          <DocumentUploadForm
            entityId={vendor.id}
            documentTypeOptions={INFLUENCER_DOCUMENT_TYPE_OPTIONS}
            action={uploadInfluencerDocumentWrapper}
          />
        </VendorFormSection>

        <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.vendorDocuments}
        columns={columns}
        rows={vendor.documents}
        filterAccessors={VENDOR_DOCUMENTS_FILTER_ACCESSORS}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Document library"
              actions={
                <OperationalTableControlsSlot contextLabel="Vendor documents" />
              }
            />
          }
        >
          {vendor.documents.length === 0 ? (
            <p className="px-4 py-8 text-[11px] text-muted-foreground">
              No documents uploaded yet.
            </p>
          ) : (
            <OperationalConfigurableTable
              columns={columns}
              rows={vendor.documents}
              rowKey={(doc) => doc.id}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>
      </div>
    </VendorProfileTabShell>
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

function DocumentActionsCell({
  influencerId,
  doc,
}: {
  influencerId: string;
  doc: DocumentRow;
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
  );
}
