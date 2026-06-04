"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DocumentNumber } from "@/components/ui/document-number";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { archiveBrandAction } from "@/features/brands/actions";
import {
  BrandRowActions,
  BrandStatusToggle,
} from "@/features/brands/components/brand-row-actions";
import { CLIENT_STATUS_OPTIONS } from "@/features/clients/constants";
import { BrandSheet } from "@/features/groups/components/brand-sheet";
import type { GroupBrandRow, GroupWorkspace } from "@/features/groups/types";
import type { MasterDataOptions } from "@/lib/master-data/queries";

type GroupBrandsTabProps = {
  workspace: GroupWorkspace;
  masterData: MasterDataOptions;
};

export function GroupBrandsTab({ workspace, masterData }: GroupBrandsTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<GroupBrandRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<GroupBrandRow | null>(null);

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
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Brands</CardTitle>
            <p className="text-sm text-muted-foreground">
              Commercial brands across all legal entities in this group.
            </p>
          </div>
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
        </CardHeader>
        <CardContent className="space-y-4">
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

          {workspace.legal_entities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add a legal entity before creating brands.
            </p>
          ) : filteredBrands.length === 0 ? (
            <p className="text-sm text-muted-foreground">No brands match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Legal entity</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Subcategory</TableHead>
                    <TableHead>VR%</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Campaigns</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBrands.map((brand) => (
                    <TableRow key={brand.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="font-medium">{brand.name}</span>
                          <p className="text-xs text-muted-foreground">
                            <DocumentNumber value={brand.document_number} />
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{brand.client_name}</TableCell>
                      <TableCell>{brand.category_name ?? "—"}</TableCell>
                      <TableCell>{brand.subcategory_name ?? "—"}</TableCell>
                      <TableCell>
                        {brand.vr_rate_percent != null
                          ? `${brand.vr_rate_percent}%`
                          : "—"}
                      </TableCell>
                      <TableCell>{brand.currency_code}</TableCell>
                      <TableCell className="text-right">{brand.active_campaigns}</TableCell>
                      <TableCell>
                        <BrandStatusToggle brand={brand} />
                      </TableCell>
                      <TableCell className="text-right">
                        <BrandRowActions
                          brand={brand}
                          onEdit={() => {
                            setEditing(brand);
                            setSheetOpen(true);
                          }}
                          onArchive={() => setArchiveTarget(brand)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
