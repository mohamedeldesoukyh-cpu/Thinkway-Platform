"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ClientStatusBadge } from "@/features/clients/components/client-status-badge";
import {
  AGENCY_OR_DIRECT_OPTIONS,
  CLIENT_STATUS_OPTIONS,
  labelForOption,
} from "@/features/clients/constants";
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

  const filteredBrands = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workspace.brands.filter((brand) => {
      if (statusFilter && brand.status !== statusFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
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

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(brand: GroupBrandRow) {
    setEditing(brand);
    setSheetOpen(true);
  }

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
            onClick={openCreate}
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
            <p className="text-sm text-muted-foreground">
              No brands match your filters.
            </p>
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
                    <TableHead>Direct / Agency</TableHead>
                    <TableHead className="text-right">Active campaigns</TableHead>
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
                          <p className="font-mono text-xs text-muted-foreground">
                            {brand.document_number}
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
                      <TableCell>
                        {brand.agency_or_direct
                          ? labelForOption(
                              AGENCY_OR_DIRECT_OPTIONS,
                              brand.agency_or_direct
                            )
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {brand.active_campaigns}
                      </TableCell>
                      <TableCell>
                        <ClientStatusBadge status={brand.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(brand)}
                        >
                          <PencilIcon className="size-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
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
    </>
  );
}
