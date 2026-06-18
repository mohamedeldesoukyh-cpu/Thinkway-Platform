"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { DocumentNumber } from "@/components/ui/document-number";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { archiveBrandAction } from "@/features/brands/actions";
import { ClientAddBrandDialog } from "@/features/brands/components/client-add-brand-dialog";
import {
  BrandRowActions,
  BrandStatusToggle,
} from "@/features/brands/components/brand-row-actions";
import {
  brandTableRowToGroupBrandRow,
  clientToLegalEntityRow,
} from "@/features/brands/utils";
import { BrandSheet } from "@/features/groups/components/brand-sheet";
import type { GroupBrandRow } from "@/features/groups/types";
import {
  brandVrInheritanceHint,
  getEffectiveBrandVrPercent,
} from "@/lib/clients/vr-inheritance";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { CLIENT_BRANDS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import type { ClientBrandRow, ClientDetail } from "@/types/database";
import {
  CLIENT_FORM_SAVE_SHORTCUT_HINT,
  ClientFormKeyboardShortcuts,
} from "@/features/clients/components/client-form-ui";
import { Button } from "@/components/ui/button";

const CLIENT_ADD_BRAND_FORM_ID = "client-add-brand-form";

type ClientBrandsTabProps = {
  client: ClientDetail;
  masterData: MasterDataOptions;
  /** When false, Ctrl+S is not wired to the add-brand dialog. */
  shortcutsEnabled?: boolean;
  onGoToOverview?: () => void;
};

type BrandTableContext = {
  clientVr: { vr_rate_id: string | null; vr_rate_percent: number | null };
  onEdit: (brand: ClientBrandRow) => void;
  onArchive: (brand: ClientBrandRow) => void;
};

function formatEffectiveVrLabel(
  brand: ClientBrandRow,
  clientVr: BrandTableContext["clientVr"]
): string {
  const effective = getEffectiveBrandVrPercent(brand, clientVr);
  if (effective == null) {
    return "—";
  }
  const inherited = !brand.vr_rate_id;
  return inherited ? `${effective}% (inherited)` : `${effective}%`;
}

function buildClientBrandsColumns(
  context: BrandTableContext
): OperationalConfigurableColumnDef<ClientBrandRow>[] {
  return [
    {
      id: "brand_number",
      label: "Brand #",
      monoCell: true,
      renderCell: (brand) => <DocumentNumber value={brand.document_number} />,
    },
    {
      id: "name",
      label: "Name",
      renderCell: (brand) => <span className="font-medium">{brand.name}</span>,
    },
    {
      id: "vr_rate",
      label: "VR%",
      renderCell: (brand) => formatEffectiveVrLabel(brand, context.clientVr),
    },
    {
      id: "currency",
      label: "Currency",
      renderCell: (brand) => brand.currency_code,
    },
    {
      id: "campaigns",
      label: "Campaigns",
      headerClassName: "text-right",
      cellClassName: "text-right",
      renderCell: (brand) => brand.active_campaigns,
    },
    {
      id: "status",
      label: "Status",
      renderCell: (brand) => <BrandStatusToggle brand={brand} />,
    },
    {
      id: "actions",
      label: "Actions",
      locked: true,
      headerClassName: "text-right",
      cellClassName: "text-right",
      renderCell: (brand) => (
        <BrandRowActions
          brand={brand}
          onEdit={() => context.onEdit(brand)}
          onArchive={() => context.onArchive(brand)}
        />
      ),
    },
  ];
}

export function ClientBrandsTab({
  client,
  masterData,
  shortcutsEnabled = true,
  onGoToOverview,
}: ClientBrandsTabProps) {
  const hasGroup = Boolean(client.group_id ?? client.group?.id);
  const clientVr = useMemo(
    () => ({
      vr_rate_id: client.vr_rate_id,
      vr_rate_percent: client.vr_rate_percent,
    }),
    [client.vr_rate_id, client.vr_rate_percent]
  );
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editing, setEditing] = useState<GroupBrandRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ClientBrandRow | null>(null);

  const columns = buildClientBrandsColumns({
    clientVr,
    onEdit: (brand) => {
      setEditing(brandTableRowToGroupBrandRow(brand, client.name));
      setEditSheetOpen(true);
    },
    onArchive: setArchiveTarget,
  });

  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveBrandAction,
    { ok: false }
  );

  useEffect(() => {
    if (!archiveState.message) return;
    if (archiveState.ok) {
      toast.success(archiveState.message);
      setArchiveTarget(null);
      return;
    }
    toast.error(archiveState.message);
  }, [archiveState]);

  const legalEntity = clientToLegalEntityRow(client);
  const vrHint = brandVrInheritanceHint(client.vr_rate_percent, false);

  const openAddBrandDialog = () => {
    setAddDialogOpen(true);
  };

  return (
    <>
      <ClientFormKeyboardShortcuts
        formId={CLIENT_ADD_BRAND_FORM_ID}
        enabled={shortcutsEnabled && addDialogOpen}
      />
      <div className="space-y-4">
        {!hasGroup ? (
          <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
            <p className="font-medium">Group required before adding brands</p>
            <p className="mt-1 text-[12px] text-amber-900/80">
              Link this legal entity to a holding group on the Overview tab, then
              return here to add brands.
            </p>
            {onGoToOverview ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={onGoToOverview}
              >
                Go to Overview
              </Button>
            ) : null}
          </div>
        ) : null}

        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.clientBrands}
          columns={columns}
          rows={client.brands}
          filterAccessors={CLIENT_BRANDS_FILTER_ACCESSORS}
        >
          <OperationalTableSection
            wide
            tableOnly
            cardSurface
            leading={
              <CampaignOperationalSectionHeader
                title="Brands"
                description="Commercial brands under this legal entity. VR% inherits from client overview unless overridden."
                actions={
                  <>
                    <OperationalTableControlsSlot contextLabel="Client brands" />
                    <Button
                      size="sm"
                      onClick={openAddBrandDialog}
                      disabled={!hasGroup}
                    >
                      <PlusIcon data-icon="inline-start" />
                      Add new brand
                    </Button>
                  </>
                }
              />
            }
          >
            {client.brands.length === 0 ? (
              <div className="space-y-3 px-4 py-8">
                <p className="text-[11px] text-muted-foreground">
                  No brands yet for this legal entity.
                </p>
                {hasGroup ? (
                  <Button type="button" size="sm" variant="outline" onClick={openAddBrandDialog}>
                    <PlusIcon data-icon="inline-start" />
                    Add new brand
                  </Button>
                ) : null}
              </div>
            ) : (
              <OperationalConfigurableTable
                columns={columns}
                rows={client.brands}
                rowKey={(brand) => brand.id}
              />
            )}
          </OperationalTableSection>
        </OperationalTableSuiteProvider>

        {hasGroup ? (
          <p className="text-[11px] text-muted-foreground">
            {vrHint} Use <span className="font-medium">Add new brand</span> to
            create another brand after each save. {CLIENT_FORM_SAVE_SHORTCUT_HINT}{" "}
            while the add dialog is open.
          </p>
        ) : null}
      </div>

      {hasGroup ? (
        <ClientAddBrandDialog
          client={client}
          masterData={masterData}
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          formId={CLIENT_ADD_BRAND_FORM_ID}
        />
      ) : null}

      <BrandSheet
        legalEntities={[legalEntity]}
        masterData={masterData}
        brand={editing}
        open={editSheetOpen}
        onOpenChange={(open) => {
          setEditSheetOpen(open);
          if (!open) {
            setEditing(null);
          }
        }}
      />

      <Dialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive brand</DialogTitle>
            <DialogDescription>
              {archiveTarget?.active_campaigns
                ? "This brand cannot be archived because campaigns are linked to it."
                : `Archive ${archiveTarget?.name}? You can restore it later by editing the brand status.`}
            </DialogDescription>
          </DialogHeader>
          {archiveTarget ? (
            <form action={archiveAction}>
              <input type="hidden" name="brand_id" value={archiveTarget.id} />
              <input type="hidden" name="client_id" value={archiveTarget.client_id} />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setArchiveTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={archivePending || archiveTarget.active_campaigns > 0}
                >
                  {archivePending ? "Archiving…" : "Archive brand"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
