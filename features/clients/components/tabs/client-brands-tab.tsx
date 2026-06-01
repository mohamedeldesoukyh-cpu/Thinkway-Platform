"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { CategorySubcategoryFields } from "@/components/forms/category-subcategory-fields";
import { FieldError } from "@/components/forms/field-error";
import { useNameAvailability } from "@/components/forms/use-name-availability";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { createBrandAction } from "@/features/brands/actions";
import { CURRENCY_OPTIONS } from "@/features/clients/constants";
import { checkBrandNameAvailable } from "@/features/validation/actions";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import type { ClientDetail } from "@/types/database";

type ClientBrandsTabProps = {
  client: ClientDetail;
  masterData: MasterDataOptions;
};

export function ClientBrandsTab({ client, masterData }: ClientBrandsTabProps) {
  const [brandName, setBrandName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [vrRateId, setVrRateId] = useState("");
  const [currency, setCurrency] = useState("USD");

  const { checking, message: duplicateMessage, isDuplicate } = useNameAvailability(
    brandName,
    checkBrandNameAvailable,
    [client.id],
    Boolean(brandName.trim())
  );

  const [state, formAction, isPending] = useActionState(createBrandAction, {
    ok: false,
  });

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

  return (
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
            <p className="mb-4 text-sm text-muted-foreground">
              No brands yet for this legal entity.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Subcategory</TableHead>
                  <TableHead>VR%</TableHead>
                  <TableHead>Currency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.brands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-mono text-xs">
                      {brand.document_number}
                    </TableCell>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell>{brand.category?.name ?? "—"}</TableCell>
                    <TableCell>{brand.subcategory?.name ?? "—"}</TableCell>
                    <TableCell>
                      {brand.vr_rate ? `${brand.vr_rate.rate_percent}%` : "—"}
                    </TableCell>
                    <TableCell>{brand.currency_code}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                    {CURRENCY_OPTIONS.map((o) => (
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
  );
}
