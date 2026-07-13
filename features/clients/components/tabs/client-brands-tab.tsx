"use client";

import { PlusIcon, TagIcon } from "lucide-react";
import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { platformV6BadgeClass } from "@/components/platform/platform-v6-layout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { archiveBrandAction } from "@/features/brands/actions";
import { ClientAddBrandDialog } from "@/features/brands/components/client-add-brand-dialog";
import {
  BrandDeactivateButton,
  BrandRowActions,
  BrandStatusCell,
} from "@/features/brands/components/brand-row-actions";
import {
  brandTableRowToGroupBrandRow,
  clientToLegalEntityRow,
} from "@/features/brands/utils";
import { BrandSheet } from "@/features/groups/components/brand-sheet";
import type { GroupBrandRow } from "@/features/groups/types";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { CLIENT_BRANDS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import type { ClientBrandRow, ClientDetail } from "@/types/database";
import {
  CLIENT_FORM_GHOST_BUTTON_CLASS,
  CLIENT_FORM_PRIMARY_BUTTON_CLASS,
  CLIENT_FORM_SAVE_SHORTCUT_HINT,
  CLIENT_FORM_SECONDARY_BUTTON_CLASS,
  ClientFormKeyboardShortcuts,
  ClientFormSection,
  ClientProfileTabShell,
  useClientProfilePlatformV6,
} from "@/features/clients/components/client-form-ui";
import { cn } from "@/lib/utils";

const CLIENT_ADD_BRAND_FORM_ID = "client-add-brand-form";

type ClientBrandsTabProps = {
  client: ClientDetail;
  masterData: MasterDataOptions;
  onCancel?: () => void;
  shortcutsEnabled?: boolean;
  onGoToOverview?: () => void;
};

type BrandTableContext = {
  onEdit: (brand: ClientBrandRow) => void;
  onArchive: (brand: ClientBrandRow) => void;
  platformV6: boolean;
};

function formatBrandVrOverride(brand: ClientBrandRow): string {
  if (brand.vr_rate_id && brand.vr_rate_percent != null) {
    return `${brand.vr_rate_percent}%`;
  }
  return "—";
}

function buildClientBrandsColumns(
  context: BrandTableContext
): OperationalConfigurableColumnDef<ClientBrandRow>[] {
  return [
    {
      id: "brand_number",
      label: "Brand #",
      monoCell: true,
      renderCell: (brand) => (
        <button
          type="button"
          onClick={() => context.onEdit(brand)}
          className={cn(
            context.platformV6
              ? "platform-v6-link tabular-nums"
              : "font-mono text-[#0057FF] hover:underline"
          )}
        >
          {brand.document_number}
        </button>
      ),
    },
    {
      id: "name",
      label: "Name",
      renderCell: (brand) => (
        <span className={cn(context.platformV6 && "font-semibold text-[var(--tw-text)]")}>
          {brand.name}
        </span>
      ),
    },
    {
      id: "vr_rate",
      label: "VR%",
      renderCell: (brand) => formatBrandVrOverride(brand),
    },
    {
      id: "currency",
      label: "Currency",
      renderCell: (brand) => brand.currency_code,
    },
    {
      id: "campaigns",
      label: "Campaigns",
      headerClassName: "text-center",
      cellClassName: "text-center",
      renderCell: (brand) => brand.active_campaigns,
    },
    {
      id: "status",
      label: "Status",
      renderCell: (brand) =>
        context.platformV6 ? (
          brand.status === "active" ? (
            <span className={platformV6BadgeClass("outline-green")}>Active</span>
          ) : (
            <BrandStatusCell status={brand.status} />
          )
        ) : (
          <BrandStatusCell status={brand.status} />
        ),
    },
    {
      id: "actions",
      label: "Actions",
      locked: true,
      headerClassName: "text-right",
      cellClassName: "text-right",
      renderCell: (brand) => (
        <div
          className={cn(
            context.platformV6 && "platform-v6-row-actions"
          )}
        >
          <BrandDeactivateButton brand={brand} />
          <BrandRowActions
            brand={brand}
            onEdit={() => context.onEdit(brand)}
            onArchive={() => context.onArchive(brand)}
            triggerClassName={
              context.platformV6
                ? "platform-v6-btn platform-v6-btn-sm !px-[6px]"
                : undefined
            }
          />
        </div>
      ),
    },
  ];
}

export function ClientBrandsTab({
  client,
  masterData,
  onCancel,
  shortcutsEnabled = true,
  onGoToOverview,
}: ClientBrandsTabProps) {
  const platformV6 = useClientProfilePlatformV6();
  const savedGroupId = client.group_id ?? client.group?.id ?? null;
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editing, setEditing] = useState<GroupBrandRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ClientBrandRow | null>(null);

  const openEditBrand = useCallback(
    (brand: ClientBrandRow) => {
      setEditing(brandTableRowToGroupBrandRow(brand, client.name));
      setEditSheetOpen(true);
    },
    [client.name]
  );

  const columns = useMemo(
    () =>
      buildClientBrandsColumns({
        onEdit: openEditBrand,
        onArchive: setArchiveTarget,
        platformV6,
      }),
    [openEditBrand, platformV6]
  );

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
  const openAddBrandDialog = () => setAddDialogOpen(true);

  const portfolioFooter = (
    <>
      Set default VR% on client overview or override here. Use{" "}
      <strong>Add new brand</strong> to create another brand after each save.
      {platformV6 ? null : (
        <>
          {" "}
          {CLIENT_FORM_SAVE_SHORTCUT_HINT} while the add dialog is open.
        </>
      )}
    </>
  );

  const addBrandButton = platformV6 ? (
    <button
      type="button"
      className="platform-v6-btn platform-v6-btn-primary platform-v6-btn-sm"
      onClick={openAddBrandDialog}
    >
      + Add new brand
    </button>
  ) : (
    <button
      type="button"
      className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
      onClick={openAddBrandDialog}
    >
      <PlusIcon className="size-[15px]" strokeWidth={2.2} aria-hidden />
      Add new brand
    </button>
  );

  const portfolioToolbar = (
    <>
      <OperationalTableControlsSlot contextLabel="Client brands" />
      {addBrandButton}
    </>
  );

  return (
    <>
      <ClientFormKeyboardShortcuts
        formId={CLIENT_ADD_BRAND_FORM_ID}
        enabled={shortcutsEnabled && addDialogOpen}
      />
      <ClientProfileTabShell
        title="Brands"
        description="Commercial brands under this legal entity. VR% inherits from overview unless overridden."
        onCancel={onCancel}
      >
        <div className={cn(!platformV6 && "grid gap-[18px]")}>
          {!savedGroupId ? (
            <div
              className={cn(
                platformV6
                  ? "mb-3 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-950"
                  : "rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950"
              )}
            >
              <p className="font-medium">No holding group linked</p>
              <p className="mt-1 text-[12px] text-amber-900/80">
                You can add brands without a holding group. If this legal entity belongs to
                one, link it on the Overview tab for group-level reporting.
              </p>
              {onGoToOverview ? (
                <button
                  type="button"
                  className={cn(
                    platformV6
                      ? "platform-v6-btn platform-v6-btn-sm mt-3"
                      : CLIENT_FORM_SECONDARY_BUTTON_CLASS,
                    !platformV6 && "mt-3"
                  )}
                  onClick={onGoToOverview}
                >
                  Go to Overview
                </button>
              ) : null}
            </div>
          ) : null}

          <OperationalTableSuiteProvider
            tableId={OPERATIONAL_TABLE_IDS.clientBrands}
            columns={columns}
            rows={client.brands}
            filterAccessors={CLIENT_BRANDS_FILTER_ACCESSORS}
          >
            <ClientFormSection
              icon={TagIcon}
              iconClassName="platform-v6-wide-form-head-icon-purple"
              title="Brand portfolio"
              description="Manage brands, VR overrides, and status for this legal entity."
              toolbar={portfolioToolbar}
              bodyClassName={platformV6 ? "platform-v6-wide-form-body-table" : undefined}
              footer={portfolioFooter}
            >
              {client.brands.length === 0 ? (
                <div
                  className={cn(
                    platformV6 ? "platform-v6-empty-state" : "space-y-3 py-6"
                  )}
                >
                  <p
                    className={cn(
                      !platformV6 && "text-[13px] text-[#9099A8]"
                    )}
                  >
                    No brands yet for this legal entity.
                  </p>
                  <button
                    type="button"
                    className={
                      platformV6
                        ? "platform-v6-btn platform-v6-btn-sm mt-3"
                        : CLIENT_FORM_SECONDARY_BUTTON_CLASS
                    }
                    onClick={openAddBrandDialog}
                  >
                    {platformV6 ? (
                      "+ Add new brand"
                    ) : (
                      <>
                        <PlusIcon className="size-[15px]" strokeWidth={2.2} aria-hidden />
                        Add new brand
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div
                  className={cn(
                    "overflow-x-auto",
                    !platformV6 && "-mx-[22px]"
                  )}
                >
                  <OperationalConfigurableTable
                    columns={columns}
                    rows={client.brands}
                    rowKey={(brand) => brand.id}
                    className={platformV6 ? "platform-v6-data-table" : undefined}
                  />
                </div>
              )}
            </ClientFormSection>
          </OperationalTableSuiteProvider>
        </div>
      </ClientProfileTabShell>

      <ClientAddBrandDialog
        client={client}
        masterData={masterData}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        formId={CLIENT_ADD_BRAND_FORM_ID}
      />

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
                <button
                  type="button"
                  className={CLIENT_FORM_GHOST_BUTTON_CLASS}
                  onClick={() => setArchiveTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex h-auto items-center gap-1.5 rounded-[10px] border-transparent bg-destructive px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                  disabled={archivePending || archiveTarget.active_campaigns > 0}
                >
                  {archivePending ? "Archiving…" : "Archive brand"}
                </button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
