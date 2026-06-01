"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { CategorySubcategoryFields } from "@/components/forms/category-subcategory-fields";
import { FieldError } from "@/components/forms/field-error";
import { useNameAvailability } from "@/components/forms/use-name-availability";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import type { MasterDataOptions } from "@/lib/master-data/queries";
import type { ClientBrandRow, ClientDetail } from "@/types/database";

type ClientBrandsTabProps = {
  client: ClientDetail;
  masterData: MasterDataOptions;
};

export function ClientBrandsTab({ client, masterData }: ClientBrandsTabProps) {
  const currencyOptions = buildCurrencyOptions(masterData.currencies);
  const [brandName, setBrandName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [vrRateId, setVrRateId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<GroupBrandRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ClientBrandRow | null>(null);

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
      setCategoryId("");
      setSubcategoryId("");
      setVrRateId("");
      return;
    }
    toast.error(state.message);
  }, [state]);

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

  return (
    <>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Brands</CardTitle>
            <p className="text-sm text-muted-foreground">
              Commercial brands under this legal entity. Campaigns link to brands.
            </p>
          </CardHeader>
          <CardContent>
            {client.brands.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No brands yet for this legal entity.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brand #</TableHead>
                      <TableHead>Name</TableHead>
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
                    {client.brands.map((brand) => (
                      <TableRow key={brand.id}>
                        <TableCell className="font-mono text-xs">
                          {brand.document_number}
                        </TableCell>
                        <TableCell className="font-medium">{brand.name}</TableCell>
                        <TableCell>{brand.category_name ?? "—"}</TableCell>
                        <TableCell>{brand.subcategory_name ?? "—"}</TableCell>
                        <TableCell>
                          {brand.vr_rate_percent != null
                            ? `${brand.vr_rate_percent}%`
                            : "—"}
                        </TableCell>
                        <TableCell>{brand.currency_code}</TableCell>
                        <TableCell className="text-right">
                          {brand.active_campaigns}
                        </TableCell>
                        <TableCell>
                          <BrandStatusToggle brand={brand} />
                        </TableCell>
                        <TableCell className="text-right">
                          <BrandRowActions
                            brand={brand}
                            onEdit={() => {
                              setEditing(
                                brandTableRowToGroupBrandRow(brand, client.name)
                              );
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

        <Card>
          <CardHeader>
            <CardTitle>Add brand</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="grid gap-4">
              <input type="hidden" name="client_id" value={client.id} />
              <input type="hidden" name="category_id" value={categoryId} />
              <input type="hidden" name="subcategory_id" value={subcategoryId} />
              <input type="hidden" name="vr_rate_id" value={vrRateId} />
              <input type="hidden" name="currency_code" value={currency} />

              <div className="grid gap-2">
                <Label htmlFor="brand_name">Brand name</Label>
                <Input
                  id="brand_name"
                  name="name"
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

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <CategorySubcategoryFields
                  masterData={masterData}
                  categoryId={categoryId}
                  subcategoryId={subcategoryId}
                  onCategoryChange={setCategoryId}
                  onSubcategoryChange={setSubcategoryId}
                  disabled={isPending}
                />
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
                </div>
                <div className="grid gap-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
                    <SelectTrigger className="w-full">
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

              <Button type="submit" disabled={isPending || isDuplicate || checking}>
                {isPending ? "Creating…" : "Add brand"}
              </Button>
            </form>
          </CardContent>
        </Card>
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
