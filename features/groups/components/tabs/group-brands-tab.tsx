"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { archiveBrandAction } from "@/features/brands/actions";
import {
  BrandRowActions,
  BrandStatusToggle,
} from "@/features/brands/components/brand-row-actions";
import { CLIENT_STATUS_OPTIONS } from "@/features/clients/constants";
import { BrandSheet } from "@/features/groups/components/brand-sheet";
import type { GroupBrandRow, GroupWorkspace } from "@/features/groups/types";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { GROUP_BRANDS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type GroupBrandsTabProps = {
  workspace: GroupWorkspace;
  masterData: MasterDataOptions;
};

type BrandTableContext = {
  onEdit: (brand: GroupBrandRow) => void;
  onArchive: (brand: GroupBrandRow) => void;
};

function buildGroupBrandsColumns(
  context: BrandTableContext
): OperationalConfigurableColumnDef<GroupBrandRow>[] {
  return [
    {
      id: "brand",
      label: "Brand",
      renderCell: (brand) => (
        <div className="space-y-0.5">
          <span className="font-medium">{brand.name}</span>
          <p className="text-[10px] text-muted-foreground">
            <DocumentNumber value={brand.document_number} />
          </p>
        </div>
      ),
    },
    {
      id: "legal_entity",
      label: "Legal entity",
      renderCell: (brand) => brand.client_name,
    },
    {
      id: "category",
      label: "Category",
      renderCell: (brand) => brand.category_name ?? "—",
    },
    {
      id: "subcategory",
      label: "Subcategory",
      renderCell: (brand) => brand.subcategory_name ?? "—",
    },
    {
      id: "vr_rate",
      label: "VR%",
      renderCell: (brand) =>
        brand.vr_rate_percent != null ? `${brand.vr_rate_percent}%` : "—",
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

export function GroupBrandsTab({ workspace, masterData }: GroupBrandsTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<GroupBrandRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<GroupBrandRow | null>(null);

  const columns = useMemo(
    () =>
      buildGroupBrandsColumns({
        onEdit: (brand) => {
          setEditing(brand);
          setSheetOpen(true);
        },
        onArchive: setArchiveTarget,
      }),
    []
  );
  const columnMetas = useMemo(() => getOperationalTableColumnMetas(columns), [columns]);

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

  const filteredBrands = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workspace.brands.filter((brand) => {
      if (statusFilter && brand.status !== statusFilter) return false;
      if (!q) return true;
      return (
        brand.name.toLowerCase().includes(q) ||
        brand.client_name.toLowerCase().includes(q) ||
        (brand.category_name?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [workspace.brands, search, statusFilter]);

  const statusOptions = CLIENT_STATUS_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));

  return (
    <>
      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.groupBrands}
        columns={columns}
        rows={filteredBrands}
        filterAccessors={GROUP_BRANDS_FILTER_ACCESSORS}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Brands"
              description="Commercial brands across all legal entities in this group."
              actions={
                <>
                  <OperationalTableControlsSlot contextLabel="Group brands" />
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditing(null);
                      setSheetOpen(true);
                    }}
                    disabled={workspace.legal_entities.length === 0}
                  >
                    <PlusIcon data-icon="inline-start" />
                    Add brand
                  </Button>
                </>
              }
            />
          }
          toolbar={
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="brand_search">Search</Label>
                <Input
                  id="brand_search"
                  placeholder="Search by brand, entity, or category…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <SearchableSelect
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  options={[{ value: "", label: "All statuses" }, ...statusOptions]}
                  placeholder="All statuses"
                />
              </div>
            </div>
          }
        >
          {workspace.legal_entities.length === 0 ? (
            <p className="px-4 py-8 text-[11px] text-muted-foreground">
              Add a legal entity before creating brands.
            </p>
          ) : filteredBrands.length === 0 ? (
            <p className="px-4 py-8 text-[11px] text-muted-foreground">
              No brands match your filters.
            </p>
          ) : (
            <OperationalConfigurableTable
              columns={columns}
              rows={filteredBrands}
              rowKey={(brand) => brand.id}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>

      <BrandSheet
        legalEntities={workspace.legal_entities}
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
