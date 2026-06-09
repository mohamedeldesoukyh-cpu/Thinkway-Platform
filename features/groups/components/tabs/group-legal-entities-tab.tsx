"use client";

import Link from "next/link";
import { ArchiveIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { ClientStatusBadge } from "@/features/clients/components/client-status-badge";
import { labelForOption } from "@/features/clients/constants";
import {
  archiveLegalEntityAction,
  type FormActionState,
} from "@/features/groups/actions";
import {
  LegalEntitySheet,
  paymentTermsLabel,
} from "@/features/groups/components/legal-entity-sheet";
import type { GroupLegalEntityRow, GroupWorkspace } from "@/features/groups/types";
import { formatGroupMoney } from "@/features/groups/utils";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { GROUP_LEGAL_ENTITIES_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type GroupLegalEntitiesTabProps = {
  workspace: GroupWorkspace;
  masterData: MasterDataOptions;
};

type LegalEntityTableContext = {
  groupId: string;
  onEdit: (entity: GroupLegalEntityRow) => void;
};

function buildLegalEntityColumns(
  context: LegalEntityTableContext
): OperationalConfigurableColumnDef<GroupLegalEntityRow>[] {
  return [
    {
      id: "entity",
      label: "Entity",
      renderCell: (entity) => (
        <div className="space-y-0.5">
          <Link
            href={`/clients/${entity.id}`}
            className="font-medium hover:text-primary"
          >
            {entity.name}
          </Link>
          <p className="text-[10px] text-muted-foreground">
            <DocumentNumber value={entity.document_number} />
          </p>
        </div>
      ),
    },
    {
      id: "country",
      label: "Country",
      renderCell: (entity) =>
        entity.country ? labelForOption(COUNTRY_OPTIONS, entity.country) : "—",
    },
    {
      id: "currency",
      label: "Currency",
      renderCell: (entity) => entity.currency,
    },
    {
      id: "payment_terms",
      label: "Payment terms",
      renderCell: (entity) => paymentTermsLabel(entity.payment_terms),
    },
    {
      id: "active_campaigns",
      label: "Active campaigns",
      headerClassName: "text-right",
      cellClassName: "text-right",
      renderCell: (entity) => entity.active_campaigns,
    },
    {
      id: "revenue",
      label: "Revenue",
      amountCell: true,
      renderCell: (entity) => formatGroupMoney(entity.revenue),
    },
    {
      id: "status",
      label: "Status",
      renderCell: (entity) => <ClientStatusBadge status={entity.status} />,
    },
    {
      id: "actions",
      label: "Actions",
      locked: true,
      headerClassName: "text-right",
      cellClassName: "text-right",
      renderCell: (entity) => (
        <LegalEntityActionsCell
          groupId={context.groupId}
          entity={entity}
          onEdit={() => context.onEdit(entity)}
        />
      ),
    },
  ];
}

export function GroupLegalEntitiesTab({ workspace, masterData }: GroupLegalEntitiesTabProps) {
  const currencyOptions = buildCurrencyOptions(masterData.currencies);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<GroupLegalEntityRow | null>(null);

  const columns = useMemo(
    () =>
      buildLegalEntityColumns({
        groupId: workspace.id,
        onEdit: (entity) => {
          setEditing(entity);
          setSheetOpen(true);
        },
      }),
    [workspace.id]
  );
  const columnMetas = useMemo(() => getOperationalTableColumnMetas(columns), [columns]);

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  return (
    <>
      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.groupLegalEntities}
        columns={columns}
        rows={workspace.legal_entities}
        filterAccessors={GROUP_LEGAL_ENTITIES_FILTER_ACCESSORS}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Legal entities"
              description="Contracting parties linked to this group."
              actions={
                <>
                  <OperationalTableControlsSlot contextLabel="Group legal entities" />
                  <Button size="sm" onClick={openCreate}>
                    <PlusIcon data-icon="inline-start" />
                    Add legal entity
                  </Button>
                </>
              }
            />
          }
        >
          {workspace.legal_entities.length === 0 ? (
            <p className="px-4 py-8 text-[11px] text-muted-foreground">
              No legal entities yet. Create one to start adding brands and campaigns.
            </p>
          ) : (
            <OperationalConfigurableTable
              columns={columns}
              rows={workspace.legal_entities}
              rowKey={(entity) => entity.id}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>

      <LegalEntitySheet
        groupId={workspace.id}
        entity={editing}
        currencyOptions={currencyOptions}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}

function LegalEntityActionsCell({
  groupId,
  entity,
  onEdit,
}: {
  groupId: string;
  entity: GroupLegalEntityRow;
  onEdit: () => void;
}) {
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveLegalEntityAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!archiveState.message) {
      return;
    }
    if (archiveState.ok) {
      toast.success(archiveState.message);
      return;
    }
    toast.error(archiveState.message);
  }, [archiveState]);

  return (
    <div className="flex justify-end gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
        <PencilIcon className="size-4" />
        <span className="sr-only">Edit</span>
      </Button>
      {entity.status !== "archived" ? (
        <form action={archiveAction}>
          <input type="hidden" name="client_id" value={entity.id} />
          <input type="hidden" name="group_id" value={groupId} />
          <Button type="submit" variant="ghost" size="sm" disabled={archivePending}>
            <ArchiveIcon className="size-4" />
            <span className="sr-only">Archive</span>
          </Button>
        </form>
      ) : null}
    </div>
  );
}
