"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { useNameAvailability } from "@/components/forms/use-name-availability";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { DocumentNumber } from "@/components/ui/document-number";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { OperationalFormSection } from "@/components/workspace/operational-workspace-ui";
import {
  DETAIL_FORM_INPUT_CLASS,
  DETAIL_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/campaigns/components/operational-detail-panel";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import {
  archiveBrandAction,
  createBrandAction,
} from "@/features/brands/actions";
import {
  BrandRowActions,
  BrandStatusToggle,
} from "@/features/brands/components/brand-row-actions";
import {
  brandTableRowToGroupBrandRow,
  clientToLegalEntityRow,
} from "@/features/brands/utils";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { BrandSheet } from "@/features/groups/components/brand-sheet";
import type { GroupBrandRow } from "@/features/groups/types";
import { checkBrandNameAvailable } from "@/features/validation/actions";
import {
  brandVrInheritanceHint,
  getEffectiveBrandVrPercent,
} from "@/lib/clients/vr-inheritance";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import type { ClientBrandRow, ClientDetail } from "@/types/database";
import { cn } from "@/lib/utils";
import { CLIENT_BRANDS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type ClientBrandsTabProps = {
  client: ClientDetail;
  masterData: MasterDataOptions;
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

export function ClientBrandsTab({ client, masterData }: ClientBrandsTabProps) {
  const currencyOptions = buildCurrencyOptions(masterData.currencies);
  const clientVr = useMemo(
    () => ({
      vr_rate_id: client.vr_rate_id,
      vr_rate_percent: client.vr_rate_percent,
    }),
    [client.vr_rate_id, client.vr_rate_percent]
  );
  const [brandName, setBrandName] = useState("");
  const [vrRateId, setVrRateId] = useState(client.vr_rate_id ?? "");
  const [currency, setCurrency] = useState("USD");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<GroupBrandRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ClientBrandRow | null>(null);

  const columns = buildClientBrandsColumns({
    clientVr,
    onEdit: (brand) => {
      setEditing(brandTableRowToGroupBrandRow(brand, client.name));
      setSheetOpen(true);
    },
    onArchive: setArchiveTarget,
  });
  const columnMetas = getOperationalTableColumnMetas(columns);

  const { checking, message: duplicateMessage, isDuplicate } = useNameAvailability(
    brandName,
    checkBrandNameAvailable,
    [client.id],
    Boolean(brandName.trim())
  );

  const [state, formAction, isPending] = useActionState(createBrandAction, {
    ok: false,
  });

  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveBrandAction,
    { ok: false }
  );

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      setBrandName("");
      setVrRateId(client.vr_rate_id ?? "");
      return;
    }
    toast.error(state.message);
  }, [state, client.vr_rate_id]);

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
  const vrHint = brandVrInheritanceHint(client.vr_rate_percent, Boolean(vrRateId && vrRateId !== client.vr_rate_id));

  return (
    <>
      <div className="space-y-4">
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
                  <OperationalTableControlsSlot contextLabel="Client brands" />
                }
              />
            }
          >
            {client.brands.length === 0 ? (
              <p className="px-4 py-8 text-[11px] text-muted-foreground">
                No brands yet for this legal entity.
              </p>
            ) : (
              <OperationalConfigurableTable
                columns={columns}
                rows={client.brands}
                rowKey={(brand) => brand.id}
              />
            )}
          </OperationalTableSection>
        </OperationalTableSuiteProvider>

        <OperationalFormSection
          title="Add brand"
          footer={
            <Button type="submit" form="client-add-brand-form" disabled={isPending || isDuplicate || checking}>
              {isPending ? "Creating…" : "Add brand"}
            </Button>
          }
        >
            <form id="client-add-brand-form" action={formAction} className="grid gap-4">
              <input type="hidden" name="client_id" value={client.id} />
              <input type="hidden" name="vr_rate_id" value={vrRateId} />
              <input type="hidden" name="currency_code" value={currency} />

              <div className="grid gap-2">
                <Label htmlFor="brand_name">Brand name</Label>
                <Input
                  id="brand_name"
                  name="name"
                  className={DETAIL_FORM_INPUT_CLASS}
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  required
                  disabled={isPending}
                />
                <FieldError messages={state.fieldErrors?.name} />
                {duplicateMessage ? (
                  <p className="text-xs text-destructive">{duplicateMessage}</p>
                ) : checking ? (
                  <p className="text-xs text-muted-foreground">Checking availability…</p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>VR%</Label>
                  <SearchableSelect
                    value={vrRateId}
                    onValueChange={setVrRateId}
                    options={masterData.vrRates.map((v) => ({
                      value: v.id,
                      label: v.name,
                    }))}
                    disabled={isPending}
                    placeholder="Select VR rate"
                  />
                  <p className="text-xs text-muted-foreground">{vrHint}</p>
                </div>
                <div className="grid gap-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
                    <SelectTrigger className={cn(DETAIL_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

            </form>
        </OperationalFormSection>
      </div>

      <BrandSheet
        legalEntities={[legalEntity]}
        masterData={masterData}
        brand={editing}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
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
